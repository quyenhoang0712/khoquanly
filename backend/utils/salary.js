const WorkSchedule = require("../models/WorkSchedule");
const CheckoutLog = require("../models/CheckoutLog");
const OvertimeRecord = require("../models/OvertimeRecord");
const User = require("../models/User");
const { salaryPeriodRange } = require("./date");
const { shiftHours } = require("./shifts");

const HOURS_PER_SHIFT = 4;
const HOURLY_RATE = 30000;
const TRAVEL_ALLOWANCE = 150000;

const calculateSalary = async (userId, month, year) => {
  const { start, end } = salaryPeriodRange(month, year);

  const [user, schedules, checkouts, overtimeRecords, firstSchedule] = await Promise.all([
    User.findById(userId).select("hourlyRate position createdAt travelAllowanceEnabled travelAllowanceAmount").lean(),
    WorkSchedule.find({
      user: userId,
      status: "scheduled",
      date: { $gte: start, $lte: end },
    }).lean(),
    CheckoutLog.find({
      user: userId,
      date: { $gte: start, $lte: end },
    }).lean(),
    OvertimeRecord.find({
      user: userId,
      $or: [{ status: "approved" }, { status: { $exists: false } }],
      $and: [
        {
          $or: [
            { date: { $gte: start, $lte: end } },
            { date: "", month, year },
            { date: { $exists: false }, month, year },
          ],
        },
      ],
    }).sort({ date: 1, createdAt: 1 }).lean(),
    WorkSchedule.findOne({ user: userId, status: "scheduled" }).sort({ date: 1 }).select("date").lean(),
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
      const hours = (item.morning ? shiftHours(user?.position, "morning") : 0) + (item.afternoon ? shiftHours(user?.position, "afternoon") : 0);
      return {
        ...item,
        hours,
        salary: hours * hourlyRate,
      };
    });

  const totalShifts = details.reduce((sum, item) => sum + Number(item.morning) + Number(item.afternoon), 0);
  const regularHours = details.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const regularSalary = regularHours * hourlyRate;
  const overtimeHours = overtimeRecords.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const overtimeSalary = overtimeRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalHours = regularHours + overtimeHours;
  const employmentStartDate = firstSchedule?.date || (user?.createdAt ? user.createdAt.toISOString().slice(0, 10) : null);
  const travelAllowanceEligible = Boolean(user?.travelAllowanceEnabled && totalShifts > 0);
  const travelAllowance = travelAllowanceEligible ? Number(user?.travelAllowanceAmount || TRAVEL_ALLOWANCE) : 0;
  const totalSalary = regularSalary + overtimeSalary + travelAllowance;

  return {
    periodStart: start,
    periodEnd: end,
    hourlyRate,
    totalShifts,
    regularHours,
    regularSalary,
    overtimeHours,
    overtimeSalary,
    employmentStartDate,
    travelAllowanceEligible,
    travelAllowance,
    totalHours,
    totalSalary,
    overtimeRecords,
    details,
  };
};

module.exports = { calculateSalary, HOURS_PER_SHIFT, HOURLY_RATE, TRAVEL_ALLOWANCE };
