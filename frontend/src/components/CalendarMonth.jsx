import { formatDate, shiftLabels, today as todayString } from "../utils/workforce";

const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const pad = (value) => String(value).padStart(2, "0");
const dayNumber = (date) => Number(date.split("-")[2]);

export const monthKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const splitMonthKey = (value) => {
  const [year, month] = value.split("-").map(Number);
  return { month, year };
};

const buildDays = (monthValue) => {
  const { year, month } = splitMonthKey(monthValue);
  const firstDate = new Date(year, month - 1, 1);
  const totalDays = new Date(year, month, 0).getDate();
  const startOffset = (firstDate.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(`${year}-${pad(month)}-${pad(day)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export default function CalendarMonth({ month, itemsByDate, onDayClick, renderMeta, compact = false }) {
  const days = buildDays(month);
  const today = todayString();

  return (
    <div className="calendar-card">
      <div className="calendar-weekdays">
        {weekDays.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((date, index) => {
          const items = date ? itemsByDate[date] || [] : [];
          const isToday = date === today;
          return (
            <button
              key={date || `empty-${index}`}
              type="button"
              className={`calendar-day ${!date ? "empty" : ""} ${isToday ? "today" : ""}`}
              onClick={() => date && onDayClick(date)}
              disabled={!date}
            >
              {date && (
                <>
                  <div className="calendar-day-top">
                    <div className="calendar-day-number">{dayNumber(date)}</div>
                    {isToday && <span className="today-pill">Hôm nay</span>}
                  </div>
                  <div className="calendar-events">
                    {!compact &&
                      items.slice(0, 3).map((item) => (
                        <span key={item._id || `${item.shift}-${item.user?._id || item.date}`} className={`calendar-event ${item.status === "leave" ? "leave" : item.shift}`}>
                          {item.status === "leave" ? "Nghỉ" : item.shift === "morning" ? "Sáng 09:00 - 13:00" : "Chiều 13:00 - 17:00"}
                        </span>
                      ))}
                    {!compact && items.length > 3 && <span className="calendar-more">+{items.length - 3} ca</span>}
                    {renderMeta?.(date, items)}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const groupByDate = (items) =>
  items.reduce((acc, item) => {
    acc[item.date] = acc[item.date] || [];
    acc[item.date].push(item);
    acc[item.date].sort((a, b) => {
      const order = { morning: 1, afternoon: 2 };
      return (order[a.shift] || 9) - (order[b.shift] || 9);
    });
    return acc;
  }, {});

export const describeShift = (item) => (item.status === "leave" ? "Nghỉ" : shiftLabels[item.shift] || item.shift);

export const describeDate = formatDate;
