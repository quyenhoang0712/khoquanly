const todayString = () => new Date().toISOString().slice(0, 10);

const monthRange = (month, year) => {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDate = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;
  return { start, end };
};

module.exports = { todayString, monthRange };
