/**
 * Seeds MongoDB for "Ceylon Craft Collective": admin, artisan shops (sellers), craft categories,
 * products (LKR), banners, customers, reviews and demo orders.
 *   npm run seed            -> add data (skips users that already exist)
 *   npm run seed:fresh      -> wipe shop collections + demo users first
 *   (works in PowerShell too - `npm run seed -- --fresh` does not, PowerShell drops the `--`)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { closeDB, col, connectDB, oid } from '../config/db.js';
import { COMMISSION_RATE, FREE_SHIPPING_OVER, SHIPPING_FLAT } from '../config/shop.js';
import { slugify } from '../utils/helpers.js';
import { CATEGORIES, SHOPS, PENDING_SHOP, P, BANNERS, REVIEWS } from './seed-data.js';

const fresh = process.argv.includes('--fresh');
const iso = (daysAgo = 0) => new Date(Date.now() - daysAgo * 864e5).toISOString();

async function wipe(name) {
  const { deletedCount } = await col[name]().deleteMany({});
  console.log(`  wiped ${name} (${deletedCount})`);
}

/** insertOne and return { id } like the API does */
const add = async (collection, data) => ({ id: (await collection.insertOne(data)).insertedId.toString() });

async function upsertUser(data) {
  const ex = await col.users().findOne({ email: data.email });
  if (ex) return { ...ex, id: ex._id.toString(), existed: true };
  const ref = await add(col.users(), {
    phone: '', avatar: '', address: {}, wishlist: [], blocked: false, demo: true,
    createdAt: iso(), updatedAt: iso(), ...data,
  });
  return { id: ref.id, ...data };
}

async function run() {
  await connectDB();
  console.log(`Seeding MongoDB database "${process.env.MONGODB_DB || 'ceylon_craft'}"...`);
  if (fresh) {
    for (const name of ['categories', 'products', 'banners', 'orders', 'reviews']) await wipe(name);
    const { deletedCount } = await col.users().deleteMany({ demo: true });
    console.log(`  removed ${deletedCount} demo users`);
  } else {
    // Seeding twice would create a second copy of every category, product and banner.
    const existing = (await col.categories().countDocuments()) + (await col.products().countDocuments());
    if (existing) {
      console.log(
        '\nERROR: The database already has categories/products, so nothing was added (it would create duplicates).\n' +
          '  - Start over with fresh demo data:   npm run seed:fresh\n' +
          '  - Remove the demo data:               npm run db:clear:demo\n'
      );
      await closeDB();
      process.exit(1);
    }
  }

  // Admin
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@shop.com').toLowerCase();
  const admin = await upsertUser({
    name: 'Ceylon Craft Collective Admin', email: adminEmail, role: 'admin', demo: false,
    password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10),
  });
  console.log(`  admin ${admin.existed ? 'exists' : 'created'}: ${adminEmail}`);

  // Categories
  const cat = {};
  for (const [i, { key, ...data }] of CATEGORIES.entries()) {
    const ref = await add(col.categories(), { ...data, demo: true, slug: slugify(data.name), active: true, order: i, createdAt: iso(), updatedAt: iso() });
    cat[key] = ref.id;
  }
  console.log(`  ${CATEGORIES.length} categories`);

  // Sellers
  const sellerPw = await bcrypt.hash('Seller@123', 10);
  const shops = {};
  for (const [i, s] of SHOPS.entries()) {
    const u = await upsertUser({
      name: s.owner, email: s.email, password: sellerPw, role: 'seller', phone: s.shop.phone,
      shop: { ...s.shop, slug: slugify(s.shop.name), status: 'approved', note: '', appliedAt: iso(200 - i * 10), approvedAt: iso(195 - i * 10) },
      createdAt: iso(200 - i * 10),
    });
    shops[s.key] = { id: u.id, ...s.shop, slug: slugify(s.shop.name) };
  }
  await upsertUser({
    name: PENDING_SHOP.owner, email: PENDING_SHOP.email, password: sellerPw, role: 'seller', phone: PENDING_SHOP.shop.phone,
    shop: { ...PENDING_SHOP.shop, slug: slugify(PENDING_SHOP.shop.name), status: 'pending', note: '', appliedAt: iso(1) },
    createdAt: iso(1),
  });
  console.log(`  ${SHOPS.length} approved artisan shops + 1 pending application (password Seller@123)`);

  // Customers
  const names = ['Ayesha Silva', 'Kasun Jayasuriya', 'Fathima Nazeer', 'Pradeep Kumar', 'Hiruni Rajapaksha', 'Daniel Mendis', 'Sanduni Herath'];
  const districts = ['Colombo', 'Gampaha', 'Kandy', 'Galle', 'Kurunegala', 'Jaffna', 'Matara'];
  const customerPw = await bcrypt.hash('Customer@123', 10);
  const customers = [];
  for (const [i, n] of names.entries()) {
    const email = `${n.split(' ')[0].toLowerCase()}@demo.lk`;
    const u = await upsertUser({
      name: n, email, password: customerPw, role: 'customer', phone: `07${(i % 8) + 1} ${100 + i * 7} ${4500 + i * 13}`,
      address: { address: `${12 + i} Temple Road`, city: districts[i], district: districts[i], postalCode: `${10000 + i * 111}` },
      createdAt: iso(60 - i * 7),
    });
    customers.push({ ...u, district: districts[i] });
  }
  console.log(`  ${customers.length} customers (password Customer@123)`);

  // Products + reviews
  const products = [];
  for (const [i, [name, shopKey, catKey, price, comparePrice, stock, images, extra]] of P.entries()) {
    const shop = shops[shopKey];
    const created = iso(i * 2.5);
    const myReviews = REVIEWS.slice(i % 4, (i % 4) + 1 + (i % 3));
    const data = {
      demo: true,
      name, slug: slugify(name), categoryId: cat[catKey], price, comparePrice, stock, images,
      shortDescription: `Handmade by ${shop.name} in ${shop.district}.`,
      description:
        `${name} is handcrafted by the artisans of ${shop.name}, ${shop.district}. ` +
        'Because every piece is made by hand, small variations in colour and finish make each one unique.\n\n' +
        'Carefully packed and shipped island-wide. International gifting available on request.',
      sku: `CCC-${String(1000 + i)}`, tags: [catKey, shop.district.toLowerCase(), 'handmade'],
      colors: [], sizes: [], materials: '', dimensions: '', featured: false, isNew: false, active: true,
      sellerId: shop.id, shopName: shop.name, shopSlug: shop.slug, district: shop.district, sellerActive: true,
      rating: Math.round((myReviews.reduce((s, r) => s + r[0], 0) / myReviews.length) * 10) / 10,
      numReviews: myReviews.length, sold: 0, createdAt: created, updatedAt: created, ...extra,
    };
    const ref = await add(col.products(), data);
    products.push({ id: ref.id, ...data });
    for (const [k, [rating, comment]] of myReviews.entries()) {
      const cu = customers[(i + k) % customers.length];
      await add(col.reviews(), { demo: true, productId: ref.id, sellerId: shop.id, userId: cu.id, userName: cu.name, rating, comment, createdAt: iso(i + k) });
    }
  }
  console.log(`  ${products.length} products with reviews`);

  for (const b of BANNERS) await add(col.banners(), { demo: true, textColor: '', active: true, ...b, createdAt: iso() });
  console.log(`  ${BANNERS.length} banners`);

  // Demo orders (some contain items from several artisans)
  const statuses = ['delivered', 'delivered', 'delivered', 'shipped', 'processing', 'pending', 'delivered', 'cancelled'];
  const sold = {};
  for (let i = 0; i < 48; i++) {
    const cu = customers[i % customers.length];
    const lines = Array.from({ length: 1 + (i % 3) }, (_, k) => {
      const p = products[(i * 7 + k * 11) % products.length];
      return {
        productId: p.id, name: p.name, image: p.images[0], price: p.price, quantity: 1 + ((i + k) % 2), color: '', size: '',
        sellerId: p.sellerId, shopName: p.shopName, shopSlug: p.shopSlug,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
    const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
    const status = statuses[i % statuses.length];
    const at = iso(Math.random() * 30);
    const sellerIds = [...new Set(lines.map((l) => l.sellerId))];
    if (status !== 'cancelled') lines.forEach((l) => (sold[l.productId] = (sold[l.productId] || 0) + l.quantity));
    await add(col.orders(), {
      demo: true,
      orderNumber: `CCC-DEMO-${String(i + 1).padStart(4, '0')}`,
      userId: cu.id, customer: { name: cu.name, email: cu.email, phone: cu.phone }, items: lines, sellerIds,
      fulfilment: Object.fromEntries(sellerIds.map((id) => [id, { status, at }])),
      shippingAddress: { fullName: cu.name, phone: cu.phone, address: cu.address.address, city: cu.district, district: cu.district, postalCode: cu.address.postalCode },
      paymentMethod: i % 3 ? 'cod' : 'bank', paymentStatus: status === 'delivered' || i % 3 === 0 ? 'paid' : 'unpaid',
      note: i % 9 === 0 ? 'Please call before delivery.' : '', subtotal, shipping, total: subtotal + shipping, status,
      statusHistory: [{ status: 'pending', at }, ...(status !== 'pending' ? [{ status, at }] : [])],
      createdAt: at, updatedAt: at,
    });
  }
  await Promise.all(Object.entries(sold).map(([id, n]) => col.products().updateOne({ _id: oid(id) }, { $set: { sold: n } })));
  console.log(`  48 demo orders (commission rate ${COMMISSION_RATE * 100}%)`);

  console.log('Done OK');
  await closeDB();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
