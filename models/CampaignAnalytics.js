const mongoose = require('mongoose');

const campaignAnalyticsSchema = new mongoose.Schema({
  season: { type: String, enum: ['Xuan', 'He', 'Thu', 'Dong', 'Tet'], required: true },
  targetSegment: { type: String, required: true },
  predictedRevenue: { type: Number, default: 0 },
  suggestedServices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  customerBehaviorInsights: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('CampaignAnalytics', campaignAnalyticsSchema);