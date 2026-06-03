const pad = (value) => String(value).padStart(2, "0");
const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";

const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const datePartsInTimeZone = (date = new Date(), timeZone = APP_TIME_ZONE) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

const todayString = (date = new Date()) => {
  const parts = datePartsInTimeZone(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const weekdayInAppTimeZone = (date = new Date()) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
  }).format(date);

const isWeekendInAppTimeZone = (date = new Date()) => {
  const weekday = weekdayInAppTimeZone(date);
  return weekday === "Sat" || weekday === "Sun";
};

const dateTimeInAppTimeZone = (date, time = "00:00:00") => new Date(`${date}T${time}+07:00`);

const monthRange = (month, year) => {
  const start = `${year}-${pad(month)}-01`;
  const lastDate = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(lastDate)}`;
  return { start, end };
};

const salaryPeriodRange = (month, year) => {
  // Payroll is a fixed 4-week period that starts on the 11th of the selected month.
  const startDate = new Date(Number(year), Number(month) - 1, 11);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 27);

  return {
    start: toDateString(startDate),
    end: toDateString(endDate),
  };
};

module.exports = { APP_TIME_ZONE, todayString, isWeekendInAppTimeZone, dateTimeInAppTimeZone, monthRange, salaryPeriodRange };
