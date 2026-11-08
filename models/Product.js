const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productCode: { type: String, required: true, unique: true },
  productName: { type: String, required: true },
  price: { type: Number, required: true },
  costPrice: { type: Number, default: 0 },
  stockQuantity: { type: Number, default: 0 },
  unit: { type: String, default: 'Chai' },
  image: { type: String, default: '' },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);