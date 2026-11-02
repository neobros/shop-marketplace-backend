import { Router } from 'express';
import { col, escapeRegex, findById, oid, toDoc, toDocs } from '../config/db.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now, pick, publicUser, required } from '../utils/helpers.js';
import { findByEmail, newUser } from './auth.js';

// Admin-only user management
const router = Router();
router.use(protect, adminOnly);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.role) filter.role = String(req.query.role);
    if (req.query.q) {
      const re = { $regex: escapeRegex(String(req.query.q)), $options: 'i' };
      filter.$or = [{ name: re }, { email: re }];
    }
    const [users, spend] = await Promise.all([
      col.users().find(filter, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray(),
      col.orders()
        .aggregate([
          { $match: { status: { $ne: 'cancelled' } } },
          { $group: { _id: '$userId', orderCount: { $sum: 1 }, totalSpent: { $sum: '$total' } } },
        ])
        .toArray(),
    ]);
    const spendOf = Object.fromEntries(spend.map((s) => [s._id, s]));
    res.json({
      users: toDocs(users).map((u) => ({
        ...publicUser(u),
        orderCount: spendOf[u.id]?.orderCount || 0,
        totalSpent: spendOf[u.id]?.totalSpent || 0,
      })),
    });
  })
);

// Create a user (e.g. another admin)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    required(req.body, ['name', 'email', 'password']);
    const email = req.body.email.toLowerCase().trim();
    if (await findByEmail(email)) throw new ApiError(409, 'Email is already registered');
    const user = await newUser({
      name: req.body.name,
      email,
      password: req.body.password,
      role: req.body.role === 'admin' ? 'admin' : 'customer',
      phone: req.body.phone || '',
    });
    const { insertedId } = await col.users().insertOne(user);
    res.status(201).json({ user: publicUser(toDoc({ _id: insertedId, ...user })) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const target = await findById(col.users(), req.params.id);
    if (!target) throw new ApiError(404, 'User not found');
    if (req.params.id === req.user.id && (req.body.role === 'customer' || req.body.blocked))
      throw new ApiError(400, "You can't demote or block yourself");
    if (target.role === 'seller' && req.body.role && req.body.role !== 'seller')
      throw new ApiError(400, 'Manage seller accounts from the Sellers page');
    const updates = { ...pick(req.body, ['name', 'phone', 'role', 'blocked']), updatedAt: now() };
    if (updates.role && !['admin', 'customer'].includes(updates.role)) throw new ApiError(400, 'Invalid role');
    await col.users().updateOne({ _id: oid(target.id) }, { $set: updates });
    res.json({ user: publicUser(await findById(col.users(), target.id)) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) throw new ApiError(400, "You can't delete yourself");
    // Hide a deleted seller's products (orders keep their own copy of the item details).
    await col.products().updateMany({ sellerId: req.params.id }, { $set: { sellerActive: false, active: false } });
    await col.users().deleteOne({ _id: oid(req.params.id) });
    res.json({ message: 'User deleted' });
  })
);

export default router;
