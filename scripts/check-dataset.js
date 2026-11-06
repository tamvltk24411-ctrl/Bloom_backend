// check-dataset.js
const fs = require('fs');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

function inspectDataset() {
  let datasetObj = {};
  try {
    const importedModule = require(path.join(PROJECT_ROOT, 'seed-data', 'bloom_dataset_export.js'));
    datasetObj = importedModule.BLOOM_DATASET || importedModule.default || importedModule;
  } catch (err) {
    const filePath = path.join(PROJECT_ROOT, 'seed-data', 'bloom_dataset_export.js');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonMatch = fileContent.match(/=\{([\s\S]*)\};?$/) || fileContent.match(/export default ([\s\S]*);?$/);
    if (jsonMatch) datasetObj = JSON.parse('{' + jsonMatch[1] + '}');
  }

  console.log("=== KIỂM TRA DỮ LIỆU THỰC TẾ TRONG FILE EXPORT ===");
  
  // Quét theo các keyName
  const items = datasetObj.items || [];
  if (items.length > 0) {
    items.forEach(item => {
      const dataLength = Array.isArray(item.data) ? item.data.length : (item.data ? 1 : 0);
      console.log(`- Key: ${item.keyName.padEnd(25)} | Số lượng record: ${dataLength}`);
    });
  } else if (datasetObj.sources && datasetObj.sources.localStorage) {
    const ls = datasetObj.sources.localStorage;
    Object.keys(ls).forEach(key => {
      const val = ls[key].value || ls[key];
      const dataLength = Array.isArray(val) ? val.length : (val ? 1 : 0);
      console.log(`- Key: ${key.padEnd(25)} | Số lượng record: ${dataLength}`);
    });
  } else {
    Object.keys(datasetObj).forEach(key => {
      const val = datasetObj[key];
      const dataLength = Array.isArray(val) ? val.length : (val ? 1 : 0);
      console.log(`- Key: ${key.padEnd(25)} | Số lượng record: ${dataLength}`);
    });
  }
}

inspectDataset();