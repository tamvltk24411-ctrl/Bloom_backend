# Bloom Backend

Tài liệu này tổng hợp kiến trúc, API và quy ước dựa trên code hiện có. Phần chưa được nhóm xác nhận được đánh dấu là đề xuất; khác biệt giữa code và hợp đồng mong muốn được ghi tại “Khoảng trống cần xử lý”.

## 1. Phạm vi và công nghệ

- Workspace hiện chỉ có `Bloom-backend`; không có frontend trong cây thư mục đang kiểm tra.
- Node.js, CommonJS, Express 5, Mongoose/MongoDB, `express-session`, `connect-mongo` và `bcryptjs`.
- API mặc định ở `http://localhost:3002`; có thể đổi bằng `PORT`.
- Response thành công thường theo dạng `{ "success": true, "message": "...", "data": ... }`. Một số lỗi/route chưa đồng nhất.

## 2. Cấu trúc thư mục hiện tại

```text
Bloom-backend/
|-- config/                 # Kết nối DB, session
|-- controllers/            # Nghiệp vụ HTTP theo phân hệ
|   |-- admin-booking.controller.js
|   |-- admin-customer.controller.js
|   |-- admin-dashboard.controller.js
|   |-- admin-pos.controller.js
|   |-- admin-staff.controller.js
|   |-- admin-catalog.controller.js
|   |-- auth.controller.js
|   |-- customer.controller.js
|   `-- public.controller.js
|-- middlewares/            # Auth, role, error handling
|-- models/                 # Mongoose schemas
|-- public/images/          # Ảnh tĩnh, URL /images
|-- routes/                 # Khai báo API routes
|-- tests/                  # Automated tests dùng node:test
|-- scripts/
|   |-- check-dataset.js    # Chỉ thống kê dataset
|   `-- migrate.js          # Import idempotent, không xóa/ghi đè
|-- seed-data/
|   |-- bloom_dataset_export.js  # Dataset đang dùng
|   `-- archive/            # Snapshot cũ, không tự động nạp
|-- utils/                  # Helpers dùng chung
|-- .env.example
|-- .gitignore
|-- index.js                # Bootstrap Express
|-- openapi.json            # Hợp đồng API OpenAPI 3.0.3
|-- package.json
|-- package-lock.json
`-- README.md
```

### Quy tắc trách nhiệm theo thư mục/file

| Vị trí | Trách nhiệm và quy tắc |
|---|---|
| `index.js` | Nạp env, đăng ký middleware/routes/404/error handler; chỉ listen sau khi DB kết nối. Không đặt truy vấn model/nghiệp vụ tại đây. |
| `config/db.js` | Kiểm tra `MONGODB_URI`, kết nối Mongoose; ném lỗi lên bootstrap, không giả vờ khởi động thành công. |
| `config/session.js` | Tạo session với Mongo store; bắt buộc có `MONGODB_URI` và `SESSION_SECRET`. |
| `routes/*.routes.js` | Chỉ khai báo method/path, middleware và controller; prefix `/api/<module>`. |
| `tests/` | Kiểm thử controller, error handling và độ bao phủ route trong OpenAPI bằng `node:test`; không ghi dữ liệu vào MongoDB. |
| `openapi.json` | Hợp đồng OpenAPI 3.0.3 cho các route hiện có; cập nhật cùng thay đổi API. |
| `controllers/*.controller.js` | Validate request, điều phối nghiệp vụ và response; chuyển lỗi async đến `next(error)`; không trả password/hash. |
| `controllers/admin-*.controller.js` | Chia nghiệp vụ quản trị theo booking, customer, dashboard, POS, staff/schedule và catalog; route public/API không đổi khi tách controller. |
| `middlewares/auth.middleware.js` | Xác thực session; chưa đăng nhập trả `401`. |
| `middlewares/role.middleware.js` | Kiểm tra role; không đủ quyền trả `403`. Route admin cần cả auth và role middleware. |
| `middlewares/error.middleware.js` | Xử lý lỗi tập trung; không nuốt lỗi hoặc tạo response thành công giả. |
| `models/*.js` | Schema, required, enum, default, refs và timestamps. Controller/migration phải tuân schema. |
| `utils/` | Helper dùng chung, không phụ thuộc request/response. |
| `public/images/` | File ảnh tĩnh; không lưu credentials hoặc dữ liệu riêng tư. |
| `scripts/check-dataset.js` | Đọc và đếm records; không ghi MongoDB. |
| `scripts/migrate.js` | Chỉ thêm bản ghi còn thiếu bằng upsert; không xóa collection/index, không ghi đè tài liệu hiện có. |
| `seed-data/bloom_dataset_export.js` | Dataset mà migration đọc. |
| `seed-data/archive/` | Snapshot cũ để tham khảo; không tự động nạp. |
| `.env.example` | Chỉ placeholder; không ghi secret thật. |
| `package.json` / `package-lock.json` | Khai báo scripts/dependencies và lockfile; dùng npm để cập nhật đồng bộ. |

### Models và quan hệ chính

- `User`: username, password hash, role (`admin`, `staff`, `customer`), trạng thái, hồ sơ, hạng thành viên và số dư ví.
- `Staff`: nhân viên/chuyên viên; có thể liên kết `userId` tới `User`.
- `Service`: dịch vụ, giá, thời lượng, nhóm, trạng thái và slug.
- `Booking`: lịch hẹn liên kết khách/dịch vụ/nhân viên; ngày `YYYY-MM-DD`, giờ `HH:mm`, trạng thái.
- `Schedule`: ca làm/ngày nghỉ của nhân viên.
- `Product`: mã, tên, giá và tồn kho.
- `Invoice`: hóa đơn, dòng hàng, phương thức thanh toán và trạng thái.
- `Deposit`: tiền cọc và trạng thái giữ/hoàn/đối soát.
- `CustomerTreatment`: liệu trình khách mua, số buổi và lịch sử điều trị.
- `SkinAnalysis`: kết quả phân tích da và gợi ý sản phẩm/dịch vụ.
- `Article`: bài viết, tác giả là nhân viên và trạng thái xuất bản.
- `CampaignAnalytics`: mùa chiến dịch, phân khúc và dự đoán doanh thu.

## 3. Cài đặt, env và lệnh chạy

Sao chép `.env.example` thành `.env`, điền URI và tạo secret riêng. `index.js` vẫn nạp `atlas-credentials.env` cho cấu hình cũ tại local; không commit file credentials.

```env
PORT=3002
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
SESSION_SECRET=<random-secret-at-least-32-bytes>
NODE_ENV=development
BLOOM_ADMIN_USERNAME=admin
BLOOM_ADMIN_PASSWORD=
```

Không dùng secret ví dụ hoặc password mặc định trong production. Tài khoản MongoDB cần quyền truy cập database và IP cần được cho phép trên Atlas.

Chạy lệnh tại thư mục `Bloom-backend`:

```powershell
npm install
npm start
npm run dev
npm run check-dataset
npm run migrate
```

- `npm start`: chạy backend.
- `npm run dev`: chạy bằng nodemon.
- `npm run check-dataset`: thống kê dataset, không ghi DB.
- `npm run migrate`: import các record còn thiếu; có thể chạy lặp lại.
- `npm test`: chạy test tự động bằng Node.js built-in test runner (`node:test`), không cần cài test framework.

## 4. Hợp đồng API hiện tại

Base URL local: `http://localhost:3002`.

### Xác thực/session/phân quyền

- Admin, staff, customer dùng chung `POST /api/auth/login`.
- Identifier có thể là username, email hoặc phone; phone chấp nhận cả có và không có khoảng trắng.
- Đăng nhập dùng session cookie `connect.sid`, không dùng Bearer token. Client phải giữ cookie qua các request; frontend phải gửi credentials đúng với CORS.
- Đăng ký công khai chỉ tạo role `customer`.
- `/api/customer/*` cần đăng nhập; `/api/admin/*` cần đăng nhập và role `admin`.
- Thông thường: chưa đăng nhập `401`, không đủ quyền `403`, sai input/không tìm thấy `4xx`; lỗi server qua error middleware.

### Auth API

| Method và path | Quyền | Request | Kết quả hiện tại |
|---|---|---|---|
| `POST /api/auth/login` | Public | `{ "username": "username/email/phone", "password": "..." }` | `200`, `data.user` gồm id, username, fullName, role, thông tin thành viên và `mustChangePassword`. Sai credentials `400`, tài khoản không active `403`. Tạo session cookie. |
| `POST /api/auth/register` | Public | `{ "username": "...", "password": "...", "fullName": "...", "phone": "...", "email": "..." }` | `201`, role customer. Password tối thiểu 8 ký tự, có chữ hoa, chữ thường và số. |
| `GET /api/auth/profile` | Session | Không có body | `200`, hồ sơ user, không trả password. |
| `POST /api/auth/logout` | Session | Không có body | Hủy session và xóa cookie. |
| `POST /api/auth/change-password` | Session | `{ "oldPassword": "...", "newPassword": "..." }` | Đổi password nếu password cũ đúng và password mới đạt rule mạnh; hoàn tất việc đổi mật khẩu bắt buộc sau đăng nhập lần đầu. |

### Public API

| Method và path | Query | Kết quả hiện tại |
|---|---|---|
| `GET /api/public/services` | `categoryGroup` tùy chọn | Danh sách dịch vụ có `status: "active"`. |
| `GET /api/public/services/:id` | ID dịch vụ | Chi tiết dịch vụ đang hoạt động. |
| `GET /api/public/staffs` | Không | Nhân viên có `status: "working"`. |
| `GET /api/public/professors` | Không | Alias hiện tại, trả danh sách nhân viên đang làm việc. |
| `GET /api/public/articles` | `category` tùy chọn | Chỉ trả bài viết có `isPublished: true`, populate thông tin tác giả. |

### Customer API

Tất cả endpoint cần session.

| Method và path | Request/query | Kết quả hiện tại |
|---|---|---|
| `GET /api/customer/overview` | Không | Hồ sơ rút gọn và lịch `pending`/`confirmed`. |
| `POST /api/customer/bookings` | `{ "serviceId": "<ObjectId>", "staffId": "<ObjectId optional>", "appointmentDate": "YYYY-MM-DD", "appointmentTime": "HH:mm", "note": "" }` | `201`, tạo lịch `pending`; ngày/giờ hợp lệ và trong tương lai theo giờ Việt Nam, dịch vụ phải đang hoạt động. Nếu chọn nhân viên, nhân viên phải đang làm và có lịch cho ca đã chọn: sáng 09:00–12:00, chiều 12:00–17:00, tối 17:00–22:00; kiểm tra ngày nghỉ, capacity và thời lượng không chồng lịch. Nếu không chọn nhân viên, các kiểm tra lịch/ca/capacity của nhân viên được bỏ qua. |
| `GET /api/customer/bookings` | `status=upcoming` hoặc `status=history` tùy chọn | Danh sách lịch của user hiện tại. |
| `PUT /api/customer/bookings/:id/cancel` | `{ "reason": "..." }` tùy chọn | Hủy lịch của user hiện tại; không hủy lịch completed/cancelled. |

### Admin API

Tất cả endpoint cần session user có role `admin`.

| Method và path | Request/query | Kết quả hiện tại |
|---|---|---|
| `GET /api/admin/bookings` | Query: `date`, `status`, `staffId` tùy chọn | Danh sách lịch, populate khách/dịch vụ/nhân viên. |
| `PATCH /api/admin/bookings/:id/status` | `{ "status": "pending\|confirmed\|in_treatment\|completed\|cancelled" }` | Cập nhật trạng thái lịch. |
| `GET /api/admin/staffs` | Không | Danh sách Staff. |
| `POST /api/admin/schedules` | `{ "staffId": "<ObjectId>", "date": "YYYY-MM-DD", "shift": "sang\|chieu\|toi", "isOff": false, "maxCapacity": 5 }` | `201`, tạo schedule. |
| `POST /api/admin/pos/checkout` | `{ "customerId": "<ObjectId>", "items": [{ "itemId": "<ObjectId>", "name": "...", "type": "service\|product", "quantity": 1, "unitPrice": 100000, "amount": 100000 }], "discountAmount": 0, "paymentMethod": "cash\|banking\|card\|prepaid_wallet", "isDraft": false }` | `201`, tạo invoice; thanh toán prepaid wallet trừ số dư khách. |
| `POST /api/admin/pos/prepaid-wallet` | `{ "customerId": "<ObjectId>", "topupAmount": 100000 }` | Cộng số dư ví. |
| `POST /api/admin/customers` | `{ "username": "...", "fullName": "...", "phone": "...", "email": "..." }` | `201`, tạo customer với mật khẩu tạm `123456`; response chỉ trả mật khẩu tạm một lần cho admin. Đăng nhập sẽ báo `mustChangePassword: true`; các API admin/customer bị chặn đến khi khách đổi mật khẩu bằng `/api/auth/change-password`. Mật khẩu mới phải tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số. |

Response API thống nhất theo `{ "success": boolean, "message": string, "data": object | array | null }`. Lỗi validation/schema Mongoose và JSON sai trả `400`, dữ liệu trùng trả `409`, route không tồn tại trả `404`, lỗi chưa xác định trả `500` với thông báo chung; chi tiết lỗi máy chủ chỉ ghi log phía server. Đặc tả OpenAPI 3.0.3 nằm tại [`openapi.json`](./openapi.json); có thể mở/import file này bằng Swagger Editor, Swagger UI hoặc Postman.

## 5. Migration và seed data

Dataset đang dùng là `seed-data/bloom_dataset_export.js`; snapshot trong archive không tự động nạp.

- Hiện migration nạp users, staff, services, funnel services, products, bookings và một số record mẫu treatment/skin analysis.
- Dùng upsert `$setOnInsert`: record đã có không bị ghi đè. Muốn cập nhật record cần migration riêng, có điều kiện và review rõ ràng.
- Không xóa documents, collections hoặc indexes.
- Cần `MONGODB_URI`. Nếu dataset có admin nhưng DB chưa có admin, phải đặt `BLOOM_ADMIN_PASSWORD`; không tự tạo admin với password mặc định.
- Customer dataset dùng password demo `123456`; không dùng ngoài môi trường thử nghiệm.
- Model Schedule, Invoice, Deposit, Article, CampaignAnalytics chưa được nạp đầy đủ bởi script hiện tại.
- Upsert an toàn khi chạy tuần tự; không chạy nhiều migration song song.

## 6. Quy tắc Git và cộng tác

### Quy tắc đã có

- `.gitignore` bỏ qua `node_modules/`, `.env`, `atlas-credentials.env`.
- Không commit credentials, session secrets, password thật, dữ liệu khách hàng hoặc export nhạy cảm.
- Repository chưa có lịch sử commit/convention branch được xác nhận.

### Quy ước đề xuất, chưa được enforce

- Branch: `feature/<module>-<short-name>`, `fix/<issue>`, `docs/<topic>`.
- Commit theo Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Mỗi commit tập trung vào một thay đổi; không commit `node_modules`, env/credentials hoặc data export không được phép chia sẻ.
- Trước PR: `node --check` các file JS sửa, kiểm tra API liên quan; nếu sửa migration thì chạy hai lần và so sánh counts.
- PR mô tả mục tiêu, API/schema bị ảnh hưởng, cách test, env mới và rủi ro dữ liệu.
- Không chạy migration phá hủy/production khi chưa backup và chưa có chấp thuận data owner.
- Repo chưa cấu hình test/lint runner; bổ sung test và lint khi nhóm thống nhất.


## 7. Quy trình thay đổi API/schema

1. Cập nhật schema/validation và controller cùng với thay đổi route.
2. Nếu đổi request/response, ghi rõ breaking change, thông báo frontend và cập nhật README/tests trong cùng PR.
3. Endpoint ghi dữ liệu phải validate input, role và quyền sở hữu; customerId của customer lấy từ session, không tin ID client tự gửi.
4. Password mới phải hash bằng bcryptjs; không trả hash; password demo chỉ dùng local.
5. Migration cần khóa định danh ổn định, idempotent và không xóa dữ liệu. Cập nhật record cần migration riêng và backup/approval.
6. Ghi rõ method/path, request, response, status code, cookie/role và cách test.

## 8. Khoảng trống cần xử lý

Đây là sai khác giữa code hiện tại và contract mong muốn, không phải tính năng đã được sửa:

1. Bộ test tự động hiện bao phủ các luồng booking, public articles, error middleware và kiểm tra route trong OpenAPI; chưa thay thế integration test với MongoDB thật.
2. Dataset hiện là một file JavaScript export, chưa phải JSON riêng theo collection. Chuyển format cần giữ tương thích migration và xác minh mapping trước khi bỏ nguồn cũ.

Không sửa schema, response, quyền hoặc production data chỉ để README trông nhất quán. Xử lý từng khoảng trống bằng issue/PR và test phù hợp.