const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const CheckoutLog = require("../models/CheckoutLog");
const DailyTask = require("../models/DailyTask");
const LeaveRequest = require("../models/LeaveRequest");
const ReportImage = require("../models/ReportImage");
const TaskReport = require("../models/TaskReport");
const WeeklyScheduleRequest = require("../models/WeeklyScheduleRequest");
const WorkSchedule = require("../models/WorkSchedule");
const { autoCheckoutPastSchedules } = require("../utils/checkout");
const { calculateSalary } = require("../utils/salary");
const { todayString } = require("../utils/date");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "uploads", "reports");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

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
    await autoCheckoutPastSchedules();
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

router.post("/schedule-requests", async (req, res, next) => {
  try {
    const { weekStart, shifts, note } = req.body;
    if (!weekStart || !shifts?.length) return res.status(400).json({ message: "Week start and shifts are required" });
    const request = await WeeklyScheduleRequest.create({ user: req.user.id, weekStart, shifts, note });
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

router.post("/leave-requests", async (req, res, next) => {
  try {
    const { date, shift, reason } = req.body;
    if (!date || !reason) return res.status(400).json({ message: "Date and reason are required" });
    const request = await LeaveRequest.create({ user: req.user.id, date, shift, reason });
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

router.get("/today-tasks", async (req, res, next) => {
  try {
    const date = req.query.date || todayString();
    const tasks = await DailyTask.find({ date, assignedTo: req.user.id }).populate("assignedTo", "name email").sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get("/tasks/:id", async (req, res, next) => {
  try {
    const task = await DailyTask.findOne({ _id: req.params.id, assignedTo: req.user.id }).populate("assignedTo", "name email");
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
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
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post("/tasks/:id/report", upload.array("images", 6), async (req, res, next) => {
  try {
    const task = await DailyTask.findOne({ _id: req.params.id, assignedTo: req.user.id });
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!req.body.content) return res.status(400).json({ message: "Report content is required" });

    const imagePaths = (req.files || []).map((file) => `/uploads/reports/${file.filename}`);
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
    const imagePaths = (req.files || []).map((file) => `/uploads/reports/${file.filename}`);
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

router.get("/my-salary", async (req, res, next) => {
  try {
    await autoCheckoutPastSchedules();
    const [currentYear, currentMonth] = todayString().split("-").map(Number);
    const month = Number(req.query.month || currentMonth);
    const year = Number(req.query.year || currentYear);
    res.json({ month, year, ...(await calculateSalary(req.user.id, month, year)) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
