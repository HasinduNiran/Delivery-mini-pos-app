const express = require('express');
const Product = require('../models/product');
const asyncHandler = require('../middleware/asyncHandler');
const { httpError } = require('../middleware/errorHandler');
const { getPagination, paginated } = require('../utils/pagination');

const router = express.Router();

function parseProductBody(body, { partial = false } = {}) {
  const out = {};
  const setNum = (key, { min = 0 } = {}) => {
    if (body[key] === undefined) {
      if (partial) return;
      throw httpError(400, `"${key}" is required`);
    }
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < min) {
      throw httpError(400, `"${key}" must be a number >= ${min}`);
    }
    out[key] = n;
  };

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw httpError(400, '"name" must be a non-empty string');
    }
    out.name = body.name.trim();
  } else if (!partial) {
    throw httpError(400, '"name" is required');
  }

  setNum('price');
  setNum('costPrice');
  setNum('stock');

  if (body.emoji !== undefined) out.emoji = String(body.emoji).trim() || '🛒';
  if (body.active !== undefined) out.active = Boolean(body.active);
  return out;
}

// GET /api/products?page=&limit=&search=&includeInactive=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 50,
    });
    const filter = {};
    if (req.query.includeInactive !== 'true') filter.active = true;
    if (req.query.search) {
      filter.name = { $regex: String(req.query.search).trim(), $options: 'i' };
    }

    const [data, total] = await Promise.all([
      Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
    // .lean() drops the toJSON transform, so map _id -> id manually.
    const mapped = data.map(({ _id, __v, ...rest }) => ({
      id: _id.toString(),
      ...rest,
    }));
    res.json(paginated(mapped, total, page, limit));
  }),
);

// POST /api/products
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseProductBody(req.body);
    const product = await Product.create(data);
    res.status(201).json(product.toJSON());
  }),
);

// PATCH /api/products/:id
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = parseProductBody(req.body, { partial: true });
    const product = await Product.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!product) throw httpError(404, 'Product not found');
    res.json(product.toJSON());
  }),
);

// DELETE /api/products/:id  (soft delete to preserve bill history references)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true },
    );
    if (!product) throw httpError(404, 'Product not found');
    res.json({ ok: true });
  }),
);

module.exports = router;
