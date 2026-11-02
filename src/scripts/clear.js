/**
 * Delete demo/seed data from MongoDB. Admin accounts are never deleted.
 *
 *   npm run db:clear                 -> preview only: shows what WOULD be deleted (demo data)
 *   npm run db:clear -- --yes        -> delete the demo data created by `npm run seed`
 *                                       (demo users + their products/orders/reviews, demo banners & categories)
 *   npm run db:clear -- --all --yes  -> delete EVERYTHING except admin accounts
 *                                       (all products, orders, reviews, banners, categories, customers & sellers)
 *
 *   add --keep-categories to keep the craft categories (Home Décor, Batik, …) in either mode
 */
import 'dotenv/config';
import { closeDB, col, connectDB } from '../config/db.js';

const args = process.argv.slice(2);
const YES = args.includes('--yes');
const ALL = args.includes('--all');
const KEEP_CATEGORIES = args.includes('--keep-categories');

async function run() {
  const db = await connectDB();
  console.log(`Database: "${db.databaseName}" — mode: ${ALL ? 'EVERYTHING except admins' : 'demo data only'}${KEEP_CATEGORIES ? ' (keeping categories)' : ''}\n`);

  let plan;
  if (ALL) {
    plan = {
      users: { role: { $ne: 'admin' } },
      products: {},
      orders: {},
      reviews: {},
      banners: {},
      categories: {},
    };
  } else {
    const demoUserIds = (await col.users().find({ demo: true, role: { $ne: 'admin' } }, { projection: { _id: 1 } }).toArray()).map((u) =>
      u._id.toString()
    );
    plan = {
      users: { demo: true, role: { $ne: 'admin' } },
      products: { $or: [{ demo: true }, { sellerId: { $in: demoUserIds } }] },
      orders: { $or: [{ demo: true }, { userId: { $in: demoUserIds } }] },
      reviews: { $or: [{ demo: true }, { userId: { $in: demoUserIds } }, { sellerId: { $in: demoUserIds } }] },
      banners: { demo: true },
      categories: { demo: true },
    };
  }
  if (KEEP_CATEGORIES) delete plan.categories;

  const counts = {};
  for (const [name, filter] of Object.entries(plan)) counts[name] = await col[name]().countDocuments(filter);
  const admins = await col.users().countDocuments({ role: 'admin' });

  for (const [name, n] of Object.entries(counts)) console.log(`  ${name.padEnd(11)} ${String(n).padStart(5)} to delete`);
  console.log(`  ${'admins'.padEnd(11)} ${String(admins).padStart(5)} kept\n`);

  if (!YES) {
    console.log('Preview only — nothing was deleted. Run again with --yes to delete:');
    console.log(`  npm run db:clear -- ${ALL ? '--all ' : ''}${KEEP_CATEGORIES ? '--keep-categories ' : ''}--yes`);
    return;
  }

  for (const [name, filter] of Object.entries(plan)) {
    const { deletedCount } = await col[name]().deleteMany(filter);
    console.log(`  deleted ${deletedCount} ${name}`);
  }
  console.log('\nDone ✔  Admin accounts were kept — log in and add your real categories, banners and artisans.');
}

run()
  .catch((e) => {
    console.error('✖', e.message);
    process.exitCode = 1;
  })
  .finally(() => closeDB());
