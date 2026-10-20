import { Router } from 'express';
import { col, db, docData, snapData } from '../config/firebase.js';
import { COMMISSION_RATE } from '../config/shop.js';
import { protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now } from '../utils/helpers.js';
import { deriveStatus } from './orders.js';

/** Seller dashboard API — everything is scoped to the signed-in seller. */
const router = Router();
router.use(protect, (req, _res, next) =>
  req.user.role === 'seller' ? next() : next(new ApiError(403, 'Seller account required'))
);

const SELLER_STATUSES = ['processing', 'shipped', 'delivered'];
const round = (n) => Math.round(n * 100) / 100;

/** An order as one seller sees it: only their lines, their subtotal and their fulfilment status. */
const sellerView = (o, sellerId) => {
  const items = o.items.filter((i) => i.sellerId === sellerId);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customer: o.customer,
    shippingAddress: o.shippingAddress,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    note: o.note,
    status: o.status,
    sellerStatus: o.status === 'cancelled' ? 'cancelled' : o.fulfilment?.[sellerId]?.status || 'pending',
    items,
    subtotal,
    commission: round(subtotal * COMMISSION_RATE),
    earnings: round(subtotal * (1 - COMMISSION_RATE)),
    otherSellers: (o.sellerIds || []).filter((id) => id !== sellerId).length,
    createdAt: o.createdAt,
  };
};

const myOrders = async (sellerId) =>
  snapData(await col.orders().where('sellerIds', 'array-contains', sellerId).get())
    .map((o) => sellerView(o, sellerId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// GET /api/seller/products — own products including inactive ones
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const products = snapData(await col.products().where('sellerId', '==', req.user.id).get()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    res.json({ products, total: products.length });
  })
);

// GET /api/seller/orders?status=
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    let orders = await myOrders(req.user.id);
    if (req.query.status) orders = orders.filter((o) => o.sellerStatus === req.query.status);
    res.json({ orders, commissionRate: COMMISSION_RATE });
  })
);

// PUT /api/seller/orders/:id/status { status: processing|shipped|delivered }
router.put(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!SELLER_STATUSES.includes(status)) throw new ApiError(400, 'Invalid status');
    const ref = col.orders().doc(req.params.id);

    await db.runTransaction(async (tx) => {
      const order = docData(await tx.get(ref));
      if (!order || !order.sellerIds?.includes(req.user.id)) throw new ApiError(404, 'Order not found');
      if (order.status === 'cancelled') throw new ApiError(400, 'This order was cancelled');
      const fulfilment = { ...order.fulfilment, [req.user.id]: { status, at: now() } };
      const overall = deriveStatus(fulfilment);
      const updates = { fulfilment, status: overall, updatedAt: now() };
      if (overall !== order.status) updates.statusHistory = [...(order.statusHistory || []), { status: overall, at: now() }];
      if (overall === 'delivered' && order.paymentMethod === 'cod') updates.paymentStatus = 'paid';
      tx.update(ref, updates);
    });

    res.json({ order: sellerView(docData(await ref.get()), req.user.id) });
  })
);

// GET /api/seller/stats?days=30
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 30));
    const [orders, products, reviews] = await Promise.all([
      myOrders(req.user.id),
      col.products().where('sellerId', '==', req.user.id).get().then(snapData),
      col.reviews().where('sellerId', '==', req.user.id).get().then(snapData),
    ]);
    const valid = orders.filter((o) => o.status !== 'cancelled');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      series.push({ date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 });
    }
    const byDate = Object.fromEntries(series.map((s) => [s.date, s]));
    valid.forEach((o) => {
      const s = byDate[new Date(o.createdAt).toISOString().slice(0, 10)];
      if (s) {
        s.revenue += o.subtotal;
        s.orders += 1;
      }
    });

    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - days + 1);
    const prevCutoff = new Date(cutoff);
    prevCutoff.setDate(prevCutoff.getDate() - days);
    const cur = valid.filter((o) => new Date(o.createdAt) >= cutoff);
    const prev = valid.filter((o) => new Date(o.createdAt) >= prevCutoff && new Date(o.createdAt) < cutoff);
    const sum = (arr, k = 'subtotal') => arr.reduce((s, o) => s + o[k], 0);
    const pct = (a, b) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 1000) / 10);

    const rated = products.filter((p) => p.rating > 0);
    res.json({
      commissionRate: COMMISSION_RATE,
      totals: {
        revenue: sum(valid),
        earnings: sum(valid, 'earnings'),
        pendingPayout: sum(valid.filter((o) => o.sellerStatus !== 'delivered'), 'earnings'),
        orders: orders.length,
        products: products.length,
        activeProducts: products.filter((p) => p.active !== false).length,
        rating: rated.length ? Math.round((rated.reduce((s, p) => s + p.rating, 0) / rated.length) * 10) / 10 : 0,
        reviews: reviews.length,
      },
      period: {
        days,
        revenue: sum(cur),
        revenueChange: pct(sum(cur), sum(prev)),
        orders: cur.length,
        ordersChange: pct(cur.length, prev.length),
      },
      series,
      toFulfil: orders.filter((o) => ['pending', 'processing'].includes(o.sellerStatus)).length,
      statusCounts: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => ({
        status: s,
        count: orders.filter((o) => o.sellerStatus === s).length,
      })),
      topProducts: [...products]
        .sort((a, b) => (b.sold || 0) - (a.sold || 0))
        .slice(0, 5)
        .map(({ id, name, images, price, sold, stock }) => ({ id, name, image: images?.[0], price, sold: sold || 0, stock })),
      lowStock: products
        .filter((p) => (p.stock ?? 0) <= 3)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6)
        .map(({ id, name, images, stock }) => ({ id, name, image: images?.[0], stock })),
      recentOrders: orders.slice(0, 6),
      recentReviews: reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4),
    });
  })
);

export default router;
