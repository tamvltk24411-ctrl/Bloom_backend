const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  customId: { type: String, default: '' },
  serviceName: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  categoryGroup: { 
    type: String, 
    enum: ['dieu-tri-da', 'cham-soc-da', 'tre-hoa-nang-co', 'triet-long'],
    required: true 
  },
  price: { type: Number, required: true, default: 0 },
  durationMinutes: { type: Number, default: 60 },
  description: { type: String, default: '' },
  detail: { type: String, default: '' },
  image: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);