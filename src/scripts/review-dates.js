/**
 * Realistic dates for demo reviews: somewhere between shortly after the business opened
 * (BUSINESS_START, default 2025-12-01) and yesterday, at a normal daytime hour in Sri Lanka.
 * Deterministic: the same key always gives the same date, so re-running keeps dates stable.
 */
import { BUSINESS_START } from '../config/shop.js';

const DAY = 864e5;

// small stable hash + PRNG so each review gets its own repeatable "random" value
const hash = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const rand = (seed) => {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Start of BUSINESS_START in Sri Lanka time, as a timestamp. */
export const businessStart = () => new Date(`${BUSINESS_START}T00:00:00+05:30`).getTime();

/**
 * @param key  anything unique per review, e.g. `${productId}|${userId}`
 * @returns ISO date string between (opening + 7 days) and yesterday, 08:00–21:59 Sri Lanka time
 */
export function reviewDate(key, now = Date.now()) {
  const first = businessStart() + 7 * DAY; // first reviews arrive about a week after opening
  const last = Math.max(first, now - DAY); // never today or in the future
  const dayIndex = Math.floor(rand(hash(key)) * (Math.floor((last - first) / DAY) + 1));
  const minuteOfDay = 8 * 60 + Math.floor(rand(hash(`${key}|time`)) * 14 * 60); // 08:00–21:59 local
  const localMidnight = first + dayIndex * DAY; // `first` is already a Sri Lanka midnight
  const ts = Math.min(localMidnight + minuteOfDay * 60000, now - 60 * 60000);
  return new Date(ts).toISOString();
}
