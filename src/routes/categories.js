import { Router } from 'express';
import { col, docData, snapData } from '../config/firebase.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now, pick, required, slugify } from '../utils/helpers.js';

const router = Router();
const FIELDS = ['name', 'description', 'image', 'icon', 'active', 'order'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let cats = snapData(await col.categories().get());
    if (req.query.all !== 'true') cats = cats.filter((c) => c.active !== false);
    const products = snapData(await col.products().select('categoryId', 'active').get());
    cats = cats
      .map((c) => ({
        ...c,
        productCount: products.filter((p) => p.categoryId === c.id && p.active !== false).length,
      }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
    res.json({ categories: cats });
  })
);

router.post(
  '/',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    required(req.body, ['name']);
    const data = {
      active: true,
      order: 0,
      ...pick(req.body, FIELDS),
      slug: slugify(req.body.name),
      createdAt: now(),
      updatedAt: now(),
    };
    const ref = await col.categories().add(data);
    res.status(201).json({ category: { id: ref.id, ...data } });
  })
);

router.put(
  '/:id',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const ref = col.categories().doc(req.params.id);
    if (!(await ref.get()).exists) throw new ApiError(404, 'Category not found');
    const updates = { ...pick(req.body, FIELDS), updatedAt: now() };
    if (updates.name) updates.slug = slugify(updates.name);
    await ref.update(updates);
    res.json({ category: docData(await ref.get()) });
  })
);

router.delete(
  '/:id',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const used = await col.products().where('categoryId', '==', req.params.id).limit(1).get();
    if (!used.empty) throw new ApiError(400, 'Category has products. Move or delete them first.');
    await col.categories().doc(req.params.id).delete();
    res.json({ message: 'Category deleted' });
  })
);

export default router;
