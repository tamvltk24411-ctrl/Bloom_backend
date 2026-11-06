const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customId: { type: String, default: '' },
  staffName: { type: String, required: true },
  phone: { type: String, default: '' },
  title: { type: String, default: 'Kỹ thuật viên' },
  specialty: { type: String, default: 'Chăm sóc da' },
  rating: { type: Number, default: 5.0 },
  avatar: { type: String, default: '' },
  status: { type: String, enum: ['working', 'leave'], default: 'working' }
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);