import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { col, findById, oid, toDoc, toDocs } from '../config/db.js';
import { protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now, pick, publicUser, required, signToken } from '../utils/helpers.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const findByEmail = async (email) => toDoc(await col.users().findOne({ email }));

export const newUser = async ({ name, email, password, role = 'customer', phone = '' }) => ({
  name: name.trim(),
  email,
  password: await bcrypt.hash(password, 10),
  role,
  phone,
  avatar: '',
  address: {},
  wishlist: [],
  blocked: false,
  createdAt: now(),
  updatedAt: now(),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    required(req.body, ['name', 'email', 'password']);
    const email = req.body.email.toLowerCase().trim();
    if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Invalid email address');
    if (req.body.password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
    if (await findByEmail(email)) throw new ApiError(409, 'Email is already registered');

    const user = await newUser({ name: req.body.name, email, password: req.body.password });
    try {
      const { insertedId } = await col.users().insertOne(user);
      const saved = toDoc({ _id: insertedId, ...user });
      res.status(201).json({ token: signToken(saved), user: publicUser(saved) });
    } catch (e) {
      if (e.code === 11000) throw new ApiError(409, 'Email is already registered'); // unique index race
      throw e;
    }
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
    await col.users().updateOne({ _id: oid(req.user.id) }, { $set: updates });
    res.json({ user: publicUser(await findById(col.users(), req.user.id)) });
  })
);

router.put(
  '/me/password',
  protect,
  asyncHandler(async (req, res) => {
    required(req.body, ['currentPassword', 'newPassword']);
    const user = await findById(col.users(), req.user.id);
    if (!(await bcrypt.compare(req.body.currentPassword, user.password)))
      throw new ApiError(400, 'Current password is incorrect');
    if (req.body.newPassword.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
    await col.users().updateOne(
      { _id: oid(user.id) },
      { $set: { password: await bcrypt.hash(req.body.newPassword, 10), updatedAt: now() } }
    );
    res.json({ message: 'Password updated' });
  })
);

router.get(
  '/me/wishlist',
  protect,
  asyncHandler(async (req, res) => {
    const ids = (req.user.wishlist || []).map(oid).filter(Boolean);
    if (!ids.length) return res.json({ products: [] });
    res.json({ products: toDocs(await col.products().find({ _id: { $in: ids } }).toArray()) });
  })
);

router.post(
  '/me/wishlist/:productId',
  protect,
  asyncHandler(async (req, res) => {
    const id = req.params.productId;
    if (!oid(id)) throw new ApiError(400, 'Invalid product id');
    const inList = (req.user.wishlist || []).includes(id);
    const user = await col.users().findOneAndUpdate(
      { _id: oid(req.user.id) },
      inList ? { $pull: { wishlist: id } } : { $addToSet: { wishlist: id } },
      { returnDocument: 'after', projection: { wishlist: 1 } }
    );
    res.json({ wishlist: user?.wishlist || [] });
  })
);

export default router;
