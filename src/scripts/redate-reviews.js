/**
 * Give the demo reviews already in the database realistic dates (between shortly after
 * BUSINESS_START and yesterday). Only the review dates change — nothing is deleted, and reviews
 * written by real customers are never touched.
 *
 *   npm run seed:review-dates
 */
import 'dotenv/config';
import { closeDB, col, connectDB } from '../config/db.js';
import { BUSINESS_START } from '../config/shop.js';
import { reviewDate } from './review-dates.js';

async function run() {
  const db = await connectDB();
  // demo reviews: flagged by the seed, or written by a demo account (covers older seeds without the flag)
  const demoUserIds = (await col.users().find({ demo: true }, { projection: { _id: 1 } }).toArray()).map((u) => u._id.toString());
  const filter = { $or: [{ demo: true }, { userId: { $in: demoUserIds } }] };
  const reviews = await col.reviews().find(filter, { projection: { productId: 1, userId: 1 } }).toArray();
  const realCount = (await col.reviews().countDocuments()) - reviews.length;

  console.log(`Database "${db.databaseName}" - business start ${BUSINESS_START}`);
  if (!reviews.length) {
    console.log('No demo reviews found - nothing to change.');
    return;
  }

  const ops = reviews.map((r) => ({
    updateOne: { filter: { _id: r._id }, update: { $set: { createdAt: reviewDate(`${r.productId}|${r.userId}`) } } },
  }));
  const { modifiedCount } = await col.reviews().bulkWrite(ops, { ordered: false });

  const [range] = await col.reviews()
    .aggregate([{ $match: filter }, { $group: { _id: null, first: { $min: '$createdAt' }, last: { $max: '$createdAt' } } }])
    .toArray();
  console.log(
    `Updated dates of ${modifiedCount} of ${reviews.length} demo reviews (${realCount} real review${realCount === 1 ? '' : 's'} left unchanged).`
  );
  console.log(`Review dates now run from ${range.first.slice(0, 10)} to ${range.last.slice(0, 10)}.`);
  console.log('Done OK');
}

run()
  .catch((e) => {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  })
  .finally(() => closeDB());
