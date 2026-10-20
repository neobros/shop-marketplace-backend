import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import './config/firebase.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import bannerRoutes from './routes/banners.js';
import orderRoutes from './routes/orders.js';
import userRoutes from './routes/users.js';
import statsRoutes from './routes/stats.js';
import sellerRoutes from './routes/sellers.js';
import sellerPanelRoutes from './routes/sellerPanel.js';
import { DISTRICTS, FREE_SHIPPING_OVER, SHIPPING_FLAT, COMMISSION_RATE } from './config/shop.js';
import { errorHandler, notFound } from './middleware/error.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Add it to .env (local) or the Vercel project environment variables.');
}

/** The Express app — started by src/server.js locally, and by api/index.js on Vercel. */
const app = express();
const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim().replace(/\/$/, ''));

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.VERCEL ? 'tiny' : 'dev'));

app.get('/', (_req, res) => res.json({ name: 'Ceylon Craft Collective API', health: '/api/health' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', statsRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/seller', sellerPanelRoutes);
app.get('/api/config', (_req, res) =>
  res.json({ currency: 'LKR', shippingFlat: SHIPPING_FLAT, freeShippingOver: FREE_SHIPPING_OVER, commissionRate: COMMISSION_RATE, districts: DISTRICTS })
);

app.use(notFound);
app.use(errorHandler);

export default app;
