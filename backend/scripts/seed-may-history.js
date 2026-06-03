require("dotenv").config();

const mongoose = require("mongoose");
const CheckoutLog = require("../models/CheckoutLog");
const DailyTask = require("../models/DailyTask");
const OvertimeRecord = require("../models/OvertimeRecord");
const ServiceExpense = require("../models/ServiceExpense");
const TaskReport = require("../models/TaskReport");
const User = require("../models/User");
const WorkSchedule = require("../models/WorkSchedule");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/warehouse-management";
const SEED_TAG = "[seed-may-history]";
const MAY_2026_START = "2026-05-01";
const MAY_2026_END = "2026-05-31";

const pad = (value) => String(value).padStart(2, "0");

const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00+07:00`);
  date.setDate(date.getDate() + days);
  return toDateString(date);
};

const datesBetween = (start, end) => {
  const dates = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
};

const workingDates = () => datesBetween(MAY_2026_START, MAY_2026_END).filter((date) => {
  const day = new Date(`${date}T00:00:00+07:00`).getDay();
  return day !== 0;
});

const checkoutAtFor = (date, position, shifts) => {
  const latestEnd = position === "sale"
    ? shifts.includes("afternoon") ? "22:06" : "16:06"
    : shifts.includes("afternoon") ? "17:06" : "13:06";
  return new Date(`${date}T${latestEnd}:00+07:00`);
};

const rotate = (items, index, count) => {
  if (items.length === 0) return [];
  return Array.from({ length: Math.min(count, items.length) }, (_, offset) => items[(index + offset) % items.length]);
};

const cleanupMarkedData = async () => {
  const seedTasks = await DailyTask.find({ title: new RegExp(`^${SEED_TAG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).select("_id");
  const taskIds = seedTasks.map((task) => task._id);

  await Promise.all([
    TaskReport.deleteMany({ task: { $in: taskIds } }),
    DailyTask.deleteMany({ _id: { $in: taskIds } }),
    ServiceExpense.deleteMany({ note: SEED_TAG }),
    OvertimeRecord.deleteMany({ note: SEED_TAG }),
  ]);
};

const seedSchedulesAndCheckouts = async ({ admin, warehouseUsers, saleUsers, allUsers }) => {
  const dates = workingDates();
  let scheduleWrites = 0;
  let checkoutWrites = 0;

  for (const [index, date] of dates.entries()) {
    const warehouseMorning = rotate(warehouseUsers, index, 2);
    const warehouseAfternoon = rotate(warehouseUsers, index + 1, 2);
    const saleMorning = rotate(saleUsers.length ? saleUsers : allUsers, index, 1);
    const saleAfternoon = rotate(saleUsers.length ? saleUsers : allUsers, index + 1, 1);
    const planned = new Map();

    const addPlan = (user, shift) => {
      if (!user) return;
      const key = String(user._id);
      const current = planned.get(key) || { user, shifts: new Set() };
      current.shifts.add(shift);
      planned.set(key, current);
    };

    warehouseMorning.forEach((user) => addPlan(user, "morning"));
    warehouseAfternoon.forEach((user) => addPlan(user, "afternoon"));
    saleMorning.forEach((user) => addPlan(user, "morning"));
    saleAfternoon.forEach((user) => addPlan(user, "afternoon"));

    for (const { user, shifts } of planned.values()) {
      for (const shift of shifts) {
        const result = await WorkSchedule.updateOne(
          { user: user._id, date, shift },
          {
            $setOnInsert: {
              user: user._id,
              date,
              shift,
              status: "scheduled",
              approvedBy: admin._id,
            },
          },
          { upsert: true }
        );
        scheduleWrites += result.upsertedCount || 0;
      }

      const checkoutResult = await CheckoutLog.updateOne(
        { user: user._id, date },
        {
          $setOnInsert: {
            user: user._id,
            date,
            checkoutAt: checkoutAtFor(date, user.position, Array.from(shifts)),
            note: `${SEED_TAG} Đã hoàn thành ca tháng 5.`,
          },
        },
        { upsert: true }
      );
      checkoutWrites += checkoutResult.upsertedCount || 0;
    }
  }

  return { scheduleWrites, checkoutWrites, workingDays: dates.length };
};

const seedTasksAndReports = async ({ admin, warehouseUsers, saleUsers, allUsers }) => {
  const taskDates = ["2026-05-04", "2026-05-08", "2026-05-13", "2026-05-18", "2026-05-22", "2026-05-27"];
  const tasks = [];

  for (const [index, date] of taskDates.entries()) {
    const assignees = index % 2 === 0
      ? rotate(warehouseUsers.length ? warehouseUsers : allUsers, index, 2)
      : rotate(saleUsers.length ? saleUsers : allUsers, index, 2);

    if (assignees.length === 0) continue;

    tasks.push({
      title: `${SEED_TAG} ${index % 2 === 0 ? "Kiểm kho tháng 5" : "Chăm sóc khách tháng 5"}`,
      description: index % 2 === 0 ? "Kiểm hàng, cập nhật kệ và ghi nhận mã thiếu." : "Gọi xác nhận khách, cập nhật trạng thái đơn.",
      date,
      assignedTo: assignees.map((user) => user._id),
      statusByUser: assignees.map((user) => ({ user: user._id, status: "completed", updatedAt: new Date(`${date}T18:00:00+07:00`) })),
      createdBy: admin._id,
    });
  }

  const insertedTasks = tasks.length ? await DailyTask.insertMany(tasks) : [];
  const reports = insertedTasks.flatMap((task) =>
    task.assignedTo.slice(0, 1).map((userId) => ({
      task: task._id,
      user: userId,
      date: task.date,
      content: `${SEED_TAG} Đã hoàn thành công việc ngày ${task.date}.`,
    }))
  );

  if (reports.length) await TaskReport.insertMany(reports);
  return { taskWrites: insertedTasks.length, reportWrites: reports.length };
};

const seedExpensesAndOvertime = async ({ admin, warehouseUsers, saleUsers, allUsers }) => {
  const expenseUsers = [...warehouseUsers.slice(0, 2), ...saleUsers.slice(0, 2)];
  const expenses = (expenseUsers.length ? expenseUsers : allUsers.slice(0, 4)).map((user, index) => ({
    user: user._id,
    date: addDays("2026-05-06", index * 4),
    title: index % 2 === 0 ? "Phí giao hàng tháng 5" : "Vật tư đóng hàng tháng 5",
    amount: [42000, 36000, 28000, 51000][index] || 30000,
    note: SEED_TAG,
  }));

  if (expenses.length) await ServiceExpense.insertMany(expenses);

  const overtimeUsers = allUsers.slice(0, 3);
  const overtime = overtimeUsers.map((user, index) => ({
    user: user._id,
    month: 5,
    year: 2026,
    hours: [2, 1.5, 3][index] || 1,
    hourlyRate: user.hourlyRate || 30000,
    amount: ([2, 1.5, 3][index] || 1) * (user.hourlyRate || 30000),
    note: SEED_TAG,
    createdBy: admin._id,
  }));

  if (overtime.length) await OvertimeRecord.insertMany(overtime);
  return { expenseWrites: expenses.length, overtimeWrites: overtime.length };
};

const run = async () => {
  await mongoose.connect(MONGO_URI);

  const admin = await User.findOne({ role: "admin", active: true }).sort({ createdAt: 1 });
  const allUsers = await User.find({ role: "user", active: true }).sort({ position: 1, name: 1 });
  if (!admin) throw new Error("Không tìm thấy admin active để tạo seed tháng 5.");
  if (allUsers.length === 0) throw new Error("Không có nhân viên active để tạo seed tháng 5.");

  const warehouseUsers = allUsers.filter((user) => user.position !== "sale");
  const saleUsers = allUsers.filter((user) => user.position === "sale");

  await cleanupMarkedData();
  const schedules = await seedSchedulesAndCheckouts({ admin, warehouseUsers, saleUsers, allUsers });
  const tasks = await seedTasksAndReports({ admin, warehouseUsers, saleUsers, allUsers });
  const expenses = await seedExpensesAndOvertime({ admin, warehouseUsers, saleUsers, allUsers });

  console.log(JSON.stringify({
    message: "Seed tháng 5/2026 completed.",
    activeUsers: allUsers.length,
    warehouseUsers: warehouseUsers.length,
    saleUsers: saleUsers.length,
    ...schedules,
    ...tasks,
    ...expenses,
  }, null, 2));

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
