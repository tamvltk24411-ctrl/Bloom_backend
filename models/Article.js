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
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  isPublished: { type: Boolean, default: undefined }
}, { timestamps: true });

articleSchema.pre('init', function (document) {
  if (document.status === undefined && typeof document.isPublished === 'boolean') {
    document.status = document.isPublished ? 'published' : 'draft';
  }
});

articleSchema.pre('validate', function () {
  if (this.isModified('isPublished') && !this.isModified('status')) {
    this.status = this.isPublished ? 'published' : 'draft';
  }
  this.isPublished = this.status === 'published';
});

module.exports = mongoose.model('Article', articleSchema);