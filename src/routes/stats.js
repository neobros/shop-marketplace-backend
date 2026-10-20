import { Router } from 'express';
import { col, snapData } from '../config/firebase.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';
import { COMMISSION_RATE } from '../config/shop.js';

const router = Router();

// GET /api/admin/stats?days=30 — dashboard numbers
router.get(
  '/stats',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 30));
    const [orders, products, users, categories] = await Promise.all([
      col.orders().get().then(snapData),
      col.products().get().then(snapData),
      col.users().select('role', 'createdAt', 'shop', 'name').get().then(snapData),
      col.categories().get().then(snapData),
    ]);

    const valid = orders.filter((o) => o.status !== 'cancelled');
    const revenue = valid.reduce((s, o) => s + (o.total || 0), 0);

    // Daily revenue/orders for the chart
    const series = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      series.push({ date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 });
    }
    const byDate = Object.fromEntries(series.map((s) => [s.date, s]));
    valid.forEach((o) => {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      if (byDate[key]) {
        byDate[key].revenue += o.total;
        byDate[key].orders += 1;
      }
    });

    // Compare this period vs previous period
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - days + 1);
    const prevCutoff = new Date(cutoff);
    prevCutoff.setDate(prevCutoff.getDate() - days);
    const inRange = (o, a, b) => {
      const t = new Date(o.createdAt);
      return t >= a && (!b || t < b);
    };
    const cur = valid.filter((o) => inRange(o, cutoff));
    const prev = valid.filter((o) => inRange(o, prevCutoff, cutoff));
    const pct = (a, b) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 1000) / 10);
    const sum = (arr) => arr.reduce((s, o) => s + o.total, 0);

    const statusCounts = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => ({
      status: s,
      count: orders.filter((o) => o.status === s).length,
    }));

    const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const salesByCategory = {};
    products.forEach((p) => {
      const n = catName[p.categoryId] || 'Other';
      salesByCategory[n] = (salesByCategory[n] || 0) + (p.sold || 0) * p.price;
    });

    // Seller (artisan) figures
    const sellers = users.filter((u) => u.role === 'seller');
    const sellerRevenue = {};
    valid.forEach((o) =>
      o.items.forEach((i) => {
        if (i.sellerId) sellerRevenue[i.sellerId] = (sellerRevenue[i.sellerId] || 0) + i.price * i.quantity;
      })
    );
    const marketplaceSales = Object.values(sellerRevenue).reduce((s, v) => s + v, 0);

    res.json({
      sellers: {
        approved: sellers.filter((u) => u.shop?.status === 'approved').length,
        pending: sellers.filter((u) => u.shop?.status === 'pending').length,
        commissionRate: COMMISSION_RATE,
        commissionEarned: Math.round(marketplaceSales * COMMISSION_RATE),
        top: sellers
          .filter((u) => sellerRevenue[u.id])
          .map((u) => ({ id: u.id, name: u.shop.name, slug: u.shop.slug, logo: u.shop.logo, district: u.shop.district, revenue: sellerRevenue[u.id] }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
        pendingList: sellers
          .filter((u) => u.shop?.status === 'pending')
          .map((u) => ({ id: u.id, name: u.shop.name, owner: u.name, craft: u.shop.craft, district: u.shop.district, appliedAt: u.shop.appliedAt }))
          .slice(0, 5),
      },
      totals: {
        revenue,
        orders: orders.length,
        products: products.length,
        customers: users.filter((u) => u.role === 'customer').length,
        avgOrderValue: valid.length ? revenue / valid.length : 0,
      },
      period: {
        days,
        revenue: sum(cur),
        revenueChange: pct(sum(cur), sum(prev)),
        orders: cur.length,
        ordersChange: pct(cur.length, prev.length),
        newCustomers: users.filter((u) => u.role === 'customer' && new Date(u.createdAt) >= cutoff).length,
      },
      series,
      statusCounts,
      salesByCategory: Object.entries(salesByCategory)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value),
      topProducts: [...products]
        .sort((a, b) => (b.sold || 0) - (a.sold || 0))
        .slice(0, 5)
        .map(({ id, name, images, price, sold, stock }) => ({ id, name, image: images?.[0], price, sold: sold || 0, stock })),
      lowStock: products
        .filter((p) => (p.stock ?? 0) <= 5)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6)
        .map(({ id, name, images, stock }) => ({ id, name, image: images?.[0], stock })),
      recentOrders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    });
  })
);

export default router;
