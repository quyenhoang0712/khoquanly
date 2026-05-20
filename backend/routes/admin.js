const express = require("express");
const CheckoutLog = require("../models/CheckoutLog");
const DailyTask = require("../models/DailyTask");
const LeaveRequest = require("../models/LeaveRequest");
const ReportImage = require("../models/ReportImage");
const TaskReport = require("../models/TaskReport");
const User = require("../models/User");
const WeeklyScheduleRequest = require("../models/WeeklyScheduleRequest");
const WorkSchedule = require("../models/WorkSchedule");
const { calculateSalary } = require("../utils/salary");
const { autoCheckoutPastSchedules } = require("../utils/checkout");
const { todayString } = require("../utils/date");

const router = express.Router();

const populateUser = { path: "user", select: "name email role" };
const populateAssigned = { path: "assignedTo", select: "name email" };

const parseMonthYear = (query) => {
  const now = new Date();
  return {
    month: Number(query.month || now.getMonth() + 1),
    year: Number(query.year || now.getFullYear()),
  };
};

const applyDateFilters = (filters, query) => {
  if (query.date) {
    filters.date = query.date;
    return;
  }

  if (query.month && query.year) {
    const month = String(query.month).padStart(2, "0");
    filters.date = { $regex: `^${query.year}-${month}` };
  }
};

const shiftsFromOption = (shiftOption) => {
  if (shiftOption === "full") return ["morning", "afternoon"];
  if (["morning", "afternoon"].includes(shiftOption)) return [shiftOption];
  return [];
};

const saveEmployeeDaySchedule = async ({ userId, date, shiftOption, status, adminId }) => {
  if (!userId || !date || !shiftOption) {
    const error = new Error("Vui lòng chọn nhân viên, ngày làm và ca làm");
    error.statusCode = 400;
    throw error;
  }

  const employee = await User.findOne({ _id: userId, role: "user", active: true });
  if (!employee) {
    const error = new Error("Không tìm thấy nhân viên");
    error.statusCode = 404;
    throw error;
  }

  const shifts = shiftsFromOption(shiftOption);
  await WorkSchedule.deleteMany({ user: userId, date });

  if (shiftOption === "off") return [];
  if (shifts.length === 0) {
    const error = new Error("Ca làm không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  await WorkSchedule.insertMany(
    shifts.map((shift) => ({
      user: userId,
      date,
      shift,
      status: status === "leave" ? "leave" : "scheduled",
      approvedBy: adminId,
    }))
  );

  await autoCheckoutPastSchedules();

  return WorkSchedule.find({ user: userId, date }).populate(populateUser).sort({ shift: 1 });
};

router.get("/users", async (req, res, next) => {
  try {
    const users = await User.find({ active: true }).select("-password").sort({ role: 1, name: 1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.post("/users", async (req, res, next) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const hourlyRate = Number(req.body.hourlyRate || 30000);

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    const existed = await User.findOne({ email });
    if (existed) {
      return res.status(409).json({ message: "Email này đã tồn tại" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: "user",
      hourlyRate,
      active: true,
    });

    const created = user.toObject();
    delete created.password;
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const date = req.query.date || todayString();
    const [employees, pendingSchedules, pendingLeaves, tasks, reports, checkouts] = await Promise.all([
      User.countDocuments({ role: "user", active: true }),
      WeeklyScheduleRequest.countDocuments({ status: "pending" }),
      LeaveRequest.countDocuments({ status: "pending" }),
      DailyTask.countDocuments({ date }),
      TaskReport.countDocuments({ date }),
      CheckoutLog.countDocuments({ date }),
    ]);

    res.json({ employees, pendingSchedules, pendingLeaves, todayTasks: tasks, todayReports: reports, todayCheckouts: checkouts });
  } catch (error) {
    next(error);
  }
});

router.get("/schedules", async (req, res, next) => {
  try {
    const filters = {};
    applyDateFilters(filters, req.query);
    if (req.query.userId) filters.user = req.query.userId;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.shift) filters.shift = req.query.shift;

    const schedules = await WorkSchedule.find(filters).populate(populateUser).sort({ date: 1, shift: 1 });
    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

router.post("/schedules", async (req, res, next) => {
  try {
    const schedules = await saveEmployeeDaySchedule({
      userId: req.body.userId,
      date: req.body.date,
      shiftOption: req.body.shiftOption,
      status: req.body.status,
      adminId: req.user.id,
    });
    res.status(201).json(schedules);
  } catch (error) {
    next(error);
  }
});

router.put("/schedules/:date/:userId", async (req, res, next) => {
  try {
    const schedules = await saveEmployeeDaySchedule({
      userId: req.params.userId,
      date: req.params.date,
      shiftOption: req.body.shiftOption,
      status: req.body.status,
      adminId: req.user.id,
    });
    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

router.delete("/schedules/:date/:userId", async (req, res, next) => {
  try {
    const result = await WorkSchedule.deleteMany({ user: req.params.userId, date: req.params.date });
    res.json({ deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

router.get("/schedule-requests", async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    const requests = await WeeklyScheduleRequest.find(filters).populate(populateUser).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.put("/schedule-requests/:id/approve", async (req, res, next) => {
  try {
    const request = await WeeklyScheduleRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Schedule request not found" });

    request.status = "approved";
    request.adminNote = req.body.adminNote || "";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    await Promise.all(
      request.shifts.map((shift) =>
        WorkSchedule.updateOne(
          { user: request.user, date: shift.date, shift: shift.shift },
          {
            user: request.user,
            date: shift.date,
            shift: shift.shift,
            status: "scheduled",
            request: request._id,
            approvedBy: req.user.id,
          },
          { upsert: true }
        )
      )
    );

    res.json(await request.populate(populateUser));
  } catch (error) {
    next(error);
  }
});

router.put("/schedule-requests/:id/reject", async (req, res, next) => {
  try {
    const request = await WeeklyScheduleRequest.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", adminNote: req.body.adminNote || "", reviewedBy: req.user.id, reviewedAt: new Date() },
      { new: true }
    ).populate(populateUser);
    if (!request) return res.status(404).json({ message: "Schedule request not found" });
    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.get("/leave-requests", async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    const requests = await LeaveRequest.find(filters).populate(populateUser).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.put("/leave-requests/:id/approve", async (req, res, next) => {
  try {
    const request = await LeaveRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Leave request not found" });

    request.status = "approved";
    request.adminNote = req.body.adminNote || "";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    const shiftFilter = request.shift === "full-day" ? { $in: ["morning", "afternoon"] } : request.shift;
    await WorkSchedule.updateMany({ user: request.user, date: request.date, shift: shiftFilter }, { status: "leave" });

    res.json(await request.populate(populateUser));
  } catch (error) {
    next(error);
  }
});

router.put("/leave-requests/:id/reject", async (req, res, next) => {
  try {
    const request = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", adminNote: req.body.adminNote || "", reviewedBy: req.user.id, reviewedAt: new Date() },
      { new: true }
    ).populate(populateUser);
    if (!request) return res.status(404).json({ message: "Leave request not found" });
    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.post("/tasks", async (req, res, next) => {
  try {
    const { title, description, date, assignedTo } = req.body;
    if (!title || !date || !assignedTo?.length) return res.status(400).json({ message: "Title, date and employees are required" });

    const task = await DailyTask.create({
      title,
      description,
      date,
      assignedTo,
      statusByUser: assignedTo.map((user) => ({ user, status: "not-started" })),
      createdBy: req.user.id,
    });

    res.status(201).json(await task.populate(populateAssigned));
  } catch (error) {
    next(error);
  }
});

router.get("/tasks", async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.date) filters.date = req.query.date;
    const tasks = await DailyTask.find(filters).populate(populateAssigned).populate("statusByUser.user", "name email").sort({ date: -1 });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get("/tasks/:id", async (req, res, next) => {
  try {
    const task = await DailyTask.findById(req.params.id).populate(populateAssigned).populate("statusByUser.user", "name email");
    if (!task) return res.status(404).json({ message: "Task not found" });
    const reports = await TaskReport.find({ task: task._id }).populate(populateUser).sort({ createdAt: -1 });
    res.json({ task, reports });
  } catch (error) {
    next(error);
  }
});

router.delete("/tasks/:id", async (req, res, next) => {
  try {
    const task = await DailyTask.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const reports = await TaskReport.find({ task: task._id }).select("_id");
    const reportIds = reports.map((report) => report._id);
    if (reportIds.length) {
      await ReportImage.deleteMany({ report: { $in: reportIds } });
      await TaskReport.deleteMany({ _id: { $in: reportIds } });
    }
    await task.deleteOne();

    res.json({ message: "Task deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/reports", async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.date) filters.date = req.query.date;
    const reports = await TaskReport.find(filters).populate(populateUser).populate("task", "title date").sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    next(error);
  }
});

router.get("/checkouts", async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.date) filters.date = req.query.date;
    const checkouts = await CheckoutLog.find(filters).populate(populateUser).sort({ checkoutAt: -1 });
    res.json(checkouts);
  } catch (error) {
    next(error);
  }
});

router.get("/salaries", async (req, res, next) => {
  try {
    const { month, year } = parseMonthYear(req.query);
    const employees = await User.find({ role: "user", active: true }).select("-password").sort({ name: 1 });
    const salaries = await Promise.all(
      employees.map(async (employee) => ({
        user: employee,
        month,
        year,
        ...(await calculateSalary(employee._id, month, year)),
      }))
    );
    res.json(salaries);
  } catch (error) {
    next(error);
  }
});

router.get("/salaries/:userId", async (req, res, next) => {
  try {
    const { month, year } = parseMonthYear(req.query);
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) return res.status(404).json({ message: "Employee not found" });
    res.json({ user, month, year, ...(await calculateSalary(user._id, month, year)) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
