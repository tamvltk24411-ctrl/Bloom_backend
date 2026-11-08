// models/User.js
const mongoose = require('mongoose');
const { generateBusinessCode } = require('../utils/business-codes');

const userSchema = new mongoose.Schema({
  // 1. Đăng nhập & Phân quyền hệ thống
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'staff', 'customer'], 
    default: 'customer' 
  },
  isActive: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },

  // 2. Hồ sơ thông tin cá nhân
  customId: { type: String, default: '' },
  customerCode: { type: String, unique: true, sparse: true },
  fullName: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  dob: { type: Date, default: null },
  address: { type: String, default: '' },
  avatar: { type: String, default: '' },

  // 3. Phân hạng thành viên & Ví trả trước (Khớp Spec & Dữ liệu cũ)
  membershipTier: { 
    type: String, 
    enum: ['Standard', 'Silver', 'Gold', 'Diamond', 'Bronze', 'VIP'], 
    default: 'Standard' 
  },
  prepaidBalance: { type: Number, default: 0, min: 0 },
  visits: { type: Number, default: 0, min: 0 },
  totalSpent: { type: Number, default: 0, min: 0 },
  lastVisit: { type: Date, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  deletedAt: { type: Date, default: null },
  note: { type: String, default: '' }
}, { 
  timestamps: true 
});

userSchema.pre('save', async function () {
  if (this.isNew && this.role === 'customer' && !this.customerCode) {
    this.customerCode = await generateBusinessCode(
      this.constructor,
      'customerCode',
      'customer',
      sequence => `KH-${String(sequence).padStart(3, '0')}`
    );
  }
});

module.exports = mongoose.model('User', userSchema);