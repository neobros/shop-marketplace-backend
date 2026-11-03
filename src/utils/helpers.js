import jwt from 'jsonwebtoken';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

export const publicUser = (u) => {
  if (!u) return null;
  const { password, googleId, ...rest } = u;
  // Google sign-ups have no password until they set one in their profile
  return { ...rest, hasPassword: !!password, googleLinked: !!googleId };
};

export const slugify = (s = '') =>
  s.toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const required = (body, fields) => {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`);
};

export const pick = (obj, keys) =>
  keys.reduce((acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});

export const now = () => new Date().toISOString();

/**
 * Hides contact details that sellers might put in public text (shop bio, product descriptions…)
 * so customers buy through the marketplace: phone numbers, emails, links and social/WhatsApp handles.
 */
const CONTACT_PATTERNS = [
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, // emails
  /\b(?:https?:\/\/|www\.)\S+/gi, // links
  /\b[\w-]+\.(?:com|lk|net|org|me|io|co|info|biz|shop|store)\b(?:\/\S*)?/gi, // bare domains (facebook.com/x, wa.me/…)
  /\+?\d(?:[\s\-.()]*\d){8,}/g, // phone numbers: 9+ digits, any separators (077 123 4567, +94-77…)
  /\b(?:whats\s*app|viber|imo|telegram|insta(?:gram)?|fb|facebook|tiktok)\b\s*[:\-]?\s*@?[\w.]+/gi, // "WhatsApp: …", "insta @shop"
  /(?<![\w@])@[a-z][\w.]{2,}/gi, // bare social handles "@kandy_batik"
];
export const hideContacts = (text) =>
  typeof text === 'string' ? CONTACT_PATTERNS.reduce((t, re) => t.replace(re, '[hidden]'), text) : text;

/** Apply hideContacts to the given string fields of an object (in place) and return it. */
export const hideContactsIn = (obj, fields) => {
  fields.forEach((f) => {
    if (typeof obj[f] === 'string') obj[f] = hideContacts(obj[f]);
    if (Array.isArray(obj[f])) obj[f] = obj[f].map(hideContacts);
  });
  return obj;
};
