import jwt from 'jsonwebtoken';
import { col, docData } from '../config/firebase.js';
import { ApiError, asyncHandler, publicUser } from '../utils/helpers.js';

const readToken = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

export const protect = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw new ApiError(401, 'Not authorized, token missing');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Not authorized, token invalid or expired');
  }
  const user = docData(await col.users().doc(payload.id).get());
  if (!user) throw new ApiError(401, 'User no longer exists');
  if (user.blocked) throw new ApiError(403, 'Your account has been blocked');
  req.user = publicUser(user);
  next();
});

// Attaches req.user when a valid token is present, but never rejects.
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = docData(await col.users().doc(payload.id).get());
      if (user && !user.blocked) req.user = publicUser(user);
    } catch {
      /* ignore */
    }
  }
  next();
});

export const adminOnly = (req, _res, next) => {
  if (req.user?.role !== 'admin') return next(new ApiError(403, 'Admin access required'));
  next();
};
