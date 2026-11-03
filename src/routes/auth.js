import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
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
    // GOOGLE_ONLY=true -> new accounts must use "Continue with Google" (email login still works for staff/admin)
    if (String(process.env.GOOGLE_ONLY).toLowerCase() === 'true')
      throw new ApiError(403, 'Please sign up with "Continue with Google".');
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
    if (user && !user.password)
      throw new ApiError(400, 'This account was created with Google. Please use "Continue with Google".');
    if (!user || !(await bcrypt.compare(req.body.password, user.password)))
      throw new ApiError(401, 'Invalid email or password');
    if (user.blocked) throw new ApiError(403, 'Your account has been blocked');
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// ---- Google sign-in / sign-up ----------------------------------------------
// The browser gets an ID token from Google Identity Services; we verify it with Google's
// library and then issue our own JWT (Firebase Auth is not used).
const googleClient = new OAuth2Client();

/** Find the user for a verified Google profile — by Google id, then by email — or create one. */
export async function findOrCreateGoogleUser({ sub, email, name, picture }) {
  const existing = toDoc(await col.users().findOne({ $or: [{ googleId: sub }, { email }] }));
  if (existing) {
    if (existing.blocked) throw new ApiError(403, 'Your account has been blocked');
    // Same email already registered with a password: link Google so both ways work from now on.
    if (existing.googleId !== sub) {
      await col.users().updateOne(
        { _id: oid(existing.id) },
        { $set: { googleId: sub, avatar: existing.avatar || picture || '', updatedAt: now() } }
      );
    }
    return { user: await findById(col.users(), existing.id), created: false };
  }
  const user = {
    name: (name || email.split('@')[0]).trim(),
    email,
    password: null, // Google-only until they set one in their profile
    googleId: sub,
    role: 'customer',
    phone: '',
    avatar: picture || '',
    address: {},
    wishlist: [],
    blocked: false,
    createdAt: now(),
    updatedAt: now(),
  };
  try {
    const { insertedId } = await col.users().insertOne(user);
    return { user: toDoc({ _id: insertedId, ...user }), created: true };
  } catch (e) {
    // two sign-ins at the same moment: the other request created it
    if (e.code === 11000) return findOrCreateGoogleUser({ sub, email, name, picture });
    throw e;
  }
}

// POST /api/auth/google { credential }  — credential = the ID token from the Google button
router.post(
  '/google',
  asyncHandler(async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new ApiError(503, 'Google sign-in is not configured on the server');
    required(req.body, ['credential']);

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: String(req.body.credential), audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new ApiError(401, 'Google sign-in failed. Please try again.');
    }
    if (!payload?.email || !payload.email_verified) throw new ApiError(401, 'Your Google email address is not verified');

    const { user, created } = await findOrCreateGoogleUser({
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name,
      picture: payload.picture,
    });
    res.status(created ? 201 : 200).json({ token: signToken(user), user: publicUser(user), created });
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
    required(req.body, ['newPassword']);
    const user = await findById(col.users(), req.user.id);
    // Google-only accounts have no password yet: they can set one without a current password.
    if (user.password && !(await bcrypt.compare(String(req.body.currentPassword || ''), user.password)))
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
