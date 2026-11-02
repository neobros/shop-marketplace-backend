import { MongoClient, ObjectId } from 'mongodb';

/**
 * MongoDB connection (official driver).
 * The client promise is cached on globalThis so serverless platforms (Vercel) reuse one connection
 * across invocations instead of opening a new one per request.
 */
const DB_NAME = process.env.MONGODB_DB || 'ceylon_craft';

let db = null;

async function createIndexes(database) {
  await Promise.all([
    database.collection('users').createIndexes([
      { key: { email: 1 }, unique: true },
      { key: { role: 1 } },
      { key: { 'shop.slug': 1 } },
    ]),
    database.collection('categories').createIndexes([{ key: { slug: 1 } }, { key: { order: 1 } }]),
    database.collection('products').createIndexes([
      { key: { slug: 1 } },
      { key: { categoryId: 1 } },
      { key: { sellerId: 1 } },
      { key: { shopSlug: 1 } },
      { key: { district: 1 } },
      { key: { createdAt: -1 } },
      { key: { sold: -1 } },
    ]),
    database.collection('orders').createIndexes([
      { key: { userId: 1, createdAt: -1 } },
      { key: { sellerIds: 1 } },
      { key: { createdAt: -1 } },
    ]),
    database.collection('reviews').createIndexes([
      { key: { productId: 1, userId: 1 }, unique: true },
      { key: { sellerId: 1 } },
    ]),
    database.collection('banners').createIndexes([{ key: { position: 1, order: 1 } }]),
  ]);
}

export async function connectDB() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add your MongoDB connection string to .env (or the Vercel environment variables).');
  }
  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 });
    globalThis._mongoClientPromise = client.connect().then(async (c) => {
      await createIndexes(c.db(DB_NAME));
      return c;
    });
    // allow a retry on the next request if the first connection attempt fails
    globalThis._mongoClientPromise.catch(() => (globalThis._mongoClientPromise = null));
  }
  const client = await globalThis._mongoClientPromise;
  db = client.db(DB_NAME);
  return db;
}

export async function closeDB() {
  if (globalThis._mongoClientPromise) {
    const client = await globalThis._mongoClientPromise;
    await client.close();
    globalThis._mongoClientPromise = null;
    db = null;
  }
}

const getDb = () => {
  if (!db) throw new Error('Database not connected — call connectDB() first');
  return db;
};

export const col = {
  users: () => getDb().collection('users'),
  categories: () => getDb().collection('categories'),
  products: () => getDb().collection('products'),
  banners: () => getDb().collection('banners'),
  orders: () => getDb().collection('orders'),
  reviews: () => getDb().collection('reviews'),
};

/** String id -> ObjectId, or null when the string isn't a valid id. */
export const oid = (id) => {
  if (id instanceof ObjectId) return id;
  return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
};

/** Mongo document -> API object with a string `id` (and no `_id`). */
export const toDoc = (d) => {
  if (!d) return null;
  const { _id, ...rest } = d;
  return { id: _id.toString(), ...rest };
};
export const toDocs = (arr) => arr.map(toDoc);

/** Find one document by its string id. */
export const findById = async (collection, id, options) => {
  const _id = oid(id);
  return _id ? toDoc(await collection.findOne({ _id }, options)) : null;
};

/** Escape user input for use inside a RegExp. */
export const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export { ObjectId };
