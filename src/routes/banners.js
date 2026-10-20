import { Router } from 'express';
import { col, docData, snapData } from '../config/firebase.js';
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
    let banners = snapData(await col.banners().get());
    if (req.query.all !== 'true') banners = banners.filter((b) => b.active !== false);
    if (req.query.position) banners = banners.filter((b) => b.position === req.query.position);
    banners.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    res.json({ banners });
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
    const ref = await col.banners().add(data);
    res.status(201).json({ banner: { id: ref.id, ...data } });
  })
);

router.put(
  '/:id',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    const ref = col.banners().doc(req.params.id);
    if (!(await ref.get()).exists) throw new ApiError(404, 'Banner not found');
    await ref.update({ ...pick(req.body, FIELDS), updatedAt: now() });
    res.json({ banner: docData(await ref.get()) });
  })
);

router.delete(
  '/:id',
  protect,
  adminOnly,
  asyncHandler(async (req, res) => {
    await col.banners().doc(req.params.id).delete();
    res.json({ message: 'Banner deleted' });
  })
);

export default router;
