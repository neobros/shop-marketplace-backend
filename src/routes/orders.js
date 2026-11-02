import { Router } from 'express';
import { col, searchRegex, findById, oid, toDoc, toDocs } from '../config/db.js';
import { FREE_SHIPPING_OVER, ORDER_STATUSES, PAYMENT_METHODS, SHIPPING_FLAT } from '../config/shop.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now } from '../utils/helpers.js';

const router = Router();
const PLATFORM = '_platform'; // fulfilment key for items with no seller (sold by the marketplace itself)

const orderNumber = () =>
  `CCC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

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

/** Give stock back (order cancelled, or a failed checkout rolling back its reservations). */
async function releaseStock(qtyByProduct) {
  await Promise.all(
    Object.entries(qtyByProduct).map(([id, qty]) =>
      col.products().updateOne({ _id: oid(id) }, [
        { $set: { stock: { $add: ['$stock', qty] }, sold: { $max: [0, { $subtract: [{ $ifNull: ['$sold', 0] }, qty] }] } } },
      ])
    )
  );
}

/**
 * POST /api/orders
 * body: { items: [{ productId, quantity, color?, size? }], shippingAddress, paymentMethod: cod|bank, note? }
 * Prices come from the DB. Stock is reserved with conditional atomic updates ($inc only when enough
 * stock is left), and rolled back if any line fails — safe without multi-document transactions.
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

    // The same product can appear on several lines (different size/colour) — load each once.
    const ids = [...new Set(items.map((i) => String(i.productId)))];
    const oids = ids.map(oid);
    if (oids.some((x) => !x)) throw new ApiError(400, 'A product in your cart no longer exists');
    const products = Object.fromEntries(
      toDocs(await col.products().find({ _id: { $in: oids } }).toArray()).map((p) => [p.id, p])
    );

    const qtyByProduct = {};
    const lines = items.map((item) => {
      const p = products[String(item.productId)];
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      if (!p) throw new ApiError(400, 'A product in your cart no longer exists');
      if (p.active === false || p.sellerActive === false) throw new ApiError(400, `${p.name} is no longer available`);
      if (p.sellerId && p.sellerId === req.user.id) throw new ApiError(400, "You can't buy your own product");
      qtyByProduct[p.id] = (qtyByProduct[p.id] || 0) + qty;
      if ((p.stock ?? 0) < qtyByProduct[p.id]) throw new ApiError(400, `Only ${p.stock} left of ${p.name}`);
      return {
        productId: p.id,
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

    // Reserve stock atomically
    const reserved = {};
    for (const [id, qty] of Object.entries(qtyByProduct)) {
      const { modifiedCount } = await col.products().updateOne(
        { _id: oid(id), stock: { $gte: qty }, active: { $ne: false }, sellerActive: { $ne: false } },
        { $inc: { stock: -qty, sold: qty } }
      );
      if (!modifiedCount) {
        await releaseStock(reserved);
        const fresh = await findById(col.products(), id);
        throw new ApiError(400, fresh ? `Only ${fresh.stock} left of ${fresh.name}` : 'A product in your cart is no longer available');
      }
      reserved[id] = qty;
    }

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

    try {
      const { insertedId } = await col.orders().insertOne(data);
      res.status(201).json({ order: toDoc({ _id: insertedId, ...data }) });
    } catch (e) {
      await releaseStock(reserved);
      throw e;
    }
  })
);

router.get(
  '/mine',
  protect,
  asyncHandler(async (req, res) => {
    const orders = await col.orders().find({ userId: req.user.id }).sort({ createdAt: -1 }).toArray();
    res.json({ orders: toDocs(orders) });
  })
);

// Admin: list all orders (?status=&q=)
router.get(
  '/',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.q) {
      const re = searchRegex(req.query.q);
      filter.$or = [{ orderNumber: re }, { 'customer.name': re }, { 'customer.email': re }];
    }
    res.json({ orders: toDocs(await col.orders().find(filter).sort({ createdAt: -1 }).toArray()) });
  })
);

router.get(
  '/:id',
  protect,
  asyncHandler(async (req, res) => {
    const order = await findById(col.orders(), req.params.id);
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
    const order = await findById(col.orders(), req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.userId !== req.user.id && req.user.role !== 'admin') throw new ApiError(403, 'Not your order');
    if (order.status !== 'pending') throw new ApiError(400, 'Only pending orders can be cancelled');
    await setStatus(order, 'cancelled');
    res.json({ order: await findById(col.orders(), order.id) });
  })
);

// Admin: update overall status / payment status. Setting a status applies it to every seller.
router.put(
  '/:id/status',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const order = await findById(col.orders(), req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');
    const { status, paymentStatus } = req.body;
    if (status && !ORDER_STATUSES.includes(status)) throw new ApiError(400, 'Invalid status');
    if (paymentStatus && !['paid', 'unpaid'].includes(paymentStatus)) throw new ApiError(400, 'Invalid payment status');
    if (order.status === 'cancelled' && status && status !== 'cancelled') throw new ApiError(400, 'Cancelled orders cannot be reopened');
    if (status && status !== order.status) await setStatus(order, status);
    if (paymentStatus) await col.orders().updateOne({ _id: oid(order.id) }, { $set: { paymentStatus, updatedAt: now() } });
    res.json({ order: await findById(col.orders(), order.id) });
  })
);

/**
 * Set the overall status (and every seller's fulfilment status). The update only applies while the
 * order is not already cancelled, so stock can never be restored twice.
 */
export async function setStatus(order, status) {
  const fulfilment = Object.fromEntries(
    Object.keys(order.fulfilment || { [PLATFORM]: 1 }).map((k) => [k, { status, at: now() }])
  );
  const $set = { status, fulfilment, updatedAt: now() };
  if (status === 'delivered' && order.paymentMethod === 'cod') $set.paymentStatus = 'paid';
  const { modifiedCount } = await col.orders().updateOne(
    { _id: oid(order.id), status: { $ne: 'cancelled' } },
    { $set, $push: { statusHistory: { status, at: now() } } }
  );
  if (modifiedCount && status === 'cancelled') {
    const qty = {};
    order.items.forEach((i) => (qty[i.productId] = (qty[i.productId] || 0) + i.quantity));
    await releaseStock(qty);
  }
}

export default router;
