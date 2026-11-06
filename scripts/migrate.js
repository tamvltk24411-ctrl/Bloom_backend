const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });
require('dotenv').config({ path: path.join(PROJECT_ROOT, 'atlas-credentials.env') });

const SALT_ROUNDS = 10;
const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
const hashPassword = async (value) => (
  isBcryptHash(value) ? value : bcrypt.hash(value, SALT_ROUNDS)
);

const User = require('../models/User');
const Staff = require('../models/Staff');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const CustomerTreatment = require('../models/CustomerTreatment');
const SkinAnalysis = require('../models/SkinAnalysis');
const Product = require('../models/Product');

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_USERNAME = (process.env.BLOOM_ADMIN_USERNAME || 'admin').trim();
const ADMIN_PASSWORD = process.env.BLOOM_ADMIN_PASSWORD;

async function insertIfMissing(model, filter, document) {
  return model.findOneAndUpdate(
    filter,
    { $setOnInsert: document },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
}

function mapSourceId(map, source, value) {
  for (const key of [source.id, source._id, source.customId, source.username]) {
    if (key !== undefined && key !== null && key !== '') {
      map[String(key)] = value;
    }
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function loadDataset() {
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

  const rawData = {};
  if (datasetObj && Array.isArray(datasetObj.items)) {
    datasetObj.items.forEach(item => { if (item.keyName) rawData[item.keyName] = { value: item.data }; });
  } else if (datasetObj && typeof datasetObj === 'object') {
    Object.keys(datasetObj).forEach(key => {
      const val = datasetObj[key];
      rawData[key] = { value: Array.isArray(val) ? val : (val?.value || val) };
    });
  }
  return rawData;
}

async function migrateData() {
  try {
    if (!MONGODB_URI) {
      throw new Error('Thiếu MONGODB_URI. Hãy cấu hình biến này trong .env.');
    }

    await mongoose.connect(MONGODB_URI);
    console.log("--> Kết nối thành công tới MongoDB Atlas!");

    const rawData = loadDataset();
    const idMap = {
      users: Object.create(null),
      staff: Object.create(null),
      services: Object.create(null)
    };
    const existingAdmin = await User.findOne({ role: 'admin' }).lean();
    const rawUsers = toArray(rawData.bloom_user?.value);
    const rawCustomers = toArray(rawData.bloom_customers?.value);
    const hasDatasetAdmin = rawUsers.some(user => user?.role?.toLowerCase() === 'admin');

    if (hasDatasetAdmin && !existingAdmin && !ADMIN_PASSWORD) {
      throw new Error(
        'Chưa có admin trong database. Hãy đặt BLOOM_ADMIN_PASSWORD để tạo admin rồi chạy lại.'
      );
    }

    console.log("\n--> Import an toàn: chỉ thêm bản ghi còn thiếu, không xóa hoặc ghi đè dữ liệu hiện có.");

    // 1. MIGRATE USERS (Gộp 1 User Admin + 28 Customers)
    const aiSegments = rawData['AIEngine.segmentAll']?.value || [];

    for (let userIdx = 0; userIdx < rawUsers.length; userIdx++) {
      const u = rawUsers[userIdx];
      if (!u) continue;
      const isAdmin = u.role?.toLowerCase() === 'admin';
      const sourceKey = u.id || u._id || u.username || `source-user-${userIdx}`;
      const sourceUsername = isAdmin
        ? ADMIN_USERNAME
        : (u.username || u.email || `staff_${sourceKey}`);
      const newUser = isAdmin && existingAdmin
        ? existingAdmin
        : await insertIfMissing(
          User,
          { username: sourceUsername },
          {
            username: sourceUsername,
            password: await hashPassword(isAdmin ? ADMIN_PASSWORD : (u.password || '123456')),
            fullName: u.fullName || u.name || 'Quản trị viên',
            phone: u.phone || '',
            role: isAdmin ? 'admin' : 'staff',
            isActive: true
          }
        );
      mapSourceId(idMap.users, u, newUser._id);
    }

    let cusIdx = 0;
    for (const c of rawCustomers) {
      if (!c) continue;
      const aiSegmentData = aiSegments[cusIdx] ? JSON.stringify(aiSegments[cusIdx]) : '';
      
      const customerUsername = String(c.phone || `cus_${c.id || cusIdx}`).trim();
      const customerCustomId = c.customId || c.id || `CUS_${cusIdx}`;
      const identityFilters = [{ username: customerUsername }];
      if (c.phone) identityFilters.push({ phone: c.phone });
      if (c.email) identityFilters.push({ email: c.email.trim().toLowerCase() });
      if (customerCustomId) identityFilters.push({ customId: customerCustomId });
      const newUser = await insertIfMissing(
        User,
        { $or: identityFilters },
        {
          username: customerUsername,
          password: await hashPassword('123456'),
          role: 'customer',
          customId: customerCustomId,
          fullName: c.name || 'Khách hàng Bloom',
          phone: c.phone || `09000000${cusIdx}`,
          email: c.email || '',
          dob: c.dob ? new Date(c.dob) : null,
          address: c.address || '',
          membershipTier: ['Standard', 'Silver', 'Gold', 'Diamond', 'Bronze', 'VIP'].includes(c.rank) ? c.rank : 'Standard',
          prepaidBalance: c.prepaidBalance || 0,
          visits: c.visits || 0,
          totalSpent: c.totalSpent || 0,
          lastVisit: c.lastVisit ? new Date(c.lastVisit) : null,
          note: (c.note || '') + (aiSegmentData ? ` | AI Segment: ${aiSegmentData}` : '')
        }
      );
      mapSourceId(idMap.users, c, newUser._id);
      cusIdx++;
    }
    console.log(`[✔] Đã kiểm tra ${Object.keys(idMap.users).length} Users (bản ghi đã có được giữ nguyên).`);

    // 2. MIGRATE STAFF (7 Nhân viên)
    const rawStaff = toArray(rawData.bloom_staff?.value);
    for (let staffIdx = 0; staffIdx < rawStaff.length; staffIdx++) {
      const s = rawStaff[staffIdx];
      if (!s) continue;
      const staffCustomId = s.customId || s.id || `STF_${staffIdx}`;
      const newStaff = await insertIfMissing(
        Staff,
        { customId: staffCustomId },
        {
          userId: idMap.users[s.userId] || null,
          customId: staffCustomId,
          staffName: s.name || 'Kỹ thuật viên',
          phone: s.phone || '0900000000',
          title: s.position || 'Kỹ thuật viên',
          specialty: 'Điều trị da chuyên sâu',
          rating: 5.0,
          status: 'working'
        }
      );
      mapSourceId(idMap.staff, s, newStaff._id);
    }
    console.log(`[✔] Đã kiểm tra ${Object.keys(idMap.staff).length} Staff.`);

    // 3. MIGRATE SERVICES (174 Dịch vụ chính + 5 Dịch vụ phễu)
    const rawServices = toArray(rawData.bloom_treatments?.value || rawData.bloom_pos_services?.value);
    const categoryGroups = ['dieu-tri-da', 'cham-soc-da', 'tre-hoa-nang-co', 'triet-long'];
    let serviceIdx = 0;

    for (let sourceServiceIdx = 0; sourceServiceIdx < rawServices.length; sourceServiceIdx++) {
      const s = rawServices[sourceServiceIdx];
      if (!s) continue;
      const name = s.name || s.title || 'Dịch vụ Spa';
      const serviceCustomId = s.customId || s.id || `SRV_${sourceServiceIdx}`;
      const cleanSlug = `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-')}-${String(serviceCustomId).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      const newSrv = await insertIfMissing(
        Service,
        { customId: serviceCustomId },
        {
          customId: serviceCustomId,
          serviceName: name,
          slug: cleanSlug,
          categoryGroup: categoryGroups[serviceIdx % categoryGroups.length],
          price: s.price || 500000,
          durationMinutes: s.duration || 60,
          description: s.description || 'Dịch vụ làm đẹp chuẩn y khoa',
          image: s.icon || s.image || '',
          status: 'active'
        }
      );
      mapSourceId(idMap.services, s, newSrv._id);
      serviceIdx++;
    }

    // Nạp 5 dịch vụ phễu
    const rawPheu = toArray(rawData['servicesData (js/pheu.js)']?.value);
    let pheuCount = 0;
    for (const p of rawPheu) {
      if (!p) continue;
      const name = p.name || p.title || 'Dịch vụ Trải nghiệm';
      const funnelCustomId = p.id || `PHEU_${pheuCount}`;
      const funnel = await insertIfMissing(
        Service,
        { customId: funnelCustomId },
        {
          customId: funnelCustomId,
          serviceName: name,
          slug: `pheu-${String(funnelCustomId).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          categoryGroup: 'dieu-tri-da',
          price: p.price || 99000,
          durationMinutes: p.duration || 30,
          description: 'Dịch vụ phễu ưu đãi thử nghiệm',
          status: 'active'
        }
      );
      mapSourceId(idMap.services, p, funnel._id);
      pheuCount++;
    }
    console.log(`[✔] Đã kiểm tra ${serviceIdx} Services chính + ${pheuCount} Services phễu.`);

    // 4. MIGRATE PRODUCTS (79 Sản phẩm)
    const rawProducts = toArray(rawData.bloom_products?.value);
    let prodCount = 0;
    for (let productIdx = 0; productIdx < rawProducts.length; productIdx++) {
      const p = rawProducts[productIdx];
      if (!p) continue;
      const productCode = p.productCode || p.code || p.id || `PROD_${productIdx}`;
      await insertIfMissing(
        Product,
        { productCode },
        {
          productCode,
          productName: p.productName || p.name || p.title || 'Sản phẩm Spa',
          price: p.price || 0,
          costPrice: p.costPrice || 0,
          stockQuantity: p.stockQuantity !== undefined ? p.stockQuantity : 100,
          unit: p.unit || 'Chai',
          image: p.image || p.icon || ''
        }
      );
      prodCount++;
    }
    console.log(`[✔] Đã kiểm tra ${prodCount} Products.`);

    // 5. MIGRATE BOOKINGS (186 Lịch hẹn)
    const rawBookingsValue = rawData.bloom_bookings?.value || [];
    const rawBookings = Array.isArray(rawBookingsValue) ? rawBookingsValue : [rawBookingsValue];
    const userIds = Object.values(idMap.users);
    const serviceIds = Object.values(idMap.services);
    const staffIds = Object.values(idMap.staff);

    let bIdx = 0;
    for (const b of rawBookings) {
      if (!b) continue;
      const cusId = idMap.users[b.customerId] || userIds[0];
      const srvId = idMap.services[b.serviceId] || serviceIds[0];
      const userObj = await User.findById(cusId);

      const bookingCode = b.bookingCode || b.id || `BK-${String(bIdx + 1).padStart(4, '0')}`;
      await insertIfMissing(
        Booking,
        { bookingCode },
        {
          bookingCode,
          customerId: cusId,
          customerName: userObj?.fullName || 'Khách hàng',
          customerPhone: userObj?.phone || '0900000000',
          serviceId: srvId,
          staffId: idMap.staff[b.staffId] || staffIds[0] || null,
          appointmentDate: b.bookingDate ? new Date(b.bookingDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          appointmentTime: b.bookingTime || '09:00',
          depositAmount: b.amount || 0,
          note: b.note || '',
          status: ['pending', 'confirmed', 'in_treatment', 'completed', 'cancelled'].includes(b.status) ? b.status : 'pending'
        }
      );
      bIdx++;
    }
    console.log(`[✔] Đã kiểm tra ${bIdx} Bookings.`);

    // 6. TẠO DỮ LIỆU MẪU CHO TÍNH NĂNG MỚI (CustomerTreatment & SkinAnalysis)
    if (userIds.length > 0 && serviceIds.length > 0) {
      const sampleCustomerId = userIds[1] || userIds[0];
      await insertIfMissing(
        CustomerTreatment,
        { customTreatmentId: 'TRT_DATASET_SAMPLE_001' },
        {
          customerId: sampleCustomerId,
          serviceId: serviceIds[0],
          customTreatmentId: 'TRT_DATASET_SAMPLE_001',
          treatmentName: 'Liệu trình Điều trị Mụn Chuẩn Y Khoa (5 buổi)',
          totalSessions: 5,
          usedSessions: 1,
          remainingSessions: 4,
          history: [{ date: new Date(), staffId: staffIds[0] || null, note: 'Buổi 1: Lấy nhân mụn và chiếu đèn sinh học' }],
          status: 'active'
        }
      );

      const sampleAnalysis = {
        customerId: sampleCustomerId,
        analyzedBy: staffIds[0] || null,
        skinType: 'Hỗn hợp thiên dầu',
        tags: ['Mụn ẩn', 'Lỗ chân lông to'],
        notes: 'Da nhạy cảm nhẹ, khuyến nghị dùng bộ sản phẩm làm sạch dịu nhẹ'
      };
      await insertIfMissing(
        SkinAnalysis,
        { customerId: sampleCustomerId, notes: sampleAnalysis.notes },
        sampleAnalysis
      );
    }
    console.log(`[✔] Đã kiểm tra dữ liệu SkinAnalysis & CustomerTreatment.`);

    console.log("\n==========================================");
    console.log("🎉 MIGRATION HOÀN TẤT THÀNH CÔNG!");
    console.log("==========================================");
  } catch (error) {
    console.error("❌ Lỗi khi migrate:", error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

migrateData();