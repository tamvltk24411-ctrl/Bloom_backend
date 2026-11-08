const mongoose = require('mongoose');

const businessCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 }
}, { versionKey: false });

module.exports = mongoose.models.BusinessCounter ||
  mongoose.model('BusinessCounter', businessCounterSchema);
