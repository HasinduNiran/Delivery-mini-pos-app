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

// ---- helpers ---------------------------------------------------------------

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Case-insensitive exact match on a customer name (ignores surrounding space).
const exactName = (name) =>
  new RegExp(`^\\s*${escapeRegex(String(name).trim())}\\s*$`, 'i');

const mapLean = ({ _id, __v, ...rest }) => ({ id: _id.toString(), ...rest });

function parseDate(value, name) {
  if (value === undefined || value === '') return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw httpError(400, `Invalid "${name}" date`);
  return d;
}

// Builds the Mongo filter for bill listings from query params:
//   status=paid,credit,settled   search=<bill no | INV-2026-007 | name>
//   customer=<exact name>        from=<ISO>  to=<ISO>
function buildBillFilter(query) {
  const filter = {};
  if (query.status) {
    const statuses = String(query.status)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => ['paid', 'credit', 'settled'].includes(s));
    if (statuses.length === 0) throw httpError(400, 'Invalid status filter');
    filter.status = { $in: statuses };
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    // "12", "#12" or "INV-2026-012" all find bill number 12.
    const numMatch = search.match(/^(?:#|inv-\d{4}-)?0*(\d+)$/i);
    const or = [{ customerName: { $regex: escapeRegex(search), $options: 'i' } }];
    if (numMatch) or.push({ billNo: Number(numMatch[1]) });
    filter.$or = or;
  }

  if (query.customer !== undefined) {
    const name = String(query.customer).trim();
    filter.customerName = name ? exactName(name) : { $in: ['', null] };
  }

  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  return filter;
}

// Group key so "Widura Stores" and "widura stores " count as one customer.
const customerKey = {
  $toLower: { $trim: { input: { $ifNull: ['$customerName', ''] } } },
};

// Mutates a credit bill to record `amount` received now.
function applyPayment(bill, amount, at = new Date()) {
  bill.cashReceived = round2(bill.cashReceived + amount);
  bill.amountDue = round2(Math.max(0, bill.amountDue - amount));
  bill.balance = round2(bill.cashReceived - bill.total);
  bill.payments = [...(bill.payments || []), { amount, at }];
  if (bill.amountDue <= 0) {
    bill.amountDue = 0;
    bill.status = 'settled';
    bill.settledAt = at;
  }
}

// ---- list ------------------------------------------------------------------

// GET /api/bills?page=&limit=&status=&search=&customer=&from=&to=
// Newest first, paginated. `summary` totals the whole filtered set (not just
// the page) so screens can show accurate sales / outstanding figures.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 20,
    });
    const filter = buildBillFilter(req.query);

    const [data, agg] = await Promise.all([
      Bill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Bill.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: '$total' },
            profit: { $sum: '$profit' },
            due: { $sum: '$amountDue' },
          },
        },
      ]),
    ]);
    const s = agg[0] || { count: 0, total: 0, profit: 0, due: 0 };
    res.json({
      ...paginated(data.map(mapLean), s.count, page, limit),
      summary: {
        count: s.count,
        total: round2(s.total),
        profit: round2(s.profit),
        due: round2(s.due),
      },
    });
  }),
);

// ---- credit ledger ---------------------------------------------------------

// GET /api/bills/credit/customers?page=&limit=&search=
// Outstanding credit grouped per customer (largest debt first), plus overall
// totals across every unpaid bill.
router.get(
  '/credit/customers',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 20,
    });
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const match = { status: 'credit' };

    const [listAgg, totalsAgg] = await Promise.all([
      Bill.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: customerKey,
            name: { $first: '$customerName' },
            due: { $sum: '$amountDue' },
            total: { $sum: '$total' },
            bills: { $sum: 1 },
            oldest: { $min: '$createdAt' },
            latest: { $max: '$createdAt' },
          },
        },
        ...(search
          ? [{ $match: { name: { $regex: escapeRegex(search), $options: 'i' } } }]
          : []),
        { $sort: { due: -1, _id: 1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            count: [{ $count: 'n' }],
          },
        },
      ]),
      Bill.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            due: { $sum: '$amountDue' },
            bills: { $sum: 1 },
            customers: { $addToSet: customerKey },
          },
        },
      ]),
    ]);

    const rows = listAgg[0].data.map((r) => ({
      key: r._id,
      name: (r.name || '').trim(),
      due: round2(r.due),
      total: round2(r.total),
      bills: r.bills,
      oldest: r.oldest,
      latest: r.latest,
    }));
    const count = listAgg[0].count[0]?.n || 0;
    const t = totalsAgg[0];
    res.json({
      ...paginated(rows, count, page, limit),
      summary: {
        due: round2(t?.due || 0),
        bills: t?.bills || 0,
        customers: t ? t.customers.length : 0,
      },
    });
  }),
);

// POST /api/bills/credit/customers/pay  { name, amount }
// Records a lump-sum payment from a customer, clearing their oldest unpaid
// bills first. Returns how it was applied and what is still owed.
router.post(
  '/credit/customers/pay',
  asyncHandler(async (req, res) => {
    const { name, amount } = req.body || {};
    if (typeof name !== 'string') throw httpError(400, '"name" is required');
    const pay = round2(Number(amount));
    if (!Number.isFinite(pay) || pay <= 0) {
      throw httpError(400, '"amount" must be a number > 0');
    }
    const nameFilter = name.trim() ? exactName(name) : { $in: ['', null] };

    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const bills = await Bill.find({
          status: 'credit',
          customerName: nameFilter,
        })
          .sort({ createdAt: 1 })
          .session(session);
        if (bills.length === 0) {
          throw httpError(404, 'No unpaid bills for this customer');
        }
        const owed = round2(bills.reduce((sum, b) => sum + b.amountDue, 0));
        if (pay > owed + 0.001) {
          throw httpError(
            400,
            `Amount is more than the outstanding Rs. ${owed.toFixed(2)}`,
          );
        }

        let left = pay;
        const applied = [];
        const now = new Date();
        for (const bill of bills) {
          if (left <= 0) break;
          const part = round2(Math.min(left, bill.amountDue));
          applyPayment(bill, part, now);
          await bill.save({ session });
          applied.push({
            id: bill.id,
            billNo: bill.billNo,
            amount: part,
            settled: bill.status === 'settled',
          });
          left = round2(left - part);
        }
        result = { applied, paid: pay, remaining: round2(owed - pay) };
      });
      res.json(result);
    } finally {
      await session.endSession();
    }
  }),
);

// GET /api/bills/customers?search=&limit=
// Known customer names (most recently used first) for name suggestions.
router.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const match = search
      ? { customerName: { $regex: escapeRegex(search), $options: 'i' } }
      : { customerName: { $nin: ['', null] } };
    const rows = await Bill.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: customerKey,
          name: { $first: '$customerName' },
          last: { $max: '$createdAt' },
        },
      },
      { $sort: { last: -1 } },
      { $limit: limit },
    ]);
    res.json({ data: rows.map((r) => r.name.trim()).filter(Boolean) });
  }),
);

// POST /api/bills/:id/payments  { amount }  — partial or full credit payment.
router.post(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw httpError(400, 'Invalid bill id');
    }
    const pay = round2(Number(req.body?.amount));
    if (!Number.isFinite(pay) || pay <= 0) {
      throw httpError(400, '"amount" must be a number > 0');
    }
    const bill = await Bill.findById(req.params.id);
    if (!bill) throw httpError(404, 'Bill not found');
    if (bill.status !== 'credit') {
      throw httpError(409, 'This bill has no balance due');
    }
    if (pay > bill.amountDue + 0.001) {
      throw httpError(
        400,
        `Amount is more than the balance due Rs. ${bill.amountDue.toFixed(2)}`,
      );
    }
    applyPayment(bill, Math.min(pay, bill.amountDue));
    await bill.save();
    res.json(bill.toJSON());
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
    applyPayment(bill, bill.amountDue);
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
