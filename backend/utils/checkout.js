const CheckoutLog = require("../models/CheckoutLog");
const WorkSchedule = require("../models/WorkSchedule");
const { dateTimeInAppTimeZone, todayString } = require("./date");

const autoCheckoutPastSchedules = async () => {
  const today = todayString();
  const schedules = await WorkSchedule.find({
    status: "scheduled",
    date: { $lt: today },
  })
    .select("user date")
    .lean();

  const uniqueDays = new Map();
  schedules.forEach((schedule) => {
    uniqueDays.set(`${schedule.user}-${schedule.date}`, {
      user: schedule.user,
      date: schedule.date,
    });
  });

  const operations = Array.from(uniqueDays.values()).map((item) => ({
    updateOne: {
      filter: { user: item.user, date: item.date },
      update: {
        $setOnInsert: {
          user: item.user,
          date: item.date,
          checkoutAt: dateTimeInAppTimeZone(item.date, "17:05:00"),
          note: "Tự động checkout cho ngày đã qua.",
        },
      },
      upsert: true,
    },
  }));

  if (operations.length === 0) return { created: 0 };
  const result = await CheckoutLog.bulkWrite(operations, { ordered: false });
  return { created: result.upsertedCount || 0 };
};

module.exports = { autoCheckoutPastSchedules };
