const pad = (value) => String(value).padStart(2, "0");

const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const todayString = () => toDateString(new Date());

const monthRange = (month, year) => {
  const start = `${year}-${pad(month)}-01`;
  const lastDate = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(lastDate)}`;
  return { start, end };
};

const salaryPeriodRange = (month, year) => {
  const startDate = new Date(Number(year), Number(month) - 1, 11);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 27);

  return {
    start: toDateString(startDate),
    end: toDateString(endDate),
  };
};

module.exports = { todayString, monthRange, salaryPeriodRange };
