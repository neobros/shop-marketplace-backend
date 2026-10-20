import { Router } from 'express';
import { col, docData, snapData } from '../config/firebase.js';
import { protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now, pick, required, slugify } from '../utils/helpers.js';

const router = Router();
const FIELDS = [
  'name', 'description', 'shortDescription', 'price', 'comparePrice', 'categoryId', 'images',
  'stock', 'sku', 'tags', 'colors', 'sizes', 'materials', 'dimensions', 'isNew', 'active',
];
const ADMIN_FIELDS = ['featured', 'sellerId'];

const normalize = (body, isAdmin) => {
  const data = pick(body, isAdmin ? [...FIELDS, ...ADMIN_FIELDS] : FIELDS);
  if (data.price !== undefined) data.price = Number(data.price);
  if (data.comparePrice !== undefined) data.comparePrice = Number(data.comparePrice) || 0;
  if (data.stock !== undefined) data.stock = parseInt(data.stock, 10) || 0;
  for (const k of ['images', 'tags', 'colors', 'sizes']) {
    if (typeof data[k] === 'string') data[k] = data[k].split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (data.price !== undefined && !(data.price >= 0)) throw new ApiError(400, 'Invalid price');
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
  const u = docData(await col.users().doc(sellerId).get());
  if (!u?.shop) throw new ApiError(400, 'Seller not found');
  return {
    sellerId,
    shopName: u.shop.name,
    shopSlug: u.shop.slug,
    district: u.shop.district || '',
    sellerActive: u.shop.status === 'approved',
  };
}

const visible = (p) => p.active !== false && p.sellerActive !== false;

/**
 * GET /api/products
 * query: q, category (id or slug), seller (id or shop slug), district, minPrice, maxPrice,
 *        sort (newest|price-asc|price-desc|rating|popular), featured, isNew, page, limit, all (admin)
 *
 * Filtering happens in memory so no composite Firestore indexes are needed.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, category, seller, district, minPrice, maxPrice, sort = 'newest', featured, isNew, all } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(all === 'true' ? 1000 : 100, Math.max(1, parseInt(req.query.limit, 10) || 12));

    let items = snapData(await col.products().get());
    if (all !== 'true') items = items.filter(visible);

    if (category) {
      let catId = category;
      const bySlug = await col.categories().where('slug', '==', category).limit(1).get();
      if (!bySlug.empty) catId = bySlug.docs[0].id;
      items = items.filter((p) => p.categoryId === catId);
    }
    if (seller) items = items.filter((p) => p.sellerId === seller || p.shopSlug === seller);
    if (district) items = items.filter((p) => p.district === district);
    if (q) {
      const term = q.toLowerCase();
      items = items.filter((p) =>
        [p.name, p.shopName, p.description, p.district, ...(p.tags || [])].some((v) => v?.toLowerCase().includes(term))
      );
    }
    if (minPrice) items = items.filter((p) => p.price >= Number(minPrice));
    if (maxPrice) items = items.filter((p) => p.price <= Number(maxPrice));
    if (featured === 'true') items = items.filter((p) => p.featured);
    if (isNew === 'true') items = items.filter((p) => p.isNew);

    const sorters = {
      newest: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      rating: (a, b) => (b.rating || 0) - (a.rating || 0),
      popular: (a, b) => (b.sold || 0) - (a.sold || 0),
    };
    items.sort(sorters[sort] || sorters.newest);

    const total = items.length;
    res.json({
      products: items.slice((page - 1) * limit, page * limit),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  })
);

// GET /api/products/:idOrSlug
router.get(
  '/:idOrSlug',
  asyncHandler(async (req, res) => {
    let product = docData(await col.products().doc(req.params.idOrSlug).get());
    if (!product) {
      const snap = await col.products().where('slug', '==', req.params.idOrSlug).limit(1).get();
      if (!snap.empty) product = { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
    if (!product || product.sellerActive === false) throw new ApiError(404, 'Product not found');

    const [reviewsSnap, relatedSnap, category, sellerDoc] = await Promise.all([
      col.reviews().where('productId', '==', product.id).get(),
      col.products().where('categoryId', '==', product.categoryId || '').limit(12).get(),
      product.categoryId ? col.categories().doc(product.categoryId).get().then(docData) : null,
      product.sellerId ? col.users().doc(product.sellerId).get().then(docData) : null,
    ]);
    const reviews = snapData(reviewsSnap).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const related = snapData(relatedSnap).filter((p) => p.id !== product.id && visible(p)).slice(0, 8);
    const seller = sellerDoc?.shop
      ? { id: sellerDoc.id, ownerName: sellerDoc.name, ...pick(sellerDoc.shop, ['name', 'slug', 'tagline', 'district', 'logo', 'craft', 'approvedAt']) }
      : null;

    res.json({ product: { ...product, category }, seller, reviews, related });
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
      slug: `${slugify(req.body.name)}-${Date.now().toString(36)}`,
      rating: 0,
      numReviews: 0,
      sold: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    const ref = await col.products().add(data);
    res.status(201).json({ product: { id: ref.id, ...data } });
  })
);

async function ownedProduct(req) {
  const ref = col.products().doc(req.params.id);
  const product = docData(await ref.get());
  if (!product) throw new ApiError(404, 'Product not found');
  if (req.user.role !== 'admin' && product.sellerId !== req.user.id) throw new ApiError(403, 'Not your product');
  return { ref, product };
}

router.put(
  '/:id',
  protect,
  canSell,
  asyncHandler(async (req, res) => {
    const { ref, product } = await ownedProduct(req);
    const isAdmin = req.user.role === 'admin';
    const updates = { ...normalize(req.body, isAdmin), updatedAt: now() };
    if (isAdmin && updates.sellerId !== undefined && updates.sellerId !== product.sellerId) {
      Object.assign(updates, await shopInfo(updates.sellerId));
    }
    await ref.update(updates);
    res.json({ product: docData(await ref.get()) });
  })
);

router.delete(
  '/:id',
  protect,
  canSell,
  asyncHandler(async (req, res) => {
    const { ref } = await ownedProduct(req);
    await ref.delete();
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
    const productRef = col.products().doc(req.params.id);
    const product = docData(await productRef.get());
    if (!product) throw new ApiError(404, 'Product not found');
    if (product.sellerId === req.user.id) throw new ApiError(400, "You can't review your own product");

    const existing = await col.reviews()
      .where('productId', '==', req.params.id)
      .where('userId', '==', req.user.id)
      .limit(1)
      .get();
    if (!existing.empty) throw new ApiError(400, 'You already reviewed this product');

    const review = {
      productId: req.params.id,
      sellerId: product.sellerId || '',
      userId: req.user.id,
      userName: req.user.name,
      rating,
      comment: (req.body.comment || '').trim(),
      createdAt: now(),
    };
    const ref = await col.reviews().add(review);

    const all = snapData(await col.reviews().where('productId', '==', req.params.id).get());
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    await productRef.update({ rating: Math.round(avg * 10) / 10, numReviews: all.length });

    res.status(201).json({ review: { id: ref.id, ...review } });
  })
);

export default router;
