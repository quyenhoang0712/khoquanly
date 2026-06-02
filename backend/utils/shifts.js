const SHIFT_TIMES = {
  warehouse: {
    morning: { start: "09:00", end: "13:00", hours: 4 },
    afternoon: { start: "13:00", end: "17:00", hours: 4 },
  },
  sale: {
    morning: { start: "10:00", end: "16:00", hours: 6 },
    afternoon: { start: "16:00", end: "22:00", hours: 6 },
  },
};

const positionKey = (position) => (position === "sale" ? "sale" : "warehouse");

const shiftInfo = (position, shift) => SHIFT_TIMES[positionKey(position)]?.[shift] || SHIFT_TIMES.warehouse[shift];

const shiftHours = (position, shift) => Number(shiftInfo(position, shift)?.hours || 0);

const shiftEndDateTime = (date, position, shift) => {
  const info = shiftInfo(position, shift);
  if (!info) return null;
  return new Date(`${date}T${info.end}:00+07:00`);
};

module.exports = { SHIFT_TIMES, positionKey, shiftInfo, shiftHours, shiftEndDateTime };
