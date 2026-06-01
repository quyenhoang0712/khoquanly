const express = require("express");
const CheckoutLog = require("../models/CheckoutLog");
const DailyTask = require("../models/DailyTask");
const OvertimeRecord = require("../models/OvertimeRecord");
const ReportImage = require("../models/ReportImage");
const TaskReport = require("../models/TaskReport");
const User = require("../models/User");
const WeeklyScheduleRequest = require("../models/WeeklyScheduleRequest");
const WorkSchedule = require("../models/WorkSchedule");
const { calculateSalary } = require("../utils/salary");
const { todayString } = require("../utils/date");

const router = express.Router();

const populateUser = { path: "user", select: "name email role position" };
const populateAssigned = { path: "assignedTo", select: "name email" };

const requestOrigin = (req) => {
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");
  return `${protocol}://${host}`;
};

const publicAssetUrl = (req, path) => {
  if (!path) return "";
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:") || path.startsWith("blob:")) return path;
  return `${requestOrigin(req)}${path.startsWith("/") ? "" : "/"}${path}`;
};

const parseMonthYear = (query) => {
  const [currentYear, currentMonth] = todayString().split("-").map(Number);
  return {
    month: Number(query.month || currentMonth),
    year: Number(query.year || currentYear),
  };
};

const calendarMonthRange = (month, year) => {
  const paddedMonth = String(month).padStart(2, "0");
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    start: `${year}-${paddedMonth}-01`,
    end: `${year}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`,
    prefix: `${year}-${paddedMonth}`,
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

const retireDuplicatePendingScheduleRequests = async () => {
  const pending = await WeeklyScheduleRequest.find({ status: "pending" }).sort({ createdAt: -1 }).select("_id user weekStart");
  const seen = new Set();
  const duplicateIds = [];

  pending.forEach((request) => {
    const key = `${request.user}-${request.weekStart}`;
    if (seen.has(key)) {
      duplicateIds.push(request._id);
      return;
    }
    seen.add(key);
  });

  if (duplicateIds.length === 0) return 0;
  const result = await WeeklyScheduleRequest.updateMany(
    { _id: { $in: duplicateIds }, status: "pending" },
    { status: "rejected", adminNote: "Tự động ẩn phiếu đăng ký bị trùng.", reviewedAt: new Date() }
  );
  return result.modifiedCount || 0;
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
  const position = ["warehouse", "sale"].includes(req.body.position) ? req.body.position : "warehouse";
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
      position,
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

router.put("/users/:id", async (req, res, next) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const position = ["warehouse", "sale"].includes(req.body.position) ? req.body.position : "warehouse";
  const hourlyRate = Number(req.body.hourlyRate || 0);

  try {
    if (!name || !email) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ họ tên và email" });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    const existed = await User.findOne({ email, _id: { $ne: req.params.id } });
    if (existed) {
      return res.status(409).json({ message: "Email này đã tồn tại" });
    }

    const update = { name, email, position, hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : 30000 };
    if (password) update.password = password;

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "user", active: true },
      update,
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "Không tìm thấy nhân sự" });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "user", active: true },
      { active: false },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "Không tìm thấy nhân sự" });
    res.json({ message: "Đã xoá nhân sự", user });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const date = req.query.date || todayString();
    const [employees, pendingSchedules, tasks, reports, checkouts] = await Promise.all([
      User.countDocuments({ role: "user", active: true }),
      WeeklyScheduleRequest.countDocuments({ status: "pending" }),
      DailyTask.countDocuments({ date }),
      TaskReport.countDocuments({ date }),
      CheckoutLog.countDocuments({ date }),
    ]);

    res.json({ employees, pendingSchedules, todayTasks: tasks, todayReports: reports, todayCheckouts: checkouts });
  } catch (error) {
    next(error);
  }
});

router.get("/schedules", async (req, res, next) => {
  try {
    const filters = {};
    applyDateFilters(filters, req.query);
    if (req.query.userId) filters.user = req.query.userId;
    if (["warehouse", "sale"].includes(req.query.position)) {
      const users = await User.find({ role: "user", active: true, position: req.query.position }).select("_id");
      filters.user = { $in: users.map((user) => user._id) };
    }
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
    if (!req.query.status || req.query.status === "pending") {
      await retireDuplicatePendingScheduleRequests();
    }
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (["warehouse", "sale"].includes(req.query.position)) {
      const users = await User.find({ role: "user", active: true, position: req.query.position }).select("_id");
      filters.user = { $in: users.map((user) => user._id) };
    }
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
    const reports = await TaskReport.find(filters)
      .populate(populateUser)
      .populate({
        path: "task",
        select: "title date statusByUser",
        populate: { path: "statusByUser.user", select: "name email" },
      })
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    next(error);
  }
});

router.get("/monthly-report", async (req, res, next) => {
  try {
    const { month, year } = parseMonthYear(req.query);
    const { start, end, prefix } = calendarMonthRange(month, year);
    const today = todayString();
    const employees = await User.find({ role: "user", active: true }).select("-password").sort({ name: 1 });

    const [salaryRows, tasks, reports, checkouts, schedules] = await Promise.all([
      Promise.all(
        employees.map(async (employee) => ({
          user: employee,
          month,
          year,
          ...(await calculateSalary(employee._id, month, year)),
        }))
      ),
      DailyTask.find({ date: { $regex: `^${prefix}` } })
        .populate(populateAssigned)
        .populate("statusByUser.user", "name email")
        .sort({ date: 1, createdAt: -1 }),
      TaskReport.find({ date: { $regex: `^${prefix}` } }).populate(populateUser).populate("task", "title date").sort({ createdAt: -1 }),
      CheckoutLog.find({ date: { $regex: `^${prefix}` } }).populate(populateUser).sort({ date: 1 }),
      WorkSchedule.find({ status: "scheduled", date: { $gte: start, $lte: end } }).populate(populateUser).sort({ date: 1 }),
    ]);

    const taskStatuses = tasks.flatMap((task) => task.statusByUser?.map((item) => item.status || "not-started") || []);
    const checkoutKeys = new Set(checkouts.map((item) => `${item.user?._id || item.user}-${item.date}`));
    const scheduledByEmployee = new Map();

    schedules.forEach((schedule) => {
      const userId = String(schedule.user?._id || schedule.user);
      const current = scheduledByEmployee.get(userId) || {
        user: schedule.user,
        scheduledDates: new Set(),
        dueDates: new Set(),
      };
      current.scheduledDates.add(schedule.date);
      if (schedule.date <= today) current.dueDates.add(schedule.date);
      scheduledByEmployee.set(userId, current);
    });

    const checkoutEmployees = employees.map((employee) => {
      const userId = String(employee._id);
      const item = scheduledByEmployee.get(userId);
      const scheduledDates = item ? Array.from(item.scheduledDates).sort() : [];
      const dueDates = item ? Array.from(item.dueDates).sort() : [];
      const checkedOutDates = dueDates.filter((date) => checkoutKeys.has(`${userId}-${date}`));
      const missingDates = dueDates.filter((date) => !checkoutKeys.has(`${userId}-${date}`));

      return {
        user: employee,
        scheduledDays: scheduledDates.length,
        dueDays: dueDates.length,
        checkedOutDays: checkedOutDates.length,
        missingDays: missingDates.length,
        missingDates,
      };
    });

    res.json({
      month,
      year,
      range: { start, end },
      salary: {
        employees: salaryRows.length,
        totalShifts: salaryRows.reduce((sum, row) => sum + Number(row.totalShifts || 0), 0),
        totalHours: salaryRows.reduce((sum, row) => sum + Number(row.totalHours || 0), 0),
        totalSalary: salaryRows.reduce((sum, row) => sum + Number(row.totalSalary || 0), 0),
        rows: salaryRows,
      },
      work: {
        totalTasks: tasks.length,
        totalAssignments: taskStatuses.length,
        notStarted: taskStatuses.filter((status) => status === "not-started").length,
        inProgress: taskStatuses.filter((status) => status === "in-progress").length,
        completed: taskStatuses.filter((status) => status === "completed").length,
        reports: reports.length,
        tasks,
        reportRows: reports,
      },
      checkout: {
        scheduledDays: checkoutEmployees.reduce((sum, item) => sum + item.dueDays, 0),
        checkedOutDays: checkoutEmployees.reduce((sum, item) => sum + item.checkedOutDays, 0),
        missingDays: checkoutEmployees.reduce((sum, item) => sum + item.missingDays, 0),
        employees: checkoutEmployees,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/checkouts", async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.date) filters.date = req.query.date;
    const checkouts = await CheckoutLog.find(filters).populate(populateUser).sort({ checkoutAt: -1 });
    res.json(
      checkouts.map((checkout) => {
        const item = checkout.toObject();
        item.imageUrls = (item.images || []).map((image) => publicAssetUrl(req, image));
        return item;
      })
    );
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

router.get("/overtime", async (req, res, next) => {
  try {
    const { month, year } = parseMonthYear(req.query);
    const records = await OvertimeRecord.find({ month, year }).populate(populateUser).sort({ createdAt: -1 });
    res.json(records);
  } catch (error) {
    next(error);
  }
});

router.post("/overtime", async (req, res, next) => {
  try {
    const userId = req.body.userId;
    const month = Number(req.body.month);
    const year = Number(req.body.year);
    const hours = Number(req.body.hours);
    const note = String(req.body.note || "").trim();

    if (!userId || !month || !year || !Number.isFinite(hours) || hours <= 0) {
      return res.status(400).json({ message: "Vui lòng chọn nhân viên, tháng/năm và số giờ tăng ca hợp lệ" });
    }

    const user = await User.findOne({ _id: userId, role: "user", active: true }).select("hourlyRate");
    if (!user) return res.status(404).json({ message: "Không tìm thấy nhân sự" });

    const hourlyRate = Number(user.hourlyRate || 30000);
    const record = await OvertimeRecord.create({
      user: user._id,
      month,
      year,
      hours,
      hourlyRate,
      amount: hours * hourlyRate,
      note,
      createdBy: req.user.id,
    });

    res.status(201).json(await record.populate(populateUser));
  } catch (error) {
    next(error);
  }
});

router.put("/overtime/:id", async (req, res, next) => {
  try {
    const userId = req.body.userId;
    const hours = Number(req.body.hours);
    const note = String(req.body.note || "").trim();

    if (!userId || !Number.isFinite(hours) || hours <= 0) {
      return res.status(400).json({ message: "Vui lòng chọn nhân viên và số giờ tăng ca hợp lệ" });
    }

    const user = await User.findOne({ _id: userId, role: "user", active: true }).select("hourlyRate");
    if (!user) return res.status(404).json({ message: "Không tìm thấy nhân sự" });

    const hourlyRate = Number(user.hourlyRate || 30000);
    const record = await OvertimeRecord.findByIdAndUpdate(
      req.params.id,
      {
        user: user._id,
        hours,
        hourlyRate,
        amount: hours * hourlyRate,
        note,
      },
      { new: true, runValidators: true }
    ).populate(populateUser);

    if (!record) return res.status(404).json({ message: "Không tìm thấy tăng ca" });
    res.json(record);
  } catch (error) {
    next(error);
  }
});

router.delete("/overtime/:id", async (req, res, next) => {
  try {
    const record = await OvertimeRecord.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: "Không tìm thấy tăng ca" });
    res.json({ message: "Đã xoá tăng ca" });
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
