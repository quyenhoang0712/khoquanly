const WorkSchedule = require("../models/WorkSchedule");
const CheckoutLog = require("../models/CheckoutLog");
const OvertimeRecord = require("../models/OvertimeRecord");
const User = require("../models/User");
const { salaryPeriodRange } = require("./date");

const HOURS_PER_SHIFT = 4;
const HOURLY_RATE = 30000;

const calculateSalary = async (userId, month, year) => {
  const { start, end } = salaryPeriodRange(month, year);

  const [user, schedules, checkouts, overtimeRecords] = await Promise.all([
    User.findById(userId).select("hourlyRate").lean(),
    WorkSchedule.find({
      user: userId,
      status: "scheduled",
      date: { $gte: start, $lte: end },
    }).lean(),
    CheckoutLog.find({
      user: userId,
      date: { $gte: start, $lte: end },
    }).lean(),
    OvertimeRecord.find({ user: userId, month, year }).sort({ createdAt: 1 }).lean(),
  ]);
  const hourlyRate = Number(user?.hourlyRate || HOURLY_RATE);

  const checkoutDates = new Set(checkouts.map((item) => item.date));
  const grouped = new Map();

  schedules
    .filter((schedule) => checkoutDates.has(schedule.date))
    .forEach((schedule) => {
      const current = grouped.get(schedule.date) || { date: schedule.date, morning: false, afternoon: false };
      current[schedule.shift] = true;
      grouped.set(schedule.date, current);
    });

  const details = Array.from(grouped.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => {
      const shiftCount = Number(item.morning) + Number(item.afternoon);
      const hours = shiftCount * HOURS_PER_SHIFT;
      return {
        ...item,
        hours,
        salary: hours * hourlyRate,
      };
    });

  const totalShifts = details.reduce((sum, item) => sum + Number(item.morning) + Number(item.afternoon), 0);
  const regularHours = totalShifts * HOURS_PER_SHIFT;
  const regularSalary = regularHours * hourlyRate;
  const overtimeHours = overtimeRecords.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const overtimeSalary = overtimeRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalHours = regularHours + overtimeHours;
  const totalSalary = regularSalary + overtimeSalary;

  return {
    periodStart: start,
    periodEnd: end,
    hourlyRate,
    totalShifts,
    regularHours,
    regularSalary,
    overtimeHours,
    overtimeSalary,
    totalHours,
    totalSalary,
    overtimeRecords,
    details,
  };
};

module.exports = { calculateSalary, HOURS_PER_SHIFT, HOURLY_RATE };
