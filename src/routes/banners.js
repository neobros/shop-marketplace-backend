import { Router } from 'express';
import { col, findById, oid, toDoc, toDocs } from '../config/db.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { ApiError, asyncHandler, now, pick, required } from '../utils/helpers.js';

const router = Router();
// position: "hero" (main slider) | "promo" (side cards) | "strip" (announcement bar text)
const FIELDS = [
  'title', 'subtitle', 'tag', 'image', 'buttonText', 'link',
  'position', 'bgColor', 'textColor', 'active', 'order',
];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.all !== 'true') filter.active = { $ne: false };
    if (req.query.position) filter.position = String(req.query.position);
    res.json({ banners: toDocs(await col.banners().find(filter).sort({ order: 1 }).toArray()) });
  })
);

router.post(
  '/',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    required(req.body, ['title']);
    const data = {
      position: 'hero',
      active: true,
      order: 0,
      ...pick(req.body, FIELDS),
      createdAt: now(),
      updatedAt: now(),
    };
    const { insertedId } = await col.banners().insertOne(data);
    res.status(201).json({ banner: toDoc({ _id: insertedId, ...data }) });
  })
);

router.put(
  '/:id',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const _id = oid(req.params.id);
    const { matchedCount } = _id
      ? await col.banners().updateOne({ _id }, { $set: { ...pick(req.body, FIELDS), updatedAt: now() } })
      : { matchedCount: 0 };
    if (!matchedCount) throw new ApiError(404, 'Banner not found');
    res.json({ banner: await findById(col.banners(), req.params.id) });
  })
);

router.delete(
  '/:id',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    await col.banners().deleteOne({ _id: oid(req.params.id) });
    res.json({ message: 'Banner deleted' });
  })
);

export default router;
