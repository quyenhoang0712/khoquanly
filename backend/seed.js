const Role = require("./models/Role");
const User = require("./models/User");
const WorkRule = require("./models/WorkRule");

const defaultWorkRules = [
  {
    title: "Thời gian làm việc",
    content:
      "Bộ phận Kho\n- Ca sáng: 09:00 - 13:00\n- Ca chiều: 13:00 - 17:00\n\nBộ phận Sale\n- Ca sáng: 10:00 - 16:00\n- Ca chiều: 16:00 - 22:00\n\nNhân viên phải có mặt đúng giờ theo ca đã đăng ký. Trường hợp phát sinh đi trễ hoặc nghỉ đột xuất phải báo cho quản lý sớm nhất có thể.\n\nVi phạm: Đi làm trễ sẽ bị trừ tương đương 01 giờ công trong ca làm việc đó.",
    order: 1,
  },
  {
    title: "Check-out và báo cáo cuối ca",
    content:
      "Khi kết thúc ca làm việc, nhân viên bắt buộc phải:\n- Thực hiện check-out.\n- Gửi báo cáo công việc đã hoàn thành.\n- Đính kèm hình ảnh minh chứng công việc nếu được yêu cầu.\n\nVi phạm: Không check-out hoặc không gửi báo cáo cuối ca thì ca làm việc sẽ không được xác nhận hoàn thành và không tính lương cho ca làm việc đó.",
    order: 2,
  },
  {
    title: "Hoàn thành công việc được giao",
    content:
      "Nhân viên có trách nhiệm hoàn thành đầy đủ các công việc được giao trong ca làm việc.\nTrường hợp chưa hoàn thành phải báo cáo rõ lý do trước khi kết thúc ca.\n\nVi phạm: Không hoàn thành công việc sẽ bị trừ tương đương 01 giờ công trong ngày làm việc.",
    order: 3,
  },
  {
    title: "Quy định chung",
    content:
      "- Tuân thủ sự phân công của quản lý.\n- Trung thực trong báo cáo công việc.\n- Giữ gìn tài sản, hàng hóa và khu vực làm việc.\n- Hỗ trợ đồng nghiệp khi cần thiết để đảm bảo tiến độ công việc.",
    order: 4,
  },
  {
    title: "Bảng xử lý vi phạm",
    content:
      "- Đi làm trễ: Trừ 01 giờ công\n- Không check-out cuối ca: Không tính lương ca làm việc\n- Không gửi báo cáo cuối ca: Không tính lương ca làm việc\n- Không hoàn thành công việc được giao: Trừ 01 giờ công\n- Báo cáo không trung thực: Xử lý theo mức độ vi phạm",
    order: 5,
  },
];

const seedDefaults = async () => {
  await Role.updateOne(
    { name: "admin" },
    { $setOnInsert: { name: "admin", description: "System administrator" } },
    { upsert: true }
  );
  await Role.updateOne(
    { name: "user" },
    { $setOnInsert: { name: "user", description: "Employee" } },
    { upsert: true }
  );

  const adminEmail = process.env.ADMIN_EMAIL || "admin@warehouse.com";

  await User.updateOne(
    { email: adminEmail },
    {
      $set: {
        name: "Admin",
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || "admin123",
        role: "admin",
        hourlyRate: 30000,
        active: true,
      },
    },
    { upsert: true }
  );

  const ruleCount = await WorkRule.countDocuments();
  if (ruleCount === 0) {
    await WorkRule.insertMany(defaultWorkRules);
  }
};

module.exports = seedDefaults;
