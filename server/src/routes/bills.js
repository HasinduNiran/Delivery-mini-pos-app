const express = require('express');
const { mongoose } = require('../db');
const Product = require('../models/product');
const Bill = require('../models/bill');
const Counter = require('../models/counter');
const asyncHandler = require('../middleware/asyncHandler');
const { httpError } = require('../middleware/errorHandler');
const { getPagination, paginated } = require('../utils/pagination');

const router = express.Router();

const round2 = (n) => Math.round(n * 100) / 100;

// POST /api/bills
// Body: { items: [{ productId, qty }], cashReceived }
// Prices/costs are taken from the DB (never trusted from the client), stock is
// validated and decremented, and the bill is created — all atomically.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { items, cashReceived, customerName, clientId } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      throw httpError(400, '"items" must be a non-empty array');
    }
    const cash = Number(cashReceived);
    if (!Number.isFinite(cash) || cash < 0) {
      throw httpError(400, '"cashReceived" must be a number >= 0');
    }
    const customer =
      typeof customerName === 'string' ? customerName.trim() : '';
    const idemKey =
      typeof clientId === 'string' && clientId.trim() ? clientId.trim() : null;

    // Idempotency: if this sale was already recorded (e.g. a queued offline
    // bill being retried after its first response was lost), return the
    // original instead of creating a duplicate.
    if (idemKey) {
      const existing = await Bill.findOne({ clientId: idemKey });
      if (existing) return res.status(200).json(existing.toJSON());
    }

    // Collapse duplicate productIds and validate each line.
    const qtyById = new Map();
    for (const line of items) {
      const id = line?.productId;
      const qty = Number(line?.qty);
      if (!mongoose.isValidObjectId(id)) {
        throw httpError(400, `Invalid productId: ${id}`);
      }
      if (!Number.isInteger(qty) || qty < 1) {
        throw httpError(400, `Invalid qty for product ${id}`);
      }
      qtyById.set(id, (qtyById.get(id) || 0) + qty);
    }

    const session = await mongoose.startSession();
    try {
      let savedBill;
      await session.withTransaction(async () => {
        const ids = [...qtyById.keys()];
        const products = await Product.find({ _id: { $in: ids } }).session(
          session,
        );
        const byId = new Map(products.map((p) => [p.id, p]));

        const billItems = [];
        let total = 0;
        let cost = 0;
        let itemCount = 0;

        for (const [id, qty] of qtyById) {
          const product = byId.get(id);
          if (!product) throw httpError(400, `Product not found: ${id}`);
          if (product.stock < qty) {
            throw httpError(
              409,
              `Insufficient stock for "${product.name}" (have ${product.stock}, need ${qty})`,
            );
          }
          billItems.push({
            productId: product._id,
            name: product.name,
            emoji: product.emoji,
            qty,
            price: product.price,
            costPrice: product.costPrice,
          });
          total += product.price * qty;
          cost += product.costPrice * qty;
          itemCount += qty;
        }

        total = round2(total);
        cost = round2(cost);

        // A short payment is a credit sale (the shortfall is owed), not an
        // error. amountDue tracks the outstanding balance for the ledger.
        const amountDue = round2(Math.max(0, total - cash));
        const status = amountDue > 0 ? 'credit' : 'paid';

        // Decrement stock with a guard so a concurrent sale can't oversell.
        for (const [id, qty] of qtyById) {
          const result = await Product.updateOne(
            { _id: id, stock: { $gte: qty } },
            { $inc: { stock: -qty } },
            { session },
          );
          if (result.modifiedCount !== 1) {
            throw httpError(409, `Stock changed during sale for ${id}, retry`);
          }
        }

        const billNo = await Counter.next('billNo', session);

        const [bill] = await Bill.create(
          [
            {
              billNo,
              clientId: idemKey || undefined,
              items: billItems,
              total,
              cost,
              profit: round2(total - cost),
              cashReceived: round2(cash),
              balance: round2(cash - total),
              amountDue,
              customerName: customer,
              status,
              itemCount,
            },
          ],
          { session },
        );
        savedBill = bill;
      });

      res.status(201).json(savedBill.toJSON());
    } catch (err) {
      // Concurrent retry with the same idempotency key: the unique index
      // rejected the duplicate. Return the bill that did get created.
      if (err && err.code === 11000 && idemKey) {
        const existing = await Bill.findOne({ clientId: idemKey });
        if (existing) return res.status(200).json(existing.toJSON());
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }),
);

// GET /api/bills?page=&limit=  (newest first, paginated)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 20,
    });

    // Optional status filter powers the credit ledger (?status=credit).
    const filter = {};
    if (req.query.status) {
      const statuses = String(req.query.status)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => ['paid', 'credit', 'settled'].includes(s));
      if (statuses.length === 0) throw httpError(400, 'Invalid status filter');
      filter.status = { $in: statuses };
    }

    const [data, total] = await Promise.all([
      Bill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      // estimatedDocumentCount ignores filters; use countDocuments when one is
      // present, otherwise the fast collection-wide estimate.
      Object.keys(filter).length
        ? Bill.countDocuments(filter)
        : Bill.estimatedDocumentCount(),
    ]);
    const mapped = data.map(({ _id, __v, ...rest }) => ({
      id: _id.toString(),
      ...rest,
    }));
    res.json(paginated(mapped, total, page, limit));
  }),
);

// PATCH /api/bills/:id/settle — mark a credit bill as paid in full.
router.patch(
  '/:id/settle',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw httpError(400, 'Invalid bill id');
    }
    const bill = await Bill.findById(req.params.id);
    if (!bill) throw httpError(404, 'Bill not found');
    if (bill.status !== 'credit') {
      throw httpError(409, 'Only credit bills can be settled');
    }
    bill.cashReceived = bill.total;
    bill.balance = 0;
    bill.amountDue = 0;
    bill.status = 'settled';
    bill.settledAt = new Date();
    await bill.save();
    res.json(bill.toJSON());
  }),
);

// GET /api/bills/:id  (single bill, used for reprint)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw httpError(400, 'Invalid bill id');
    }
    const bill = await Bill.findById(req.params.id);
    if (!bill) throw httpError(404, 'Bill not found');
    res.json(bill.toJSON());
  }),
);

module.exports = router;
