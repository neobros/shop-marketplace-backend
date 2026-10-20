import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { col, docData, snapData } from '../config/firebase.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now, pick, publicUser, required } from '../utils/helpers.js';
import { findByEmail } from './auth.js';

// Admin-only user management
const router = Router();
router.use(protect, adminOnly);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [users, orders] = await Promise.all([
      col.users().get().then(snapData),
      col.orders().select('userId', 'total', 'status').get().then(snapData),
    ]);
    let list = users.map((u) => {
      const mine = orders.filter((o) => o.userId === u.id && o.status !== 'cancelled');
      return { ...publicUser(u), orderCount: mine.length, totalSpent: mine.reduce((s, o) => s + o.total, 0) };
    });
    if (req.query.q) {
      const t = req.query.q.toLowerCase();
      list = list.filter((u) => u.name?.toLowerCase().includes(t) || u.email?.toLowerCase().includes(t));
    }
    if (req.query.role) list = list.filter((u) => u.role === req.query.role);
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ users: list });
  })
);

// Create a user (e.g. another admin)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    required(req.body, ['name', 'email', 'password']);
    const email = req.body.email.toLowerCase().trim();
    if (await findByEmail(email)) throw new ApiError(409, 'Email is already registered');
    const user = {
      name: req.body.name,
      email,
      password: await bcrypt.hash(req.body.password, 10),
      role: req.body.role === 'admin' ? 'admin' : 'customer',
      phone: req.body.phone || '',
      avatar: '',
      address: {},
      wishlist: [],
      blocked: false,
      createdAt: now(),
      updatedAt: now(),
    };
    const ref = await col.users().add(user);
    res.status(201).json({ user: publicUser({ id: ref.id, ...user }) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const ref = col.users().doc(req.params.id);
    const target = docData(await ref.get());
    if (!target) throw new ApiError(404, 'User not found');
    if (req.params.id === req.user.id && (req.body.role === 'customer' || req.body.blocked))
      throw new ApiError(400, "You can't demote or block yourself");
    if (target.role === 'seller' && req.body.role && req.body.role !== 'seller')
      throw new ApiError(400, 'Manage seller accounts from the Sellers page');
    const updates = { ...pick(req.body, ['name', 'phone', 'role', 'blocked']), updatedAt: now() };
    if (updates.role && !['admin', 'customer'].includes(updates.role)) throw new ApiError(400, 'Invalid role');
    await ref.update(updates);
    res.json({ user: publicUser(docData(await ref.get())) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) throw new ApiError(400, "You can't delete yourself");
    // Hide a deleted seller's products (orders keep their own copy of the item details).
    const products = await col.products().where('sellerId', '==', req.params.id).get();
    await Promise.all(products.docs.map((d) => d.ref.update({ sellerActive: false, active: false })));
    await col.users().doc(req.params.id).delete();
    res.json({ message: 'User deleted' });
  })
);

export default router;
