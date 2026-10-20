import { Router } from 'express';
import { col, db, docData, snapData } from '../config/firebase.js';
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
    const snap = await col.users().where('shop.slug', '==', slug).limit(1).get();
    if (snap.empty || snap.docs[0].id === exceptUserId) return slug;
    slug = `${base}-${i}`;
  }
}

/** Shows or hides all of a seller's products when the shop status changes. */
async function setProductsVisible(sellerId, visible, shopPatch = {}) {
  const snap = await col.products().where('sellerId', '==', sellerId).get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { sellerActive: visible, ...shopPatch }));
    await batch.commit();
  }
}

const validateShop = (body) => {
  if (body.district && !DISTRICTS.includes(body.district)) throw new ApiError(400, 'Please choose a valid district');
};

// ---- Public -------------------------------------------------------------

// GET /api/sellers?q=&district=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [sellers, products] = await Promise.all([
      col.users().where('role', '==', 'seller').get().then(snapData),
      col.products().select('sellerId', 'active', 'rating', 'numReviews', 'sold').get().then(snapData),
    ]);
    let list = sellers
      .filter((u) => u.shop?.status === 'approved')
      .map((u) => {
        const mine = products.filter((p) => p.sellerId === u.id && p.active !== false);
        const rated = mine.filter((p) => p.rating > 0);
        return publicShop(u, {
          productCount: mine.length,
          sold: mine.reduce((s, p) => s + (p.sold || 0), 0),
          rating: rated.length ? Math.round((rated.reduce((s, p) => s + p.rating, 0) / rated.length) * 10) / 10 : 0,
        });
      });
    if (req.query.district) list = list.filter((s) => s.district === req.query.district);
    if (req.query.q) {
      const t = req.query.q.toLowerCase();
      list = list.filter((s) => [s.name, s.tagline, s.craft, s.district, s.ownerName].some((v) => v?.toLowerCase().includes(t)));
    }
    list.sort((a, b) => b.sold - a.sold);
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
    await col.users().doc(me.id).update({ role: 'seller', shop, updatedAt: now() });
    res.status(201).json({ user: publicUser(docData(await col.users().doc(me.id).get())) });
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
    await col.users().doc(req.user.id).update({ shop, updatedAt: now() });
    // keep denormalised shop info on products in sync
    await setProductsVisible(req.user.id, shop.status === 'approved', {
      shopName: shop.name, shopSlug: shop.slug, district: shop.district,
    });
    res.json({ user: publicUser(docData(await col.users().doc(req.user.id).get())) });
  })
);

// ---- Admin -------------------------------------------------------------

// GET /api/sellers/admin/all?status=pending
router.get(
  '/admin/all',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const [sellers, products, orders] = await Promise.all([
      col.users().where('role', '==', 'seller').get().then(snapData),
      col.products().select('sellerId').get().then(snapData),
      col.orders().select('items', 'status').get().then(snapData),
    ]);
    let list = sellers.map((u) => {
      let revenue = 0;
      orders.forEach((o) => {
        if (o.status === 'cancelled') return;
        o.items.forEach((i) => i.sellerId === u.id && (revenue += i.price * i.quantity));
      });
      return {
        ...publicShop(u),
        email: u.email,
        appliedAt: u.shop?.appliedAt,
        note: u.shop?.note || '',
        productCount: products.filter((p) => p.sellerId === u.id).length,
        revenue,
      };
    });
    if (req.query.status) list = list.filter((s) => s.status === req.query.status);
    list.sort((a, b) => (b.appliedAt || '').localeCompare(a.appliedAt || ''));
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
    const ref = col.users().doc(req.params.id);
    const user = docData(await ref.get());
    if (!user?.shop) throw new ApiError(404, 'Seller not found');
    const shop = { ...user.shop, status, note };
    if (status === 'approved' && !user.shop.approvedAt) shop.approvedAt = now();
    await ref.update({ shop, role: 'seller', updatedAt: now() });
    await setProductsVisible(user.id, status === 'approved');
    res.json({ seller: publicShop({ ...user, shop }) });
  })
);

// ---- Public shop page (keep last: matches any slug) ---------------------

// GET /api/sellers/:slug
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const snap = await col.users().where('shop.slug', '==', req.params.slug).limit(1).get();
    const u = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    if (!u || u.shop?.status !== 'approved') throw new ApiError(404, 'Shop not found');
    const products = snapData(await col.products().where('sellerId', '==', u.id).get())
      .filter((p) => p.active !== false)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
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
