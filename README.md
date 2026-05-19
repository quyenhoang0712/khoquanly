# Workforce Schedule Management

Web quản lý nhân sự/lịch làm việc cho Admin và Nhân viên, dùng React + Vite, Node.js + Express, MongoDB + Mongoose.

## Chức năng chính

- Đăng nhập và phân quyền `admin` / `user`
- Admin tạo tài khoản nhân sự, nhân viên không tự đăng ký
- Admin xem lịch nhân viên, duyệt đăng ký lịch tuần, duyệt xin nghỉ
- Admin giao việc trong ngày, xem trạng thái công việc, báo cáo, ảnh báo cáo và checkout
- Admin xem bảng lương theo tháng/năm, chi tiết từng ngày và export CSV
- Nhân viên xem lịch của mình, xem hôm nay làm với ai
- Nhân viên đăng ký lịch tuần, xin nghỉ, xem task, cập nhật trạng thái, gửi báo cáo kèm ảnh, checkout
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
GET /api/admin/leave-requests
PUT /api/admin/leave-requests/:id/approve
PUT /api/admin/leave-requests/:id/reject
POST /api/admin/tasks
GET /api/admin/tasks?date=
GET /api/admin/reports?date=
GET /api/admin/checkouts?date=
GET /api/admin/salaries?month=&year=
GET /api/admin/salaries/:userId?month=&year=
```

USER:

```text
GET /api/user/my-schedule
POST /api/user/schedule-requests
POST /api/user/leave-requests
GET /api/user/today-tasks
GET /api/user/tasks/:id
PUT /api/user/tasks/:id/status
POST /api/user/tasks/:id/report
POST /api/user/checkout
GET /api/user/my-salary?month=&year=
```

Upload ảnh báo cáo dùng `multipart/form-data`, field ảnh là `images`.
