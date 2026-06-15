const { mongoose } = require('../db');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 }, // retail / selling
    costPrice: { type: Number, required: true, min: 0 }, // purchase cost (GRN)
    stock: { type: Number, required: true, min: 0, default: 0 },
    emoji: { type: String, default: '🛒', trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Text-ish search on name and fast catalog listing.
productSchema.index({ name: 1 });
productSchema.index({ active: 1, createdAt: -1 });

productSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Product', productSchema);
