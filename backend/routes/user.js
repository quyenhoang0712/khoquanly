const express = require("express");
const multer = require("multer");
const CheckoutLog = require("../models/CheckoutLog");
const DailyTask = require("../models/DailyTask");
const OvertimeRecord = require("../models/OvertimeRecord");
const ReportImage = require("../models/ReportImage");
const ServiceExpense = require("../models/ServiceExpense");
const TaskReport = require("../models/TaskReport");
const WeeklyScheduleRequest = require("../models/WeeklyScheduleRequest");
const WorkSchedule = require("../models/WorkSchedule");
const WorkRule = require("../models/WorkRule");
const User = require("../models/User");
const { uploadImages } = require("../utils/cloudinary");
const { calculateSalary } = require("../utils/salary");
const { todayString } = require("../utils/date");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads are allowed"));
    cb(null, true);
  },
});

const serializeTaskForUser = (task, userId) => {
  const data = task.toObject ? task.toObject() : task;
  const currentStatus = data.statusByUser?.find((item) => String(item.user?._id || item.user) === userId);
  return {
    ...data,
    currentStatus: currentStatus?.status || "not-started",
  };
};

router.get("/my-schedule", async (req, res, next) => {
  try {
    const filters = { user: req.user.id };
    if (req.query.date) filters.date = req.query.date;
    if (req.query.month && req.query.year) {
      const month = String(req.query.month).padStart(2, "0");
      filters.date = { $regex: `^${req.query.year}-${month}` };
    }
    const schedules = await WorkSchedule.find(filters).sort({ date: 1, shift: 1 });
    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

router.get("/my-checkouts", async (req, res, next) => {
  try {
    const filters = { user: req.user.id };
    if (req.query.date) filters.date = req.query.date;
    if (req.query.month && req.query.year) {
      const month = String(req.query.month).padStart(2, "0");
      filters.date = { $regex: `^${req.query.year}-${month}` };
    }
    const checkouts = await CheckoutLog.find(filters).sort({ date: 1 });
    res.json(checkouts);
  } catch (error) {
    next(error);
  }
});

router.get("/coworkers", async (req, res, next) => {
  try {
    const date = req.query.date || todayString();
    const mySchedules = await WorkSchedule.find({ user: req.user.id, date, status: "scheduled" }).lean();
    const shifts = [...new Set(mySchedules.map((item) => item.shift))];
    const coworkers = await WorkSchedule.find({ user: { $ne: req.user.id }, date, shift: { $in: shifts }, status: "scheduled" })
      .populate("user", "name email")
      .sort({ shift: 1 });
    const uniqueCoworkers = Array.from(
      coworkers
        .reduce((map, item) => {
          const userId = String(item.user?._id || item.user);
          if (!map.has(userId)) {
            map.set(userId, { ...item.toObject(), shifts: [item.shift] });
          } else {
            map.get(userId).shifts.push(item.shift);
          }
          return map;
        }, new Map())
        .values()
    );
    res.json(uniqueCoworkers);
  } catch (error) {
    next(error);
  }
});

router.get("/schedule-requests", async (req, res, next) => {
  try {
    const filters = { user: req.user.id };
    if (req.query.weekStart) filters.weekStart = req.query.weekStart;
    if (req.query.status) filters.status = req.query.status;

    const requests = await WeeklyScheduleRequest.find(filters).sort({ weekStart: -1, createdAt: -1 });
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.post("/schedule-requests", async (req, res, next) => {
  try {
    const { weekStart, shifts, note } = req.body;
    if (!weekStart || !shifts?.length) return res.status(400).json({ message: "Vui lòng chọn ít nhất một ca đi làm trong tuần sau" });
    const request = await WeeklyScheduleRequest.findOneAndUpdate(
      { user: req.user.id, weekStart },
      { user: req.user.id, weekStart, shifts, note, status: "pending", adminNote: "", reviewedAt: null },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

router.get("/today-tasks", async (req, res, next) => {
  try {
    const date = req.query.date || todayString();
    const tasks = await DailyTask.find({ date, assignedTo: req.user.id }).populate("assignedTo", "name email").sort({ createdAt: -1 });
    res.json(tasks.map((task) => serializeTaskForUser(task, req.user.id)));
  } catch (error) {
    next(error);
  }
});

router.get("/tasks/:id", async (req, res, next) => {
  try {
    const task = await DailyTask.findOne({ _id: req.params.id, assignedTo: req.user.id }).populate("assignedTo", "name email");
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(serializeTaskForUser(task, req.user.id));
  } catch (error) {
    next(error);
  }
});

router.put("/tasks/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["not-started", "in-progress", "completed"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    const task = await DailyTask.findOne({ _id: req.params.id, assignedTo: req.user.id });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const current = task.statusByUser.find((item) => String(item.user) === req.user.id);
    if (current) {
      current.status = status;
      current.updatedAt = new Date();
    } else {
      task.statusByUser.push({ user: req.user.id, status, updatedAt: new Date() });
    }
    await task.save();
    res.json(serializeTaskForUser(task, req.user.id));
  } catch (error) {
    next(error);
  }
});

router.post("/tasks/:id/report", upload.array("images", 6), async (req, res, next) => {
  try {
    const task = await DailyTask.findOne({ _id: req.params.id, assignedTo: req.user.id });
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!req.body.content) return res.status(400).json({ message: "Report content is required" });

    const imagePaths = await uploadImages(req.files || []);
    const report = await TaskReport.create({ task: task._id, user: req.user.id, date: task.date, content: req.body.content, images: imagePaths });
    await ReportImage.insertMany(imagePaths.map((item, index) => ({ report: report._id, user: req.user.id, path: item, originalName: req.files[index].originalname })));

    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

router.post("/checkout", upload.array("images", 6), async (req, res, next) => {
  try {
    const date = req.body.date || todayString();
    if (date !== todayString()) {
      return res.status(400).json({ message: "Chỉ được checkout cho ngày hôm nay" });
    }

    const imagePaths = await uploadImages(req.files || []);
    const update = {
      user: req.user.id,
      date,
      checkoutAt: new Date(),
      note: req.body.note || "",
    };
    if (imagePaths.length) update.images = imagePaths;

    const checkout = await CheckoutLog.findOneAndUpdate(
      { user: req.user.id, date },
      update,
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json(checkout);
  } catch (error) {
    next(error);
  }
});

router.get("/service-expenses", async (req, res, next) => {
  try {
    const filters = { user: req.user.id };
    if (req.query.date) filters.date = req.query.date;
    if (req.query.month && req.query.year) {
      const month = String(req.query.month).padStart(2, "0");
      filters.date = { $regex: `^${req.query.year}-${month}` };
    }
    const expenses = await ServiceExpense.find(filters).sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    next(error);
  }
});

router.get("/overtime", async (req, res, next) => {
  try {
    const filters = { user: req.user.id };
    if (req.query.month && req.query.year) {
      filters.month = Number(req.query.month);
      filters.year = Number(req.query.year);
    }
    const records = await OvertimeRecord.find(filters).sort({ date: -1, createdAt: -1 });
    res.json(records);
  } catch (error) {
    next(error);
  }
});

router.post("/overtime", async (req, res, next) => {
  try {
    const date = String(req.body.date || "").trim();
    const hours = Number(req.body.hours);
    const note = String(req.body.note || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(hours) || hours <= 0) {
      return res.status(400).json({ message: "Vui lòng nhập ngày tăng ca và số giờ hợp lệ" });
    }

    const user = await User.findOne({ _id: req.user.id, role: "user", active: true }).select("hourlyRate");
    if (!user) return res.status(404).json({ message: "Không tìm thấy nhân sự" });

    const [year, month] = date.split("-").map(Number);
    const hourlyRate = Number(user.hourlyRate || 30000);
    const record = await OvertimeRecord.create({
      user: user._id,
      date,
      month,
      year,
      hours,
      hourlyRate,
      amount: hours * hourlyRate,
      status: "pending",
      note,
      createdBy: req.user.id,
    });

    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

router.post("/service-expenses", async (req, res, next) => {
  try {
    const date = req.body.date || todayString();
    const title = String(req.body.title || "").trim();
    const amount = Number(req.body.amount);
    const note = String(req.body.note || "").trim();

    if (!date || !title || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Vui lòng nhập ngày, nội dung chi phí và số tiền hợp lệ" });
    }

    const expense = await ServiceExpense.create({
      user: req.user.id,
      date,
      title,
      amount,
      note,
    });

    res.status(201).json(expense);
  } catch (error) {
    next(error);
  }
});

router.get("/my-salary", async (req, res, next) => {
  try {
    const [currentYear, currentMonth] = todayString().split("-").map(Number);
    const month = Number(req.query.month || currentMonth);
    const year = Number(req.query.year || currentYear);
    res.json({ month, year, ...(await calculateSalary(req.user.id, month, year)) });
  } catch (error) {
    next(error);
  }
});

router.get("/rules", async (req, res, next) => {
  try {
    const rules = await WorkRule.find({ active: true }).sort({ order: 1, createdAt: 1 });
    res.json(rules);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
