const mongoose = require('mongoose');
const { generateBusinessCode } = require('../utils/business-codes');

const staffSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customId: { type: String, default: '' },
  staffCode: { type: String, unique: true, sparse: true },
  staffName: { type: String, required: true },
  phone: { type: String, default: '' },
  title: { type: String, default: 'Kỹ thuật viên' },
  specialty: { type: String, default: 'Chăm sóc da' },
  rating: { type: Number, default: 5.0 },
  avatar: { type: String, default: '' },
  status: { type: String, enum: ['working', 'leave', 'inactive'], default: 'working' },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

staffSchema.pre('save', async function () {
  if (this.isNew && !this.staffCode) {
    this.staffCode = await generateBusinessCode(
      this.constructor,
      'staffCode',
      'staff',
      sequence => `ST-${String(sequence).padStart(3, '0')}`
    );
  }
});

module.exports = mongoose.model('Staff', staffSchema);