import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { col, db, docData } from '../config/firebase.js';
import { protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now, pick, publicUser, required, signToken } from '../utils/helpers.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const findByEmail = async (email) => {
  const snap = await col.users().where('email', '==', email).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    required(req.body, ['name', 'email', 'password']);
    const email = req.body.email.toLowerCase().trim();
    if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Invalid email address');
    if (req.body.password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
    if (await findByEmail(email)) throw new ApiError(409, 'Email is already registered');

    const user = {
      name: req.body.name.trim(),
      email,
      password: await bcrypt.hash(req.body.password, 10),
      role: 'customer',
      phone: '',
      avatar: '',
      address: {},
      wishlist: [],
      blocked: false,
      createdAt: now(),
      updatedAt: now(),
    };
    const ref = await col.users().add(user);
    const saved = { id: ref.id, ...user };
    res.status(201).json({ token: signToken(saved), user: publicUser(saved) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    required(req.body, ['email', 'password']);
    const user = await findByEmail(req.body.email.toLowerCase().trim());
    if (!user || !(await bcrypt.compare(req.body.password, user.password)))
      throw new ApiError(401, 'Invalid email or password');
    if (user.blocked) throw new ApiError(403, 'Your account has been blocked');
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get('/me', protect, (req, res) => res.json({ user: req.user }));

router.put(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const updates = { ...pick(req.body, ['name', 'phone', 'avatar', 'address']), updatedAt: now() };
    await col.users().doc(req.user.id).update(updates);
    res.json({ user: publicUser(docData(await col.users().doc(req.user.id).get())) });
  })
);

router.put(
  '/me/password',
  protect,
  asyncHandler(async (req, res) => {
    required(req.body, ['currentPassword', 'newPassword']);
    const user = docData(await col.users().doc(req.user.id).get());
    if (!(await bcrypt.compare(req.body.currentPassword, user.password)))
      throw new ApiError(400, 'Current password is incorrect');
    if (req.body.newPassword.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
    await col.users().doc(user.id).update({ password: await bcrypt.hash(req.body.newPassword, 10), updatedAt: now() });
    res.json({ message: 'Password updated' });
  })
);

router.get(
  '/me/wishlist',
  protect,
  asyncHandler(async (req, res) => {
    const ids = req.user.wishlist || [];
    if (!ids.length) return res.json({ products: [] });
    const docs = await db.getAll(...ids.map((id) => col.products().doc(id)));
    res.json({ products: docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...d.data() })) });
  })
);

router.post(
  '/me/wishlist/:productId',
  protect,
  asyncHandler(async (req, res) => {
    const list = new Set(req.user.wishlist || []);
    const id = req.params.productId;
    if (list.has(id)) list.delete(id);
    else list.add(id);
    const wishlist = [...list];
    await col.users().doc(req.user.id).update({ wishlist });
    res.json({ wishlist });
  })
);

export default router;
