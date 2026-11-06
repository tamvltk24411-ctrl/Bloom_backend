const mongoose = require('mongoose');

const skinAnalysisSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  analyzedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  skinType: { type: String, default: 'Da thường' },
  tags: [{ type: String }],
  notes: { type: String, default: '' },
  recommendedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  recommendedServices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }]
}, { timestamps: true });

module.exports = mongoose.model('SkinAnalysis', skinAnalysisSchema);