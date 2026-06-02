require("dotenv").config();

const mongoose = require("mongoose");
const CheckoutLog = require("../models/CheckoutLog");
const DailyTask = require("../models/DailyTask");
const OvertimeRecord = require("../models/OvertimeRecord");
const ServiceExpense = require("../models/ServiceExpense");
const TaskReport = require("../models/TaskReport");
const User = require("../models/User");
const WeeklyScheduleRequest = require("../models/WeeklyScheduleRequest");
const WorkSchedule = require("../models/WorkSchedule");
const seedDefaults = require("../seed");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/warehouse-management";
const DEMO_EMAILS = ["nv1@gmail.com", "nv2@gmail.com", "nv3@gmail.com", "sale1@gmail.com", "sale2@gmail.com"];

const pad = (value) => String(value).padStart(2, "0");

const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00+07:00`);
  date.setDate(date.getDate() + days);
  return toDateString(date);
};

const nextMonday = (dateString) => {
  const date = new Date(`${dateString}T00:00:00+07:00`);
  const day = date.getDay();
  const daysUntilNextMonday = ((8 - day) % 7) || 7;
  return addDays(dateString, daysUntilNextMonday);
};

const upsertDemoUsers = async () => {
  const users = [
    { name: "Thắng", email: "nv1@gmail.com", position: "warehouse", hourlyRate: 35000 },
    { name: "Huyền", email: "nv2@gmail.com", position: "warehouse", hourlyRate: 32000 },
    { name: "Minh", email: "nv3@gmail.com", position: "warehouse", hourlyRate: 30000 },
    { name: "Linh Sale", email: "sale1@gmail.com", position: "sale", hourlyRate: 38000 },
    { name: "An Sale", email: "sale2@gmail.com", position: "sale", hourlyRate: 36000 },
  ];

  await Promise.all(
    users.map((user) =>
      User.updateOne(
        { email: user.email },
        {
          $set: {
            ...user,
            password: "123456",
            role: "user",
            active: true,
          },
        },
        { upsert: true }
      )
    )
  );

  return User.find({ email: { $in: DEMO_EMAILS } }).sort({ email: 1 });
};

const resetDemoData = async (users) => {
  const userIds = users.map((user) => user._id);
  const tasks = await DailyTask.find({ createdBy: users[0]._id }).select("_id");
  const taskIds = tasks.map((task) => task._id);

  await Promise.all([
    CheckoutLog.deleteMany({ user: { $in: userIds } }),
    ServiceExpense.deleteMany({ user: { $in: userIds } }),
    WeeklyScheduleRequest.deleteMany({ user: { $in: userIds } }),
    WorkSchedule.deleteMany({ user: { $in: userIds } }),
    OvertimeRecord.deleteMany({ user: { $in: userIds } }),
    TaskReport.deleteMany({ $or: [{ user: { $in: userIds } }, { task: { $in: taskIds } }] }),
    DailyTask.deleteMany({ createdBy: users[0]._id }),
  ]);
};

const seedSchedules = async (users, today) => {
  const shiftsByUser = [
    ["morning", "afternoon"],
    ["morning"],
    ["afternoon"],
    ["morning", "afternoon"],
    [],
  ];

  const schedules = users.flatMap((user, userIndex) =>
    shiftsByUser[userIndex].map((shift) => ({
      user: user._id,
      date: today,
      shift,
      status: "scheduled",
      approvedBy: users[0]._id,
    }))
  );

  schedules.push(
    { user: users[1]._id, date: addDays(today, 1), shift: "morning", status: "scheduled", approvedBy: users[0]._id },
    { user: users[2]._id, date: addDays(today, 1), shift: "afternoon", status: "scheduled", approvedBy: users[0]._id },
    { user: users[3]._id, date: addDays(today, 2), shift: "morning", status: "scheduled", approvedBy: users[0]._id }
  );

  await WorkSchedule.insertMany(schedules);
};

const seedTasks = async (users, today) => {
  const tasks = await DailyTask.insertMany([
    {
      title: "Kiểm kho khu A",
      description: "Đếm hàng, ghi nhận thiếu/hư hỏng và cập nhật lại kệ.",
      date: today,
      assignedTo: [users[0]._id, users[1]._id],
      statusByUser: [
        { user: users[0]._id, status: "completed", updatedAt: new Date() },
        { user: users[1]._id, status: "in-progress", updatedAt: new Date() },
      ],
      createdBy: users[0]._id,
    },
    {
      title: "Soạn đơn online",
      description: "Soạn các đơn đã chốt trong buổi sáng.",
      date: today,
      assignedTo: [users[2]._id],
      statusByUser: [{ user: users[2]._id, status: "not-started", updatedAt: new Date() }],
      createdBy: users[0]._id,
    },
    {
      title: "Gọi xác nhận khách sỉ",
      description: "Xác nhận số lượng và thời gian giao với khách.",
      date: today,
      assignedTo: [users[3]._id, users[4]._id],
      statusByUser: [
        { user: users[3]._id, status: "completed", updatedAt: new Date() },
        { user: users[4]._id, status: "in-progress", updatedAt: new Date() },
      ],
      createdBy: users[0]._id,
    },
  ]);

  await TaskReport.insertMany([
    { task: tasks[0]._id, user: users[0]._id, date: today, content: "Đã kiểm xong khu A, thiếu 3 mã hàng cần nhập bổ sung." },
    { task: tasks[2]._id, user: users[3]._id, date: today, content: "Đã xác nhận 6 khách, còn 2 khách hẹn gọi lại buổi chiều." },
  ]);
};

const seedCheckouts = async (users, today) => {
  await CheckoutLog.insertMany([
    { user: users[0]._id, date: today, checkoutAt: new Date(), note: "Đã bàn giao khu A." },
    { user: users[1]._id, date: today, checkoutAt: new Date(), note: "Còn đơn đang soạn dở, mai xử lý tiếp." },
    { user: users[3]._id, date: today, checkoutAt: new Date(), note: "Đã gửi báo cáo khách sỉ." },
  ]);
};

const seedServiceExpenses = async (users, today) => {
  await ServiceExpense.insertMany([
    { user: users[0]._id, date: today, title: "Phí giao hàng", amount: 45000, note: "Ứng ship đơn nội thành." },
    { user: users[1]._id, date: today, title: "Mua băng keo", amount: 32000, note: "Bổ sung đóng hàng." },
    { user: users[3]._id, date: addDays(today, -2), title: "Gửi xe gặp khách", amount: 15000, note: "" },
    { user: users[4]._id, date: addDays(today, -3), title: "In tài liệu", amount: 28000, note: "Bảng giá khách sỉ." },
  ]);
};

const seedOvertime = async (users, today) => {
  const [year, month] = today.split("-").map(Number);
  await OvertimeRecord.insertMany([
    { user: users[0]._id, month, year, hours: 2, hourlyRate: users[0].hourlyRate, amount: 2 * users[0].hourlyRate, note: "Soạn hàng gấp.", createdBy: users[0]._id },
    { user: users[1]._id, month, year, hours: 1.5, hourlyRate: users[1].hourlyRate, amount: 1.5 * users[1].hourlyRate, note: "Kiểm kho cuối ngày.", createdBy: users[0]._id },
  ]);
};

const seedScheduleRequests = async (users, today) => {
  const weekStart = nextMonday(today);
  await WeeklyScheduleRequest.insertMany([
    {
      user: users[1]._id,
      weekStart,
      shifts: [
        { date: weekStart, shift: "morning" },
        { date: addDays(weekStart, 1), shift: "morning" },
        { date: addDays(weekStart, 3), shift: "afternoon" },
      ],
      status: "pending",
    },
    {
      user: users[2]._id,
      weekStart,
      shifts: [
        { date: addDays(weekStart, 2), shift: "afternoon" },
        { date: addDays(weekStart, 4), shift: "morning" },
      ],
      status: "pending",
    },
  ]);
};

const run = async () => {
  await mongoose.connect(MONGO_URI);
  await seedDefaults();

  const today = toDateString(new Date());
  const users = await upsertDemoUsers();
  await resetDemoData(users);
  await seedSchedules(users, today);
  await seedTasks(users, today);
  await seedCheckouts(users, today);
  await seedServiceExpenses(users, today);
  await seedOvertime(users, today);
  await seedScheduleRequests(users, today);

  console.log("Demo seed completed.");
  console.log("Admin:", process.env.ADMIN_EMAIL || "admin@warehouse.com", "/", process.env.ADMIN_PASSWORD || "admin123");
  console.log("Users:", DEMO_EMAILS.map((email) => `${email} / 123456`).join(", "));
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
