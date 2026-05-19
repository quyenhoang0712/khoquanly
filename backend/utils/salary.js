const WorkSchedule = require("../models/WorkSchedule");
const CheckoutLog = require("../models/CheckoutLog");
const { salaryPeriodRange } = require("./date");

const HOURS_PER_SHIFT = 4;
const HOURLY_RATE = 30000;

const calculateSalary = async (userId, month, year) => {
  const { start, end } = salaryPeriodRange(month, year);

  const [schedules, checkouts] = await Promise.all([
    WorkSchedule.find({
      user: userId,
      status: "scheduled",
      date: { $gte: start, $lte: end },
    }).lean(),
    CheckoutLog.find({
      user: userId,
      date: { $gte: start, $lte: end },
    }).lean(),
  ]);

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
        salary: hours * HOURLY_RATE,
      };
    });

  const totalShifts = details.reduce((sum, item) => sum + Number(item.morning) + Number(item.afternoon), 0);
  const totalHours = totalShifts * HOURS_PER_SHIFT;
  const totalSalary = totalHours * HOURLY_RATE;

  return { periodStart: start, periodEnd: end, totalShifts, totalHours, totalSalary, details };
};

module.exports = { calculateSalary, HOURS_PER_SHIFT, HOURLY_RATE };
