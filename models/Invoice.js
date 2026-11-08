const mongoose = require('mongoose');
const { dateParts, generateBusinessCode } = require('../utils/business-codes');

const invoiceSchema = new mongoose.Schema({
  invoiceCode: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['service', 'product'], required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  depositDeduction: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  paidAmount: { type: Number, required: true },
  debtAmount: { type: Number, default: 0 },
  debtStatus: { type: String, enum: ['unpaid', 'partially_paid', 'paid'], default: 'paid' },
  depositId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deposit', default: null },
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'banking', 'card', 'prepaid_wallet'], 
    default: 'cash' 
  },
  status: {
    type: String,
    enum: ['draft', 'issued', 'partially_paid', 'paid', 'voided'],
    default: 'issued'
  }
}, { timestamps: true });

invoiceSchema.pre('save', async function () {
  if (this.isNew && !this.invoiceCode) {
    const { year, month } = dateParts();
    const counterName = `invoice:${year}${month}`;
    this.invoiceCode = await generateBusinessCode(
      this.constructor,
      'invoiceCode',
      counterName,
      sequence => `INV-${year}${month}-${String(sequence).padStart(3, '0')}`
    );
  }
});

module.exports = mongoose.model('Invoice', invoiceSchema);