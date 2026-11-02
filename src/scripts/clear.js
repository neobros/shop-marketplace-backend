/**
 * Delete demo/seed data from MongoDB. Admin accounts are never deleted.
 *
 *   npm run db:clear                       -> preview only: shows what WOULD be deleted (demo data)
 *   npm run db:clear:demo                  -> delete the demo data created by `npm run seed`
 *                                             (demo users + their products/orders/reviews, demo banners & categories)
 *   npm run db:clear:all                   -> delete EVERYTHING except admin accounts
 *                                             (all products, orders, reviews, banners, categories, customers & sellers)
 *   npm run db:clear:all-keep-categories   -> same, but keep the craft categories
 *
 * These npm scripts pass the flags (--yes, --all, --keep-categories) for you, which matters in
 * PowerShell: there `npm run db:clear -- --yes` silently drops the `--yes`.
 * Running the file directly also works:  node src/scripts/clear.js --all --yes
 */
import 'dotenv/config';
import { closeDB, col, connectDB } from '../config/db.js';
import { slugify } from '../utils/helpers.js';
import { BANNERS, CATEGORIES } from './seed-data.js';

const args = process.argv.slice(2);
const YES = args.includes('--yes');
const ALL = args.includes('--all');
const KEEP_CATEGORIES = args.includes('--keep-categories');

async function run() {
  const db = await connectDB();
  console.log(`Database: "${db.databaseName}" - mode: ${ALL ? 'EVERYTHING except admins' : 'demo data only'}${KEEP_CATEGORIES ? ' (keeping categories)' : ''}\n`);

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
    const products = { $or: [{ demo: true }, { sellerId: { $in: demoUserIds } }] };

    // Data from older seeds has no `demo` flag - recognise it by the seed's own category slugs and banner titles.
    // A seed-named category is only removed when no real (non-demo) products are left in it.
    const seedSlugs = CATEGORIES.map((c) => slugify(c.name));
    const seedCats = await col.categories().find({ slug: { $in: seedSlugs } }, { projection: { _id: 1 } }).toArray();
    const removableCatIds = [];
    for (const { _id } of seedCats) {
      const realProducts = await col.products().countDocuments({ categoryId: _id.toString(), $nor: [products] });
      if (!realProducts) removableCatIds.push(_id);
    }

    plan = {
      users: { demo: true, role: { $ne: 'admin' } },
      products,
      orders: { $or: [{ demo: true }, { userId: { $in: demoUserIds } }] },
      reviews: { $or: [{ demo: true }, { userId: { $in: demoUserIds } }, { sellerId: { $in: demoUserIds } }] },
      banners: { $or: [{ demo: true }, { title: { $in: BANNERS.map((b) => b.title) } }] },
      categories: { $or: [{ demo: true }, { _id: { $in: removableCatIds } }] },
    };
  }
  if (KEEP_CATEGORIES) delete plan.categories;

  const counts = {};
  for (const [name, filter] of Object.entries(plan)) counts[name] = await col[name]().countDocuments(filter);
  const admins = await col.users().countDocuments({ role: 'admin' });

  for (const [name, n] of Object.entries(counts)) console.log(`  ${name.padEnd(11)} ${String(n).padStart(5)} to delete`);
  console.log(`  ${'admins'.padEnd(11)} ${String(admins).padStart(5)} kept\n`);

  if (!YES) {
    console.log('Preview only - nothing was deleted. Run again with --yes to delete:');
    console.log(`  npm run ${ALL ? (KEEP_CATEGORIES ? 'db:clear:all-keep-categories' : 'db:clear:all') : 'db:clear:demo'}`);
    return;
  }

  for (const [name, filter] of Object.entries(plan)) {
    const { deletedCount } = await col[name]().deleteMany(filter);
    console.log(`  deleted ${deletedCount} ${name}`);
  }
  console.log('\nDone OK  Admin accounts were kept - log in and add your real categories, banners and artisans.');
}

run()
  .catch((e) => {
    console.error('ERROR: ', e.message);
    process.exitCode = 1;
  })
  .finally(() => closeDB());
