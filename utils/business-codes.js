const BusinessCounter = require('../models/BusinessCounter');

function dateParts(date = new Date()) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return { year, month, day };
}

async function nextSequence(counterName) {
  const counter = await BusinessCounter.findOneAndUpdate(
    { _id: counterName },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return counter.sequence;
}

async function generateBusinessCode(Model, field, counterName, formatCode) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const sequence = await nextSequence(counterName);
    const code = formatCode(sequence);
    if (!await Model.exists({ [field]: code })) {
      return code;
    }
  }

  throw new Error(`Không thể tạo mã nghiệp vụ duy nhất cho ${field}.`);
}

module.exports = { dateParts, generateBusinessCode };
