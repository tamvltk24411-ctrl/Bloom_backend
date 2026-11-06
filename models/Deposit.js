const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  depositAmount: { type: Number, required: true },
  depositStatus: { type: String, enum: ['held', 'refunded', 'settled'], default: 'held' },
  note: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Deposit', depositSchema);