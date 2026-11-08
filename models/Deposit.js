const mongoose = require('mongoose');
const { generateBusinessCode } = require('../utils/business-codes');

const depositSchema = new mongoose.Schema({
  depositCode: { type: String, required: true, unique: true, sparse: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  depositAmount: { type: Number, min: 0 },
  depositStatus: { type: String, enum: ['held', 'refunded', 'settled'], default: 'held' },
  note: { type: String, default: '' }
}, { timestamps: true });

depositSchema.pre('init', function (document) {
  if (document.amount === undefined && document.depositAmount !== undefined) {
    document.amount = document.depositAmount;
  }
});

depositSchema.pre('validate', function () {
  if (this.amount === undefined && this.depositAmount !== undefined) {
    this.amount = this.depositAmount;
  }
  if (this.amount !== undefined) {
    this.depositAmount = undefined;
  }
});

depositSchema.pre('save', async function () {
  if (this.isNew && !this.depositCode) {
    this.depositCode = await generateBusinessCode(
      this.constructor,
      'depositCode',
      'deposit',
      sequence => `COC-${String(sequence).padStart(3, '0')}`
    );
  }
});

module.exports = mongoose.model('Deposit', depositSchema);