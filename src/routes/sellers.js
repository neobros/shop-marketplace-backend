import { Router } from 'express';
import { col, escapeRegex, findById, oid, toDoc, toDocs } from '../config/db.js';
import { DISTRICTS, SHOP_STATUSES } from '../config/shop.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now, pick, publicUser, required, slugify } from '../utils/helpers.js';

/**
 * Sellers (artisan shops). A seller is a user with role "seller" and a `shop` object:
 *   { name, slug, tagline, bio, district, phone, logo, banner, craft, status, appliedAt, approvedAt, note }
 * Only shops with status "approved" can list products and appear in the store.
 */
const router = Router();
const SHOP_FIELDS = ['name', 'tagline', 'bio', 'district', 'phone', 'logo', 'banner', 'craft', 'story'];

const publicShop = (u, extra = {}) => ({
  id: u.id,
  ownerName: u.name,
  ...pick(u.shop || {}, [...SHOP_FIELDS, 'slug', 'status', 'approvedAt']),
  ...extra,
});

async function uniqueSlug(name, exceptUserId) {
  const base = slugify(name) || 'shop';
  let slug = base;
  for (let i = 2; ; i++) {
    const taken = await col.users().findOne({ 'shop.slug': slug }, { projection: { _id: 1 } });
    if (!taken || taken._id.toString() === exceptUserId) return slug;
    slug = `${base}-${i}`;
  }
}

/** Shows or hides all of a seller's products (and syncs denormalised shop info) when the shop changes. */
const setProductsVisible = (sellerId, visible, shopPatch = {}) =>
  col.products().updateMany({ sellerId }, { $set: { sellerActive: visible, ...shopPatch } });

/** Per-seller product stats: { [sellerId]: { productCount, sold, rating } } */
async function productStats(match = {}) {
  const rows = await col.products()
    .aggregate([
      { $match: { active: { $ne: false }, sellerId: { $nin: ['', null] }, ...match } },
      {
        $group: {
          _id: '$sellerId',
          productCount: { $sum: 1 },
          sold: { $sum: { $ifNull: ['$sold', 0] } },
          rating: { $avg: { $cond: [{ $gt: ['$rating', 0] }, '$rating', null] } },
        },
      },
    ])
    .toArray();
  return Object.fromEntries(
    rows.map((r) => [r._id, { productCount: r.productCount, sold: r.sold, rating: r.rating ? Math.round(r.rating * 10) / 10 : 0 }])
  );
}

const validateShop = (body) => {
  if (body.district && !DISTRICTS.includes(body.district)) throw new ApiError(400, 'Please choose a valid district');
};

// ---- Public -------------------------------------------------------------

// GET /api/sellers?q=&district=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { role: 'seller', 'shop.status': 'approved' };
    if (req.query.district) filter['shop.district'] = String(req.query.district);
    if (req.query.q) {
      const re = { $regex: escapeRegex(String(req.query.q)), $options: 'i' };
      filter.$or = [{ 'shop.name': re }, { 'shop.tagline': re }, { 'shop.craft': re }, { 'shop.district': re }, { name: re }];
    }
    const [sellers, stats] = await Promise.all([
      col.users().find(filter, { projection: { password: 0 } }).toArray(),
      productStats(),
    ]);
    const list = toDocs(sellers)
      .map((u) => publicShop(u, stats[u.id] || { productCount: 0, sold: 0, rating: 0 }))
      .sort((a, b) => b.sold - a.sold);
    res.json({ sellers: list, districts: DISTRICTS });
  })
);

// ---- Current user (apply / manage own shop) -----------------------------

// POST /api/sellers/apply — any signed-in customer can apply to open a shop
router.post(
  '/apply',
  protect,
  asyncHandler(async (req, res) => {
    required(req.body, ['name', 'district', 'phone', 'craft']);
    validateShop(req.body);
    const me = req.user;
    if (me.role === 'admin') throw new ApiError(400, 'Admins cannot open a shop');
    if (me.shop?.status === 'approved') throw new ApiError(400, 'Your shop is already approved');
    if (me.shop?.status === 'suspended') throw new ApiError(403, 'Your shop is suspended. Please contact support.');

    const shop = {
      ...(me.shop || {}),
      ...pick(req.body, SHOP_FIELDS),
      slug: await uniqueSlug(req.body.name, me.id),
      status: 'pending',
      note: '',
      appliedAt: now(),
    };
    await col.users().updateOne({ _id: oid(me.id) }, { $set: { role: 'seller', shop, updatedAt: now() } });
    res.status(201).json({ user: publicUser(await findById(col.users(), me.id)) });
  })
);

// PUT /api/sellers/me — edit shop profile (status can't be changed here)
router.put(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'seller') throw new ApiError(403, 'You do not have a shop');
    validateShop(req.body);
    const shop = { ...req.user.shop, ...pick(req.body, SHOP_FIELDS) };
    if (req.body.name && req.body.name !== req.user.shop.name) shop.slug = await uniqueSlug(req.body.name, req.user.id);
    await col.users().updateOne({ _id: oid(req.user.id) }, { $set: { shop, updatedAt: now() } });
    await setProductsVisible(req.user.id, shop.status === 'approved', {
      shopName: shop.name, shopSlug: shop.slug, district: shop.district,
    });
    res.json({ user: publicUser(await findById(col.users(), req.user.id)) });
  })
);

// ---- Admin -------------------------------------------------------------

// GET /api/sellers/admin/all?status=pending
router.get(
  '/admin/all',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const filter = { role: 'seller' };
    if (req.query.status) filter['shop.status'] = String(req.query.status);
    const [sellers, productCounts, revenue] = await Promise.all([
      col.users().find(filter, { projection: { password: 0 } }).sort({ 'shop.appliedAt': -1 }).toArray(),
      col.products().aggregate([{ $group: { _id: '$sellerId', n: { $sum: 1 } } }]).toArray(),
      col.orders()
        .aggregate([
          { $match: { status: { $ne: 'cancelled' } } },
          { $unwind: '$items' },
          { $group: { _id: '$items.sellerId', revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
        ])
        .toArray(),
    ]);
    const countOf = Object.fromEntries(productCounts.map((r) => [r._id, r.n]));
    const revenueOf = Object.fromEntries(revenue.map((r) => [r._id, r.revenue]));
    const list = toDocs(sellers).map((u) => ({
      ...publicShop(u),
      email: u.email,
      appliedAt: u.shop?.appliedAt,
      note: u.shop?.note || '',
      productCount: countOf[u.id] || 0,
      revenue: revenueOf[u.id] || 0,
    }));
    res.json({ sellers: list });
  })
);

// PUT /api/sellers/:id/status  { status: approved|rejected|suspended|pending, note? }
router.put(
  '/:id/status',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const { status, note = '' } = req.body;
    if (!SHOP_STATUSES.includes(status)) throw new ApiError(400, 'Invalid status');
    const user = await findById(col.users(), req.params.id);
    if (!user?.shop) throw new ApiError(404, 'Seller not found');
    const shop = { ...user.shop, status, note };
    if (status === 'approved' && !user.shop.approvedAt) shop.approvedAt = now();
    await col.users().updateOne({ _id: oid(user.id) }, { $set: { shop, role: 'seller', updatedAt: now() } });
    await setProductsVisible(user.id, status === 'approved');
    res.json({ seller: publicShop({ ...user, shop }) });
  })
);

// ---- Public shop page (keep last: matches any slug) ---------------------

// GET /api/sellers/:slug
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const u = toDoc(await col.users().findOne({ 'shop.slug': req.params.slug }, { projection: { password: 0 } }));
    if (!u || u.shop?.status !== 'approved') throw new ApiError(404, 'Shop not found');
    const products = toDocs(
      await col.products().find({ sellerId: u.id, active: { $ne: false } }).sort({ createdAt: -1 }).toArray()
    );
    const rated = products.filter((p) => p.rating > 0);
    res.json({
      seller: publicShop(u, {
        productCount: products.length,
        sold: products.reduce((s, p) => s + (p.sold || 0), 0),
        rating: rated.length ? Math.round((rated.reduce((s, p) => s + p.rating, 0) / rated.length) * 10) / 10 : 0,
        memberSince: u.createdAt,
      }),
      products,
    });
  })
);

export default router;
