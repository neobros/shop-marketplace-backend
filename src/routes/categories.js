import { Router } from 'express';
import { col, findById, oid, toDoc, toDocs } from '../config/db.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now, pick, required, slugify } from '../utils/helpers.js';

const router = Router();
const FIELDS = ['name', 'description', 'image', 'icon', 'active', 'order'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = req.query.all === 'true' ? {} : { active: { $ne: false } };
    const [cats, counts] = await Promise.all([
      col.categories().find(filter).sort({ order: 1, name: 1 }).toArray(),
      col.products()
        .aggregate([
          { $match: { active: { $ne: false }, sellerActive: { $ne: false } } },
          { $group: { _id: '$categoryId', n: { $sum: 1 } } },
        ])
        .toArray(),
    ]);
    const countOf = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    res.json({ categories: toDocs(cats).map((c) => ({ ...c, productCount: countOf[c.id] || 0 })) });
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
    const { insertedId } = await col.categories().insertOne(data);
    res.status(201).json({ category: toDoc({ _id: insertedId, ...data }) });
  })
);

router.put(
  '/:id',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const _id = oid(req.params.id);
    const updates = { ...pick(req.body, FIELDS), updatedAt: now() };
    if (updates.name) updates.slug = slugify(updates.name);
    const { matchedCount } = _id ? await col.categories().updateOne({ _id }, { $set: updates }) : { matchedCount: 0 };
    if (!matchedCount) throw new ApiError(404, 'Category not found');
    res.json({ category: await findById(col.categories(), req.params.id) });
  })
);

router.delete(
  '/:id',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    if (await col.products().findOne({ categoryId: req.params.id }, { projection: { _id: 1 } }))
      throw new ApiError(400, 'Category has products. Move or delete them first.');
    await col.categories().deleteOne({ _id: oid(req.params.id) });
    res.json({ message: 'Category deleted' });
  })
);

export default router;
