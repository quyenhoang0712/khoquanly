# Workforce Schedule Management

Web quản lý nhân sự/lịch làm việc cho Admin và Nhân viên, dùng React + Vite, Node.js + Express, MongoDB + Mongoose.

## Chức năng chính

- Đăng nhập và phân quyền `admin` / `user`
- Admin tạo tài khoản nhân sự, nhân viên không tự đăng ký
- Admin xem lịch nhân viên, duyệt đăng ký lịch tuần
- Admin giao việc trong ngày, xem trạng thái công việc, báo cáo, ảnh báo cáo và checkout
- Admin xem bảng lương theo tháng/năm, chi tiết từng ngày và export CSV
- Nhân viên xem lịch của mình, xem hôm nay làm với ai
- Nhân viên đăng ký lịch tuần, xem task, cập nhật trạng thái, gửi báo cáo kèm ảnh, checkout
- Tính lương: ca đã duyệt + có checkout, mỗi ca 4 giờ, 30.000 VNĐ/giờ

## Tài khoản

```text
Admin
Email: admin@warehouse.com
Mật khẩu: admin123
```

Nhân viên đăng nhập bằng tài khoản do Admin tạo trong trang Nhân sự.

## Chạy backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend chạy tại:

```text
http://localhost:5001
```

Trong `backend/.env`, cần cấu hình tối thiểu:

```text
MONGO_URI=
CLIENT_URL=
JWT_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

`JWT_SECRET` phải là chuỗi ngẫu nhiên mạnh, ít nhất 32 ký tự. `ADMIN_PASSWORD` không nên dùng mật khẩu mặc định khi deploy.

Upload ảnh dùng Cloudinary. Trong `backend/.env`, cần cấu hình:

```text
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Mongo chỉ lưu URL ảnh Cloudinary trong field `images`, không lưu file ảnh.

Nếu database đang có user cũ lưu mật khẩu dạng plaintext, chạy một lần:

```bash
cd backend
npm run migrate:passwords
```

## Kỳ lương

Bảng lương đang tính theo kỳ cố định 4 tuần: ngày 11 của tháng được chọn đến ngày 8 của tháng sau. Ví dụ kỳ lương tháng 6/2026 là `2026-06-11` đến `2026-07-08`, không phải toàn bộ tháng dương lịch.

## Chạy frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend chạy tại:

```text
http://localhost:5173
```

## API

AUTH:

```text
POST /api/auth/login
GET  /api/auth/me
```

ADMIN:

```text
GET /api/admin/users
POST /api/admin/users
GET /api/admin/schedules
GET /api/admin/schedule-requests
PUT /api/admin/schedule-requests/:id/approve
PUT /api/admin/schedule-requests/:id/reject
POST /api/admin/tasks
GET /api/admin/tasks?date=
GET /api/admin/reports?date=
GET /api/admin/monthly-report?month=&year=
GET /api/admin/checkouts?date=
GET /api/admin/overtime?month=&year=
POST /api/admin/overtime
PUT /api/admin/overtime/:id
DELETE /api/admin/overtime/:id
GET /api/admin/salaries?month=&year=
GET /api/admin/salaries/:userId?month=&year=
```

USER:

```text
GET /api/user/my-schedule
POST /api/user/schedule-requests
GET /api/user/today-tasks
GET /api/user/tasks/:id
PUT /api/user/tasks/:id/status
POST /api/user/tasks/:id/report
POST /api/user/checkout
GET /api/user/my-salary?month=&year=
```

Upload ảnh báo cáo và checkout dùng `multipart/form-data`, field ảnh là `images`.
