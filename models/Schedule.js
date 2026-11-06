const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true }, // Format YYYY-MM-DD
  shift: { type: String, enum: ['sang', 'chieu', 'toi'], required: true },
  isOff: { type: Boolean, default: false },
  maxCapacity: { type: Number, default: 8 }
}, { timestamps: true });

module.exports = mongoose.model('Schedule', scheduleSchema);