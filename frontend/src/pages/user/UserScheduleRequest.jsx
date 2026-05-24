import { useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import { formatDate } from "../../utils/workforce";

const dayLabels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

const pad = (value) => String(value).padStart(2, "0");

const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getNextMonday = () => {
  const date = new Date();
  const day = date.getDay();
  const daysUntilNextMonday = ((8 - day) % 7) || 7;
  date.setDate(date.getDate() + daysUntilNextMonday);
  return toDateString(date);
};

const buildWeekDays = (weekStart) => {
  if (!weekStart) return [];
  const start = new Date(`${weekStart}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      label: dayLabels[index],
      date: toDateString(date),
    };
  });
};

const optionToShifts = (date, option) => {
  if (option === "morning") return [{ date, shift: "morning" }];
  if (option === "afternoon") return [{ date, shift: "afternoon" }];
  if (option === "full") return [{ date, shift: "morning" }, { date, shift: "afternoon" }];
  return [];
};

export default function UserScheduleRequest() {
  const [weekStart] = useState(getNextMonday());
  const [note, setNote] = useState("");
  const [choices, setChoices] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const shifts = weekDays.flatMap((day) => optionToShifts(day.date, choices[day.date]));

    if (shifts.length === 0) {
      setError("Vui lòng chọn ít nhất một ca trong tuần.");
      setMessage("");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      setError("");
      setMessage("");
      await api.createScheduleRequest({ weekStart, note, shifts });
      setMessage("Đã ghi nhận.");
    } catch (err) {
      setError(err.message);
      setMessage("");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Phiếu đăng ký</p>
          <h1>Đăng ký lịch làm tuần sau</h1>
        </div>
      </div>
      <Alert message={error} />
      <Alert message={message} type="success" />
      <div className="panel form-panel">
        <form className="product-form" onSubmit={submit}>
          <div className="week-summary">
            <span>Tuần sau</span>
            <strong>
              {formatDate(weekDays[0]?.date)} - {formatDate(weekDays[6]?.date)}
            </strong>
          </div>

          <div className="week-request-list">
            {weekDays.map((day) => (
              <div className="week-day-row" key={day.date}>
                <div className="week-day-label">
                  <strong>{day.label}</strong>
                  <span>{formatDate(day.date)}</span>
                </div>
                <div className="shift-choice-grid">
                  {[
                    ["off", "Nghỉ"],
                    ["morning", "Ca 1"],
                    ["afternoon", "Ca 2"],
                    ["full", "Full ca"],
                  ].map(([value, label]) => (
                    <label className={`shift-choice ${choices[day.date] === value ? "active" : ""}`} key={value}>
                      <input
                        type="radio"
                        name={day.date}
                        value={value}
                        checked={(choices[day.date] || "off") === value}
                        onChange={() => setChoices((current) => ({ ...current, [day.date]: value }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <label className="field">
            <span>Ghi chú</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: em ưu tiên ca sáng nếu cần đổi lịch" />
          </label>
          <button className="button primary" disabled={submitting}>
            {submitting ? "Đang gửi..." : "Gửi phiếu đăng ký"}
          </button>
        </form>
      </div>
    </section>
  );
}
