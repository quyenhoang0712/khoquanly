const express = require("express");
const CheckoutLog = require("../models/CheckoutLog");
const DailyTask = require("../models/DailyTask");
const OvertimeRecord = require("../models/OvertimeRecord");
const ReportImage = require("../models/ReportImage");
const SalaryRecord = require("../models/SalaryRecord");
const ServiceExpense = require("../models/ServiceExpense");
const TaskReport = require("../models/TaskReport");
const User = require("../models/User");
const WeeklyScheduleRequest = require("../models/WeeklyScheduleRequest");
const WorkSchedule = require("../models/WorkSchedule");
const WorkRule = require("../models/WorkRule");
const { calculateSalary } = require("../utils/salary");
const { todayString } = require("../utils/date");
const { hashPassword } = require("../utils/password");

const router = express.Router();

const populateUser = { path: "user", select: "name email role position active hourlyRate" };
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

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00+07:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const weekRange = (dateString) => {
  const date = new Date(`${dateString}T00:00:00+07:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return {
    start: addDays(dateString, mondayOffset),
    end: addDays(dateString, mondayOffset + 6),
  };
};

const dateRangeFilter = ({ mode, date }) => {
  if (mode === "week") {
    const range = weekRange(date);
    return { range, filter: { $gte: range.start, $lte: range.end } };
  }
  return { range: { start: date, end: date }, filter: date };
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

const defaultShiftTasks = {
  sale: {
    morning: { title: "Lau nhà", description: "Việc mặc định cho nhân viên sale ca 1." },
    afternoon: { title: "Lau kệ", description: "Việc mặc định cho nhân viên sale ca 2." },
  },
  warehouse: {
    morning: { title: "Gói đơn", description: "Việc mặc định cho nhân viên kho ca 1." },
    afternoon: { title: "Dọn dẹp", description: "Việc mặc định cho nhân viên kho ca 2." },
  },
};

const removeUserFromTask = async (task, userId) => {
  task.assignedTo = task.assignedTo.filter((item) => String(item) !== String(userId));
  task.statusByUser = task.statusByUser.filter((item) => String(item.user) !== String(userId));

  if (task.assignedTo.length === 0) {
    await task.deleteOne();
    return;
  }

  await task.save();
};

const removeDefaultShiftTasksForUserDate = async ({ userId, date, shifts }) => {
  const filters = { source: "default-shift", date, assignedTo: userId };
  if (shifts?.length) filters.shift = { $in: shifts };
  const tasks = await DailyTask.find(filters);
  await Promise.all(tasks.map((task) => removeUserFromTask(task, userId)));
};

const ensureDefaultShiftTask = async ({ user, date, shift, adminId }) => {
  const position = user.position === "sale" ? "sale" : "warehouse";
  const defaultTask = defaultShiftTasks[position]?.[shift];
  if (!defaultTask) return null;

  const task = await DailyTask.findOne({
    date,
    source: "default-shift",
    position,
    shift,
    title: defaultTask.title,
  });

  if (!task) {
    return DailyTask.create({
      ...defaultTask,
      date,
      source: "default-shift",
      position,
      shift,
      assignedTo: [user._id],
      statusByUser: [{ user: user._id, status: "not-started" }],
      createdBy: adminId,
    });
  }

  if (!task.assignedTo.some((item) => String(item) === String(user._id))) {
    task.assignedTo.push(user._id);
  }
  if (!task.statusByUser.some((item) => String(item.user) === String(user._id))) {
    task.statusByUser.push({ user: user._id, status: "not-started" });
  }

  await task.save();
  return task;
};

const ensureDefaultShiftTasks = async ({ user, shifts, date, adminId }) => {
  for (const shift of shifts) {
    await ensureDefaultShiftTask({ user, date, shift, adminId });
  }
};

const ensureDefaultShiftTasksByDate = async ({ user, shifts, adminId }) => {
  for (const item of shifts) {
    await ensureDefaultShiftTask({ user, date: item.date, shift: item.shift, adminId });
  }
};

const schedulePositions = ["warehouse", "sale"];
const scheduleShifts = ["morning", "afternoon"];
const autoScheduleCapacity = {
  warehouse: 2,
  sale: 1,
};

const buildAutoSchedulePlan = async (weekStart) => {
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    const error = new Error("Vui lòng chọn tuần cần xếp lịch");
    error.statusCode = 400;
    throw error;
  }

  await retireDuplicatePendingScheduleRequests();

  const requests = await WeeklyScheduleRequest.find({ weekStart, status: "pending" })
    .populate(populateUser)
    .sort({ createdAt: 1 });

  if (requests.length === 0) {
    const error = new Error("Không có phiếu đăng ký đang chờ cho tuần này");
    error.statusCode = 400;
    throw error;
  }

  const assignedCounts = new Map();
  const requestedCounts = new Map();
  const assignments = [];
  const existingAssignments = [];
  const shortages = [];
  const requestSummaries = new Map();
  const existingBySlot = new Map();

  const weekEnd = addDays(weekStart, 6);
  const existingSchedules = await WorkSchedule.find({
    date: { $gte: weekStart, $lte: weekEnd },
    status: "scheduled",
  }).populate(populateUser);

  existingSchedules.forEach((schedule) => {
    const position = schedule.user?.position || "warehouse";
    const slotKey = `${schedule.date}-${schedule.shift}-${position}`;
    existingBySlot.set(slotKey, (existingBySlot.get(slotKey) || 0) + 1);
    existingAssignments.push({
      user: schedule.user,
      date: schedule.date,
      shift: schedule.shift,
      position,
    });
  });

  requests.forEach((request) => {
    const userId = String(request.user?._id || request.user);
    assignedCounts.set(userId, 0);
    requestedCounts.set(userId, request.shifts.length);
    requestSummaries.set(String(request._id), {
      requestId: request._id,
      user: request.user,
      requestedShifts: request.shifts.length,
      assignedShifts: 0,
    });
  });

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const date = addDays(weekStart, dayIndex);
    for (const shift of scheduleShifts) {
      for (const position of schedulePositions) {
        const candidates = requests
          .filter((request) => {
            const userPosition = request.user?.position || "warehouse";
            return userPosition === position && request.shifts.some((item) => item.date === date && item.shift === shift);
          })
          .sort((a, b) => {
            const userA = String(a.user?._id || a.user);
            const userB = String(b.user?._id || b.user);
            const assignedDiff = (assignedCounts.get(userA) || 0) - (assignedCounts.get(userB) || 0);
            if (assignedDiff !== 0) return assignedDiff;
            const requestDiff = (requestedCounts.get(userA) || 0) - (requestedCounts.get(userB) || 0);
            if (requestDiff !== 0) return requestDiff;
            return String(a.user?.name || "").localeCompare(String(b.user?.name || ""), "vi");
          });

        const capacity = autoScheduleCapacity[position];
        const existingCount = existingBySlot.get(`${date}-${shift}-${position}`) || 0;
        const remainingCapacity = Math.max(capacity - existingCount, 0);
        const selected = candidates.slice(0, remainingCapacity);

        selected.forEach((request) => {
          const userId = String(request.user?._id || request.user);
          const requestId = String(request._id);
          assignedCounts.set(userId, (assignedCounts.get(userId) || 0) + 1);
          requestSummaries.get(requestId).assignedShifts += 1;
          assignments.push({
            requestId: request._id,
            user: request.user,
            date,
            shift,
            position,
          });
        });

        if (existingCount + selected.length < capacity) {
          shortages.push({
            date,
            shift,
            position,
            needed: capacity,
            assigned: existingCount + selected.length,
          });
        }
      }
    }
  }

  return {
    weekStart,
    rules: {
      warehousePerShift: autoScheduleCapacity.warehouse,
      salePerShift: autoScheduleCapacity.sale,
    },
    assignments,
    existingAssignments,
    shortages,
    requestSummaries: Array.from(requestSummaries.values()),
  };
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
  await removeDefaultShiftTasksForUserDate({ userId, date });
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
  if (status !== "leave") await ensureDefaultShiftTasks({ user: employee, shifts, date, adminId });

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

router.get("/rules", async (req, res, next) => {
  try {
    const rules = await WorkRule.find({}).sort({ order: 1, createdAt: 1 });
    res.json(rules);
  } catch (error) {
    next(error);
  }
});

router.post("/rules", async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const order = Number(req.body.order || 0);
    const active = req.body.active !== false;

    if (!title || !content) return res.status(400).json({ message: "Vui lòng nhập tiêu đề và nội dung nội quy" });

    const rule = await WorkRule.create({
      title,
      content,
      order: Number.isFinite(order) ? order : 0,
      active,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    res.status(201).json(rule);
  } catch (error) {
    next(error);
  }
});

router.put("/rules/:id", async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const order = Number(req.body.order || 0);
    const active = req.body.active !== false;

    if (!title || !content) return res.status(400).json({ message: "Vui lòng nhập tiêu đề và nội dung nội quy" });

    const rule = await WorkRule.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content,
        order: Number.isFinite(order) ? order : 0,
        active,
        updatedBy: req.user.id,
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!rule) return res.status(404).json({ message: "Không tìm thấy nội quy" });
    res.json(rule);
  } catch (error) {
    next(error);
  }
});

router.delete("/rules/:id", async (req, res, next) => {
  try {
    const rule = await WorkRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: "Không tìm thấy nội quy" });
    res.json({ message: "Đã xoá nội quy" });
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
  const travelAllowanceEnabled = req.body.travelAllowanceEnabled === true;
  const travelAllowanceAmount = Number(req.body.travelAllowanceAmount || 150000);

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    const existed = await User.findOne({ email });
    if (existed?.active) {
      return res.status(409).json({ message: "Email này đã tồn tại" });
    }

    const userPayload = {
      name,
      email,
      password: hashPassword(password),
      role: "user",
      position,
      hourlyRate,
      travelAllowanceEnabled,
      travelAllowanceAmount: Number.isFinite(travelAllowanceAmount) ? travelAllowanceAmount : 150000,
      active: true,
    };

    const user = existed
      ? await User.findByIdAndUpdate(existed._id, userPayload, { returnDocument: "after", runValidators: true })
      : await User.create(userPayload);

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
  const travelAllowanceEnabled = req.body.travelAllowanceEnabled === true;
  const travelAllowanceAmount = Number(req.body.travelAllowanceAmount || 150000);

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

    const update = {
      name,
      email,
      position,
      hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : 30000,
      travelAllowanceEnabled,
      travelAllowanceAmount: Number.isFinite(travelAllowanceAmount) ? travelAllowanceAmount : 150000,
    };
    if (password) update.password = hashPassword(password);

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "user", active: true },
      update,
      { returnDocument: "after", runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "Không tìm thấy nhân sự" });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await User.findOne({ _id: userId, role: "user" }).select("-password");

    if (!user) return res.status(404).json({ message: "Không tìm thấy nhân sự" });

    const taskReports = await TaskReport.find({ user: userId }).select("_id");
    const taskReportIds = taskReports.map((report) => report._id);
    const tasksOnlyAssignedToUser = await DailyTask.find({ $and: [{ assignedTo: userId }, { assignedTo: { $size: 1 } }] }).select("_id");
    const taskIdsToDelete = tasksOnlyAssignedToUser.map((task) => task._id);

    const [
      schedules,
      scheduleRequests,
      overtime,
      serviceExpenses,
      checkouts,
      salaryRecords,
      taskReportsDeleted,
      reportImages,
      deletedTasks,
      updatedTasks,
      deletedUser,
    ] = await Promise.all([
      WorkSchedule.deleteMany({ user: userId }),
      WeeklyScheduleRequest.deleteMany({ user: userId }),
      OvertimeRecord.deleteMany({ user: userId }),
      ServiceExpense.deleteMany({ user: userId }),
      CheckoutLog.deleteMany({ user: userId }),
      SalaryRecord.deleteMany({ user: userId }),
      TaskReport.deleteMany({ user: userId }),
      ReportImage.deleteMany({ $or: [{ user: userId }, { report: { $in: taskReportIds } }] }),
      DailyTask.deleteMany({ _id: { $in: taskIdsToDelete } }),
      DailyTask.updateMany(
        { assignedTo: userId, _id: { $nin: taskIdsToDelete } },
        {
          $pull: {
            assignedTo: user._id,
            statusByUser: { user: user._id },
          },
        }
      ),
      User.deleteOne({ _id: userId, role: "user" }),
    ]);

    res.json({
      message: "Đã xoá nhân sự và dữ liệu liên quan",
      user,
      deleted: {
        schedules: schedules.deletedCount || 0,
        scheduleRequests: scheduleRequests.deletedCount || 0,
        overtime: overtime.deletedCount || 0,
        serviceExpenses: serviceExpenses.deletedCount || 0,
        checkouts: checkouts.deletedCount || 0,
        salaryRecords: salaryRecords.deletedCount || 0,
        taskReports: taskReportsDeleted.deletedCount || 0,
        reportImages: reportImages.deletedCount || 0,
        tasks: deletedTasks.deletedCount || 0,
        taskAssignments: updatedTasks.modifiedCount || 0,
        users: deletedUser.deletedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const date = req.query.date || todayString();
    const mode = req.query.mode === "week" ? "week" : "day";
    const { range, filter } = dateRangeFilter({ mode, date });
    const [employees, pendingSchedules, pendingOvertime, tasks, reports, checkouts, schedules] = await Promise.all([
      User.find({ role: "user", active: true }).select("name email position").sort({ name: 1 }).lean(),
      WeeklyScheduleRequest.countDocuments({ status: "pending" }),
      OvertimeRecord.countDocuments({ status: "pending" }),
      DailyTask.find({ date: filter }).select("title date assignedTo statusByUser").lean(),
      TaskReport.countDocuments({ date: filter }),
      CheckoutLog.find({ date: filter }).select("user date checkoutAt").lean(),
      WorkSchedule.find({ date: filter, status: "scheduled" }).select("user date shift").lean(),
    ]);
    const scheduleByUser = new Map();
    const checkoutByUser = new Map();
    const taskByUser = new Map();
    const employeeById = new Map(employees.map((employee) => [String(employee._id), employee]));
    const activeUserIds = new Set(employees.map((employee) => String(employee._id)));
    const validSchedules = schedules.filter((schedule) => activeUserIds.has(String(schedule.user)));
    const scheduledDateKeys = new Set(validSchedules.map((schedule) => `${schedule.user}-${schedule.date}`));
    const validCheckouts = checkouts.filter((checkout) => {
      const userId = String(checkout.user);
      return activeUserIds.has(userId) && scheduledDateKeys.has(`${userId}-${checkout.date}`);
    });

    validSchedules.forEach((schedule) => {
      const userId = String(schedule.user);
      const item = scheduleByUser.get(userId) || { dates: new Set(), shifts: 0 };
      item.dates.add(schedule.date);
      item.shifts += 1;
      scheduleByUser.set(userId, item);
    });

    validCheckouts.forEach((checkout) => {
      const userId = String(checkout.user);
      const item = checkoutByUser.get(userId) || { dates: new Set(), count: 0 };
      item.dates.add(checkout.date);
      item.count += 1;
      checkoutByUser.set(userId, item);
    });

    tasks.forEach((task) => {
      (task.assignedTo || []).forEach((assignedUser) => {
        const userId = String(assignedUser);
        const status = task.statusByUser?.find((item) => String(item.user) === userId)?.status || "not-started";
        const item = taskByUser.get(userId) || { assigned: 0, completed: 0, inProgress: 0, notStarted: 0 };
        item.assigned += 1;
        if (status === "completed") item.completed += 1;
        else if (status === "in-progress") item.inProgress += 1;
        else item.notStarted += 1;
        taskByUser.set(userId, item);
      });
    });

    const checkoutDateKeys = new Set(validCheckouts.map((checkout) => `${checkout.user}-${checkout.date}`));
    const missingCheckoutMap = new Map();
    validSchedules
      .filter((schedule) => schedule.date <= todayString())
      .forEach((schedule) => {
        const key = `${schedule.user}-${schedule.date}`;
        if (checkoutDateKeys.has(key)) return;
        const user = employeeById.get(String(schedule.user));
        const item = missingCheckoutMap.get(key) || {
          user,
          date: schedule.date,
          shifts: [],
        };
        item.shifts.push(schedule.shift);
        missingCheckoutMap.set(key, item);
      });

    const unfinishedTasks = tasks.flatMap((task) =>
      (task.assignedTo || [])
        .map((assignedUser) => {
          const userId = String(assignedUser);
          const status = task.statusByUser?.find((item) => String(item.user) === userId)?.status || "not-started";
          return {
            taskId: task._id,
            title: task.title,
            date: task.date,
            user: employeeById.get(userId),
            status,
          };
        })
        .filter((item) => item.user && item.status !== "completed")
    );

    const employeeRows = employees.map((employee) => {
      const userId = String(employee._id);
      const schedule = scheduleByUser.get(userId) || { dates: new Set(), shifts: 0 };
      const checkout = checkoutByUser.get(userId) || { dates: new Set(), count: 0 };
      const task = taskByUser.get(userId) || { assigned: 0, completed: 0, inProgress: 0, notStarted: 0 };
      return {
        user: employee,
        position: employee.position || "warehouse",
        scheduledDays: schedule.dates.size,
        scheduledShifts: schedule.shifts,
        checkoutDays: checkout.dates.size,
        checkoutCount: checkout.count,
        tasks: task,
      };
    });

    const buildPositionSummary = (position) => {
      const rows = employeeRows.filter((item) => item.position === position);
      return {
        employees: rows.length,
        scheduledEmployees: rows.filter((item) => item.scheduledDays > 0).length,
        scheduledShifts: rows.reduce((sum, item) => sum + item.scheduledShifts, 0),
        checkoutDays: rows.reduce((sum, item) => sum + item.checkoutDays, 0),
        assignedTasks: rows.reduce((sum, item) => sum + item.tasks.assigned, 0),
        completedTasks: rows.reduce((sum, item) => sum + item.tasks.completed, 0),
        inProgressTasks: rows.reduce((sum, item) => sum + item.tasks.inProgress, 0),
        notStartedTasks: rows.reduce((sum, item) => sum + item.tasks.notStarted, 0),
      };
    };

    res.json({
      mode,
      date,
      range,
      employees: employees.length,
      pendingSchedules,
      pendingOvertime,
      tasks: tasks.length,
      reports,
      checkouts: validCheckouts.length,
      schedules: validSchedules.length,
      scheduledEmployees: employeeRows.filter((item) => item.scheduledDays > 0).length,
      positionSummary: {
        warehouse: buildPositionSummary("warehouse"),
        sale: buildPositionSummary("sale"),
      },
      employeeRows,
      actionItems: {
        pendingSchedules,
        pendingOvertime,
        missingCheckouts: Array.from(missingCheckoutMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
        unfinishedTasks,
      },
      todayTasks: tasks.length,
      todayReports: reports,
      todayCheckouts: validCheckouts.length,
    });
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
    await removeDefaultShiftTasksForUserDate({ userId: req.params.userId, date: req.params.date });
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

router.post("/schedule-requests/auto-schedule", async (req, res, next) => {
  try {
    const plan = await buildAutoSchedulePlan(req.body.weekStart);

    if (req.body.apply === true) {
      await Promise.all(
        plan.assignments.map((item) =>
          WorkSchedule.updateOne(
            { user: item.user._id, date: item.date, shift: item.shift },
            {
              user: item.user._id,
              date: item.date,
              shift: item.shift,
              status: "scheduled",
              request: item.requestId,
              approvedBy: req.user.id,
            },
            { upsert: true }
          )
        )
      );
      for (const item of plan.assignments) {
        await ensureDefaultShiftTask({
          user: item.user,
          date: item.date,
          shift: item.shift,
          adminId: req.user.id,
        });
      }

      await Promise.all(
        plan.requestSummaries.map((item) =>
          WeeklyScheduleRequest.updateOne(
            { _id: item.requestId, status: "pending" },
            {
              status: "approved",
              adminNote: `AI xếp ${item.assignedShifts}/${item.requestedShifts} ca đã đăng ký.`,
              reviewedBy: req.user.id,
              reviewedAt: new Date(),
            }
          )
        )
      );
    }

    res.json({ ...plan, applied: req.body.apply === true });
  } catch (error) {
    next(error);
  }
});

router.put("/schedule-requests/:id/approve", async (req, res, next) => {
  try {
    const request = await WeeklyScheduleRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Schedule request not found" });
    const employee = await User.findOne({ _id: request.user, role: "user", active: true });
    if (!employee) return res.status(404).json({ message: "Không tìm thấy nhân viên" });

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
    await ensureDefaultShiftTasksByDate({ user: employee, shifts: request.shifts, adminId: req.user.id });

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
      { returnDocument: "after" }
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

router.post("/checkouts/manual", async (req, res, next) => {
  try {
    const userId = String(req.body.userId || "").trim();
    const date = String(req.body.date || "").trim();
    if (!userId || !date) return res.status(400).json({ message: "Vui lòng chọn nhân viên và ngày checkout" });

    const user = await User.findOne({ _id: userId, role: "user", active: true }).select("_id");
    if (!user) return res.status(404).json({ message: "Không tìm thấy nhân viên" });

    const checkoutAt = req.body.checkoutAt ? new Date(req.body.checkoutAt) : new Date(`${date}T23:59:00+07:00`);
    if (Number.isNaN(checkoutAt.getTime())) return res.status(400).json({ message: "Thời gian checkout không hợp lệ" });

    const checkout = await CheckoutLog.findOneAndUpdate(
      { user: userId, date },
      {
        $setOnInsert: {
          user: userId,
          date,
          images: [],
        },
        $set: {
          checkoutAt,
          note: req.body.note || "Admin xác nhận checkout thủ công.",
        },
      },
      { returnDocument: "after", upsert: true, runValidators: true }
    ).populate(populateUser);

    const item = checkout.toObject();
    item.imageUrls = (item.images || []).map((image) => publicAssetUrl(req, image));
    res.status(201).json(item);
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
    const records = (await OvertimeRecord.find({ month, year }).populate(populateUser).sort({ createdAt: -1 }))
      .filter((record) => record.user && record.user.active !== false);
    res.json(records);
  } catch (error) {
    next(error);
  }
});

router.get("/service-expenses", async (req, res, next) => {
  try {
    const { month, year } = parseMonthYear(req.query);
    const { prefix } = calendarMonthRange(month, year);
    const allRows = await ServiceExpense.find({ date: { $regex: `^${prefix}` } }).populate(populateUser).sort({ date: -1, createdAt: -1 });
    const rows = allRows.filter((row) => row.user && row.user.active !== false);
    const byUserMap = new Map();

    rows.forEach((row) => {
      const userId = String(row.user?._id || row.user);
      const current = byUserMap.get(userId) || {
        user: row.user,
        records: 0,
        amount: 0,
      };
      current.records += 1;
      current.amount += Number(row.amount || 0);
      byUserMap.set(userId, current);
    });

    res.json({
      month,
      year,
      totalRecords: rows.length,
      totalAmount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      employees: byUserMap.size,
      byUser: Array.from(byUserMap.values()).sort((a, b) => b.amount - a.amount),
      rows,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/overtime", async (req, res, next) => {
  try {
    const userId = req.body.userId;
    const date = String(req.body.date || "").trim();
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
      date,
      month,
      year,
      hours,
      hourlyRate,
      amount: hours * hourlyRate,
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: req.user.id,
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
    const date = String(req.body.date || "").trim();
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
        ...(date ? { date } : {}),
        hours,
        hourlyRate,
        amount: hours * hourlyRate,
        note,
      },
      { returnDocument: "after", runValidators: true }
    ).populate(populateUser);

    if (!record) return res.status(404).json({ message: "Không tìm thấy tăng ca" });
    res.json(record);
  } catch (error) {
    next(error);
  }
});

router.put("/overtime/:id/review", async (req, res, next) => {
  try {
    const action = String(req.body.action || "").trim();
    const adminNote = String(req.body.adminNote || "").trim();
    if (!["approved", "rejected"].includes(action)) {
      return res.status(400).json({ message: "Trạng thái duyệt tăng ca không hợp lệ" });
    }

    const record = await OvertimeRecord.findById(req.params.id).populate(populateUser);
    if (!record) return res.status(404).json({ message: "Không tìm thấy phiếu tăng ca" });
    if (!record.user || record.user.active === false) return res.status(404).json({ message: "Nhân viên không còn hoạt động" });

    const hourlyRate = Number(record.user.hourlyRate || record.hourlyRate || 30000);
    record.hourlyRate = hourlyRate;
    record.amount = action === "approved" ? Number(record.hours || 0) * hourlyRate : 0;
    record.status = action;
    record.adminNote = adminNote;
    record.reviewedAt = new Date();
    record.reviewedBy = req.user.id;
    await record.save();

    res.json(await record.populate(populateUser));
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
