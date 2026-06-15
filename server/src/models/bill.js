const { mongoose } = require('../db');

// Each line snapshots the price/cost at sale time so historical bills stay
// accurate even after a product's price later changes.
const billItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    emoji: { type: String, default: '🛒' },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // retail at sale time
    costPrice: { type: Number, required: true, min: 0 }, // cost at sale time
  },
  { _id: false },
);

const billSchema = new mongoose.Schema(
  {
    billNo: { type: Number, required: true, unique: true },
    // Client-generated idempotency key. Lets a retried/queued offline sale be
    // recognized as the same bill instead of creating a duplicate on sync.
    clientId: { type: String, default: undefined },
    items: { type: [billItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 }, // total cost of goods
    profit: { type: Number, required: true }, // total - cost
    cashReceived: { type: Number, required: true, min: 0 },
    balance: { type: Number, required: true }, // cashReceived - total (negative = owed)
    amountDue: { type: Number, required: true, min: 0, default: 0 }, // outstanding credit
    customerName: { type: String, trim: true, default: '' }, // for credit bills
    // 'paid'    — settled in full at sale time
    // 'credit'  — sold on credit, balance still outstanding
    // 'settled' — was credit, manually marked paid later
    status: {
      type: String,
      enum: ['paid', 'credit', 'settled'],
      required: true,
      default: 'paid',
    },
    settledAt: { type: Date }, // when a credit bill was marked paid
    itemCount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

// Newest-first listing is the common query — index supports pagination.
billSchema.index({ createdAt: -1 });
billSchema.index({ billNo: -1 });
// Credit ledger: list outstanding bills newest-first.
billSchema.index({ status: 1, createdAt: -1 });
// Idempotency: at most one bill per client key (sparse so cash sales without
// a key are unaffected).
billSchema.index({ clientId: 1 }, { unique: true, sparse: true });

billSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Bill', billSchema);
