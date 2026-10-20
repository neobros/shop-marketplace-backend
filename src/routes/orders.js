import { Router } from 'express';
import { col, db, docData, snapData } from '../config/firebase.js';
import { FREE_SHIPPING_OVER, ORDER_STATUSES, PAYMENT_METHODS, SHIPPING_FLAT } from '../config/shop.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now } from '../utils/helpers.js';

const router = Router();
const PLATFORM = '_platform'; // fulfilment key for items with no seller (sold by the marketplace itself)

const orderNumber = () =>
  `HLK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/**
 * Overall order status from each seller's fulfilment status:
 * every seller delivered → delivered; every seller shipped/delivered → shipped; anyone started → processing.
 */
export function deriveStatus(fulfilment) {
  const s = Object.values(fulfilment || {}).map((f) => f.status);
  if (!s.length) return 'pending';
  if (s.every((x) => x === 'delivered')) return 'delivered';
  if (s.every((x) => x === 'shipped' || x === 'delivered')) return 'shipped';
  if (s.some((x) => x !== 'pending')) return 'processing';
  return 'pending';
}

/**
 * POST /api/orders
 * body: { items: [{ productId, quantity, color?, size? }], shippingAddress, paymentMethod: cod|bank, note? }
 * Prices are recalculated from the DB; stock is checked and decremented atomically.
 */
router.post(
  '/',
  protect,
  asyncHandler(async (req, res) => {
    const { items, shippingAddress, paymentMethod = 'cod', note = '' } = req.body;
    if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'Cart is empty');
    if (!PAYMENT_METHODS.includes(paymentMethod)) throw new ApiError(400, 'Invalid payment method');
    const a = shippingAddress || {};
    if (!a.fullName || !a.address || !a.city || !a.district || !a.phone)
      throw new ApiError(400, 'Shipping address is incomplete');

    const order = await db.runTransaction(async (tx) => {
      // The same product can appear on several lines (different size/colour) — read each once.
      const ids = [...new Set(items.map((i) => String(i.productId)))];
      const refs = Object.fromEntries(ids.map((id) => [id, col.products().doc(id)]));
      const docs = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await tx.get(refs[id])])));
      const qtyByProduct = {};

      const lines = items.map((item) => {
        const doc = docs[String(item.productId)];
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        if (!doc.exists) throw new ApiError(400, 'A product in your cart no longer exists');
        const p = doc.data();
        if (p.active === false || p.sellerActive === false) throw new ApiError(400, `${p.name} is no longer available`);
        if (p.sellerId && p.sellerId === req.user.id) throw new ApiError(400, "You can't buy your own product");
        qtyByProduct[doc.id] = (qtyByProduct[doc.id] || 0) + qty;
        if ((p.stock ?? 0) < qtyByProduct[doc.id]) throw new ApiError(400, `Only ${p.stock} left of ${p.name}`);
        return {
          productId: doc.id,
          name: p.name,
          image: p.images?.[0] || '',
          price: p.price,
          quantity: qty,
          color: item.color || '',
          size: item.size || '',
          sellerId: p.sellerId || '',
          shopName: p.shopName || '',
          shopSlug: p.shopSlug || '',
        };
      });

      Object.entries(qtyByProduct).forEach(([id, qty]) => {
        const p = docs[id].data();
        tx.update(refs[id], { stock: p.stock - qty, sold: (p.sold || 0) + qty });
      });

      const sellerIds = [...new Set(lines.map((l) => l.sellerId).filter(Boolean))];
      const fulfilment = Object.fromEntries(
        [...new Set(lines.map((l) => l.sellerId || PLATFORM))].map((k) => [k, { status: 'pending', at: now() }])
      );
      const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
      const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
      const data = {
        orderNumber: orderNumber(),
        userId: req.user.id,
        customer: { name: req.user.name, email: req.user.email, phone: a.phone },
        items: lines,
        sellerIds,
        fulfilment,
        shippingAddress: a,
        paymentMethod,
        paymentStatus: 'unpaid',
        note,
        subtotal,
        shipping,
        total: subtotal + shipping,
        status: 'pending',
        statusHistory: [{ status: 'pending', at: now() }],
        createdAt: now(),
        updatedAt: now(),
      };
      const orderRef = col.orders().doc();
      tx.set(orderRef, data);
      return { id: orderRef.id, ...data };
    });

    res.status(201).json({ order });
  })
);

router.get(
  '/mine',
  protect,
  asyncHandler(async (req, res) => {
    const orders = snapData(await col.orders().where('userId', '==', req.user.id).get()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    res.json({ orders });
  })
);

// Admin: list all orders (?status=&q=)
router.get(
  '/',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    let orders = snapData(await col.orders().get());
    if (req.query.status) orders = orders.filter((o) => o.status === req.query.status);
    if (req.query.q) {
      const t = req.query.q.toLowerCase();
      orders = orders.filter((o) =>
        [o.orderNumber, o.customer?.name, o.customer?.email].some((v) => v?.toLowerCase().includes(t))
      );
    }
    orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ orders });
  })
);

router.get(
  '/:id',
  protect,
  asyncHandler(async (req, res) => {
    const order = docData(await col.orders().doc(req.params.id).get());
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.userId !== req.user.id && req.user.role !== 'admin') throw new ApiError(403, 'Not your order');
    res.json({ order });
  })
);

// Customer can cancel while still pending — stock is restored.
router.put(
  '/:id/cancel',
  protect,
  asyncHandler(async (req, res) => {
    const ref = col.orders().doc(req.params.id);
    const order = docData(await ref.get());
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.userId !== req.user.id && req.user.role !== 'admin') throw new ApiError(403, 'Not your order');
    if (order.status !== 'pending') throw new ApiError(400, 'Only pending orders can be cancelled');
    await setStatus(ref, order, 'cancelled');
    res.json({ order: docData(await ref.get()) });
  })
);

// Admin: update overall status / payment status. Setting a status applies it to every seller.
router.put(
  '/:id/status',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const ref = col.orders().doc(req.params.id);
    const order = docData(await ref.get());
    if (!order) throw new ApiError(404, 'Order not found');
    const { status, paymentStatus } = req.body;
    if (status && !ORDER_STATUSES.includes(status)) throw new ApiError(400, 'Invalid status');
    if (paymentStatus && !['paid', 'unpaid'].includes(paymentStatus)) throw new ApiError(400, 'Invalid payment status');
    if (order.status === 'cancelled' && status && status !== 'cancelled') throw new ApiError(400, 'Cancelled orders cannot be reopened');
    if (status && status !== order.status) await setStatus(ref, order, status);
    if (paymentStatus) await ref.update({ paymentStatus, updatedAt: now() });
    res.json({ order: docData(await ref.get()) });
  })
);

export async function setStatus(ref, order, status) {
  await db.runTransaction(async (tx) => {
    // Restore stock when an order becomes cancelled.
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const qty = {};
      order.items.forEach((i) => (qty[i.productId] = (qty[i.productId] || 0) + i.quantity));
      const pDocs = await Promise.all(Object.keys(qty).map((id) => tx.get(col.products().doc(id))));
      pDocs.forEach((d) => {
        if (!d.exists) return;
        const p = d.data();
        tx.update(d.ref, { stock: (p.stock || 0) + qty[d.id], sold: Math.max(0, (p.sold || 0) - qty[d.id]) });
      });
    }
    const fulfilment = Object.fromEntries(
      Object.keys(order.fulfilment || { [PLATFORM]: 1 }).map((k) => [k, { status, at: now() }])
    );
    const updates = {
      status,
      fulfilment,
      statusHistory: [...(order.statusHistory || []), { status, at: now() }],
      updatedAt: now(),
    };
    if (status === 'delivered' && order.paymentMethod === 'cod') updates.paymentStatus = 'paid';
    tx.update(ref, updates);
  });
}

export default router;
