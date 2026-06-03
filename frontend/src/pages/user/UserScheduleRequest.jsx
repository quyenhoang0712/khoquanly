import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { Alert, StatusBadge } from "../../components/DataState";
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

const shiftsToChoices = (shifts = []) => {
  const grouped = shifts.reduce((acc, item) => {
    acc[item.date] = acc[item.date] || new Set();
    acc[item.date].add(item.shift);
    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(grouped).map(([date, values]) => {
      const hasMorning = values.has("morning");
      const hasAfternoon = values.has("afternoon");
      return [date, hasMorning && hasAfternoon ? "full" : hasMorning ? "morning" : "afternoon"];
    })
  );
};

export default function UserScheduleRequest() {
  const [weekStart] = useState(getNextMonday());
  const [canRegister] = useState(true);
  const [requests, setRequests] = useState([]);
  const [choices, setChoices] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const submittingRef = useRef(false);

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const currentRequest = useMemo(() => {
    return requests.find((item) => item.status === "pending") || requests[0] || null;
  }, [requests]);
  const canEditRequest = canRegister;

  const loadRequests = () => {
    setLoadingRequests(true);
    api.getMyScheduleRequests({ weekStart })
      .then((items) => setRequests(items))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingRequests(false));
  };

  useEffect(loadRequests, [weekStart]);

  useEffect(() => {
    if (!currentRequest) {
      setChoices({});
      return;
    }
    setChoices(shiftsToChoices(currentRequest.shifts));
  }, [currentRequest?._id, currentRequest?.updatedAt]);

  const toggleChoice = (date, value) => {
    if (!canEditRequest) return;
    setChoices((current) => {
      const next = { ...current };
      if (next[date] === value) {
        delete next[date];
      } else {
        next[date] = value;
      }
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const shifts = weekDays.flatMap((day) => optionToShifts(day.date, choices[day.date]));

    if (shifts.length === 0) {
      setError("Vui lòng chọn ít nhất một ca đi làm trong tuần sau.");
      setMessage("");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      setError("");
      setMessage("");
      await api.createScheduleRequest({ weekStart, note: "", shifts });
      setMessage(currentRequest ? "Đã cập nhật lịch đã gửi." : "Đã gửi ngày đi làm tuần sau.");
      loadRequests();
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
          <p className="eyebrow">Lịch tuần sau</p>
          <h1>Đăng ký ngày đi làm tuần sau</h1>
          <p className="page-subtitle">Chọn ngày và ca bạn muốn đi làm.</p>
        </div>
      </div>
      <Alert message={error} />
      <Alert message={message} type="success" />
      <div className="panel sent-schedule-panel">
        <div className="sent-schedule-header">
          <div>
            <span>Lịch đã gửi</span>
            <strong>{formatDate(weekDays[0]?.date)} - {formatDate(weekDays[6]?.date)}</strong>
          </div>
          {currentRequest && <StatusBadge status={currentRequest.status} />}
        </div>
        {loadingRequests ? (
          <p className="sent-schedule-empty">Đang tải lịch đã gửi...</p>
        ) : currentRequest ? (
          <div className="sent-schedule-days">
            {weekDays.map((day) => {
              const value = shiftsToChoices(currentRequest.shifts)[day.date];
              return (
                <div className={`sent-schedule-day ${value ? "has-choice" : ""}`} key={day.date}>
                  <span>{day.label}</span>
                  <strong>{formatDate(day.date)}</strong>
                  <b>{value === "full" ? "Full ca" : value === "morning" ? "Ca 1" : value === "afternoon" ? "Ca 2" : "Nghỉ"}</b>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="sent-schedule-empty">Bạn chưa gửi lịch cho tuần này.</p>
        )}
      </div>
      <div className="panel form-panel">
        <form className="product-form" onSubmit={submit}>
          {currentRequest?.status === "approved" && (
            <div className="alert warning">Lịch này đã được duyệt. Tạm thời vẫn cho sửa để test, gửi lại sẽ chuyển về chờ duyệt.</div>
          )}

          <div className="week-summary">
            <span>Tuần sau</span>
            <strong>
              {formatDate(weekDays[0]?.date)} - {formatDate(weekDays[6]?.date)}
            </strong>
          </div>

          <div className="week-request-list">
            {weekDays.map((day) => (
              <div className={`week-day-row ${choices[day.date] ? "has-choice" : ""}`} key={day.date}>
                <div className="week-day-label">
                  <strong>{day.label}</strong>
                  <span>{formatDate(day.date)}</span>
                </div>
                <div className="shift-choice-grid">
                  {[
                    ["morning", "Ca 1"],
                    ["afternoon", "Ca 2"],
                    ["full", "Full ca"],
                  ].map(([value, label]) => (
                    <label className={`shift-choice ${value} ${choices[day.date] === value ? "active" : ""}`} key={value}>
                      <input
                        type="radio"
                        name={day.date}
                        value={value}
                        checked={choices[day.date] === value}
                        disabled={!canEditRequest}
                        onChange={() => toggleChoice(day.date, value)}
                        onClick={() => choices[day.date] === value && toggleChoice(day.date, value)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className="button primary" disabled={submitting || !canEditRequest}>
            {submitting ? "Đang gửi..." : currentRequest ? "Cập nhật lịch đã gửi" : "Gửi ngày đi làm"}
          </button>
        </form>
      </div>
    </section>
  );
}
