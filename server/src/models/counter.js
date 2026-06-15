const { mongoose } = require('../db');

// Atomic sequence generator used for human-readable bill numbers.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "billNo"
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function next(id, session) {
  const doc = await this.findByIdAndUpdate(
    id,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
