const mongoose = require('mongoose');

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
  paidAmount: { type: Number, required: true },
  debtAmount: { type: Number, default: 0 },
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'banking', 'card', 'prepaid_wallet'], 
    default: 'cash' 
  },
  status: { type: String, enum: ['paid', 'draft'], default: 'paid' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);