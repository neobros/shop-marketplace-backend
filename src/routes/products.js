import { Router } from 'express';
import { col, searchRegex, findById, oid, toDoc, toDocs } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, hideContactsIn, now, pick, required, slugify } from '../utils/helpers.js';
import { firstName } from './sellers.js';

const router = Router();
const FIELDS = [
  'name', 'description', 'shortDescription', 'price', 'comparePrice', 'categoryId', 'images',
  'stock', 'sku', 'tags', 'colors', 'sizes', 'materials', 'dimensions', 'isNew', 'active',
];
const ADMIN_FIELDS = ['featured', 'sellerId'];
const VISIBLE = { active: { $ne: false }, sellerActive: { $ne: false } };
const SORTS = {
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  rating: { rating: -1, numReviews: -1 },
  popular: { sold: -1 },
};

const normalize = (body, isAdmin) => {
  const data = pick(body, isAdmin ? [...FIELDS, ...ADMIN_FIELDS] : FIELDS);
  if (data.price !== undefined) data.price = Number(data.price);
  if (data.comparePrice !== undefined) data.comparePrice = Number(data.comparePrice) || 0;
  if (data.stock !== undefined) data.stock = parseInt(data.stock, 10) || 0;
  for (const k of ['images', 'tags', 'colors', 'sizes']) {
    if (typeof data[k] === 'string') data[k] = data[k].split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (data.price !== undefined && !(data.price >= 0)) throw new ApiError(400, 'Invalid price');
  // Sellers may not publish phone numbers, emails or links — customers must order through the marketplace
  if (!isAdmin) hideContactsIn(data, ['name', 'description', 'shortDescription', 'materials', 'dimensions', 'tags', 'colors', 'sizes']);
  return data;
};

/** Who may create/edit products: admins, and sellers whose shop is approved. */
const canSell = (req, _res, next) => {
  const u = req.user;
  if (u.role === 'admin') return next();
  if (u.role === 'seller' && u.shop?.status === 'approved') return next();
  if (u.role === 'seller') return next(new ApiError(403, 'Your shop is not approved yet'));
  return next(new ApiError(403, 'Only sellers can manage products'));
};

/** Denormalised shop info stored on each product (so listings need no extra lookups). */
async function shopInfo(sellerId) {
  if (!sellerId) return { sellerId: '', shopName: '', shopSlug: '', district: '', sellerActive: true };
  const u = await findById(col.users(), sellerId);
  if (!u?.shop) throw new ApiError(400, 'Seller not found');
  return {
    sellerId,
    shopName: u.shop.name,
    shopSlug: u.shop.slug,
    district: u.shop.district || '',
    sellerActive: u.shop.status === 'approved',
  };
}

/** Find a product by id or slug. */
const findProduct = async (idOrSlug) =>
  (await findById(col.products(), idOrSlug)) || toDoc(await col.products().findOne({ slug: idOrSlug }));

/**
 * GET /api/products
 * query: q, category (id or slug), seller (id or shop slug), district, minPrice, maxPrice,
 *        sort (newest|price-asc|price-desc|rating|popular), featured, isNew, page, limit, all (admin)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, category, seller, district, minPrice, maxPrice, sort = 'newest', featured, isNew, all } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(all === 'true' ? 1000 : 100, Math.max(1, parseInt(req.query.limit, 10) || 12));

    const and = [];
    if (all !== 'true') and.push(VISIBLE);
    if (category) {
      const cat = await col.categories().findOne({ slug: String(category) }, { projection: { _id: 1 } });
      and.push({ categoryId: cat ? cat._id.toString() : String(category) });
    }
    if (seller) and.push({ $or: [{ sellerId: String(seller) }, { shopSlug: String(seller) }] });
    if (district) and.push({ district: String(district) });
    if (q) {
      const re = searchRegex(q);
      and.push({ $or: [{ name: re }, { shopName: re }, { description: re }, { district: re }, { tags: re }] });
    }
    if (minPrice || maxPrice) {
      const price = {};
      if (minPrice) price.$gte = Number(minPrice);
      if (maxPrice) price.$lte = Number(maxPrice);
      and.push({ price });
    }
    if (featured === 'true') and.push({ featured: true });
    if (isNew === 'true') and.push({ isNew: true });
    const filter = and.length ? { $and: and } : {};

    const [total, items] = await Promise.all([
      col.products().countDocuments(filter),
      col.products()
        .find(filter)
        .sort({ ...(SORTS[sort] || SORTS.newest), _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    res.json({ products: toDocs(items), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

// GET /api/products/:idOrSlug
router.get(
  '/:idOrSlug',
  asyncHandler(async (req, res) => {
    const product = await findProduct(req.params.idOrSlug);
    if (!product || product.sellerActive === false) throw new ApiError(404, 'Product not found');

    const [reviews, related, category, sellerDoc] = await Promise.all([
      col.reviews().find({ productId: product.id }).sort({ createdAt: -1 }).toArray(),
      col.products()
        .find({ ...VISIBLE, categoryId: product.categoryId || '', _id: { $ne: oid(product.id) } })
        .limit(8)
        .toArray(),
      product.categoryId ? findById(col.categories(), product.categoryId) : null,
      product.sellerId ? findById(col.users(), product.sellerId) : null,
    ]);
    const seller = sellerDoc?.shop
      ? { id: sellerDoc.id, ownerName: firstName(sellerDoc.name), ...pick(sellerDoc.shop, ['name', 'slug', 'tagline', 'district', 'logo', 'craft', 'approvedAt']) }
      : null;

    res.json({ product: { ...product, category }, seller, reviews: toDocs(reviews), related: toDocs(related) });
  })
);

router.post(
  '/',
  protect,
  canSell,
  asyncHandler(async (req, res) => {
    required(req.body, ['name', 'price', 'categoryId']);
    const isAdmin = req.user.role === 'admin';
    const body = normalize(req.body, isAdmin);
    const sellerId = isAdmin ? body.sellerId || '' : req.user.id;
    const data = {
      description: '',
      images: [],
      stock: 0,
      comparePrice: 0,
      featured: false,
      isNew: true,
      active: true,
      ...body,
      ...(await shopInfo(sellerId)),
      slug: `${slugify(body.name.replace('[hidden]', ''))}-${Date.now().toString(36)}`,
      rating: 0,
      numReviews: 0,
      sold: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    const { insertedId } = await col.products().insertOne(data);
    res.status(201).json({ product: toDoc({ _id: insertedId, ...data }) });
  })
);

async function ownedProduct(req) {
  const product = await findById(col.products(), req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  if (req.user.role !== 'admin' && product.sellerId !== req.user.id) throw new ApiError(403, 'Not your product');
  return product;
}

router.put(
  '/:id',
  protect,
  canSell,
  asyncHandler(async (req, res) => {
    const product = await ownedProduct(req);
    const isAdmin = req.user.role === 'admin';
    const updates = { ...normalize(req.body, isAdmin), updatedAt: now() };
    if (isAdmin && updates.sellerId !== undefined && updates.sellerId !== product.sellerId) {
      Object.assign(updates, await shopInfo(updates.sellerId));
    }
    await col.products().updateOne({ _id: oid(product.id) }, { $set: updates });
    res.json({ product: await findById(col.products(), product.id) });
  })
);

router.delete(
  '/:id',
  protect,
  canSell,
  asyncHandler(async (req, res) => {
    const product = await ownedProduct(req);
    await col.products().deleteOne({ _id: oid(product.id) });
    res.json({ message: 'Product deleted' });
  })
);

// Reviews — one per user per product; recalculates the product rating.
router.post(
  '/:id/reviews',
  protect,
  asyncHandler(async (req, res) => {
    const rating = Number(req.body.rating);
    if (!(rating >= 1 && rating <= 5)) throw new ApiError(400, 'Rating must be between 1 and 5');
    const product = await findById(col.products(), req.params.id);
    if (!product) throw new ApiError(404, 'Product not found');
    if (product.sellerId === req.user.id) throw new ApiError(400, "You can't review your own product");

    const review = {
      productId: product.id,
      sellerId: product.sellerId || '',
      userId: req.user.id,
      userName: req.user.name,
      rating,
      comment: (req.body.comment || '').trim(),
      createdAt: now(),
    };
    let insertedId;
    try {
      ({ insertedId } = await col.reviews().insertOne(review));
    } catch (e) {
      if (e.code === 11000) throw new ApiError(400, 'You already reviewed this product');
      throw e;
    }

    const [agg] = await col.reviews()
      .aggregate([{ $match: { productId: product.id } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }])
      .toArray();
    await col.products().updateOne(
      { _id: oid(product.id) },
      { $set: { rating: Math.round(agg.avg * 10) / 10, numReviews: agg.n } }
    );

    res.status(201).json({ review: toDoc({ _id: insertedId, ...review }) });
  })
);

export default router;
