const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingCode: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  appointmentDate: { type: String, required: true }, // Dạng YYYY-MM-DD
  appointmentTime: { type: String, required: true }, // Dạng HH:mm
  depositAmount: { type: Number, default: 0 },
  note: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'in_treatment', 'completed', 'cancelled'], 
    default: 'pending' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);