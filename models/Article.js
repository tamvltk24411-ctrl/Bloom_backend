const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  category: { 
    type: String, 
    enum: ['dieu-tri-mun', 'dieu-tri-nam', 'dieu-tri-seo', 'cham-soc-da', 'cong-nghe', 'chong-lao-hoa'],
    required: true 
  },
  authorStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  summary: { type: String, required: true },
  contentHtml: { type: String, required: true },
  thumbnail: { type: String, default: '' },
  isPublished: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Article', articleSchema);