import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import CalendarMonth, { describeShift, groupByDate, monthKey, splitMonthKey } from "../../components/CalendarMonth";
import { Alert, EmptyRow, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatDate, statusLabels } from "../../utils/workforce";

const shiftTime = (shift) => (shift === "morning" ? "09:00 - 13:00" : "13:00 - 17:00");

const summarizeEmployeeSchedules = (items) => {
  const grouped = items.reduce((acc, item) => {
    const userId = item.user?._id || item.user || "unknown";
    if (!acc[userId]) {
      acc[userId] = {
        user: item.user,
        statuses: new Set(),
        shifts: [],
        coworkers: new Set(),
      };
    }
    acc[userId].statuses.add(item.status);
    acc[userId].shifts.push(item.shift);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([userId, group]) => {
    items.forEach((item) => {
      const itemUserId = item.user?._id || item.user || "unknown";
      if (itemUserId !== userId && group.shifts.includes(item.shift) && item.user?.name) {
        group.coworkers.add(item.user.name);
      }
    });
  });

  return Object.values(grouped).map((group) => {
    const hasMorning = group.shifts.includes("morning");
    const hasAfternoon = group.shifts.includes("afternoon");
    const isLeave = group.statuses.has("leave");
    const status = isLeave ? "leave" : group.statuses.has("scheduled") ? "scheduled" : [...group.statuses][0];

    return {
      user: group.user,
      shiftLabel: hasMorning && hasAfternoon ? "Full ca" : hasMorning ? "Ca sáng" : hasAfternoon ? "Ca chiều" : "-",
      timeLabel: isLeave
        ? "-"
        : hasMorning && hasAfternoon
          ? "09:00 - 17:00"
          : group.shifts.map(shiftTime).join(", ") || "-",
      coworkers: [...group.coworkers].join(", ") || "-",
      status,
    };
  });
};

const summarizeDay = (items) => {
  const userCount = new Set(items.map((item) => item.user?._id || item.user).filter(Boolean)).size;
  const morningCount = items.filter((item) => item.shift === "morning").length;
  const afternoonCount = items.filter((item) => item.shift === "afternoon").length;
  return { userCount, morningCount, afternoonCount };
};

export default function AdminSchedules() {
  const [month, setMonth] = useState(monthKey());
  const [shift, setShift] = useState("");
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    api.getAdminSchedules({ ...splitMonthKey(month), userId, shift }).then(setRows).catch((err) => setError(err.message));
  };

  useEffect(() => {
    api.getAdminUsers().then((items) => setUsers(items.filter((item) => item.role === "user"))).catch((err) => setError(err.message));
  }, []);
  useEffect(load, [month, userId, shift]);

  const itemsByDate = useMemo(() => groupByDate(rows), [rows]);
  const dayItems = selectedDate ? itemsByDate[selectedDate] || [] : [];
  const daySummary = useMemo(() => summarizeEmployeeSchedules(dayItems), [dayItems]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Lịch làm việc</p>
          <h1>Lịch nhân viên</h1>
        </div>
      </div>
      <Alert message={error} />
      <div className="toolbar calendar-toolbar">
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        <select value={userId} onChange={(event) => setUserId(event.target.value)}>
          <option value="">Tất cả nhân viên</option>
          {users.map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}
        </select>
        <select value={shift} onChange={(event) => setShift(event.target.value)}>
          <option value="">Tất cả ca</option>
          <option value="morning">Ca sáng</option>
          <option value="afternoon">Ca chiều</option>
        </select>
      </div>
      <CalendarMonth
        month={month}
        itemsByDate={itemsByDate}
        onDayClick={setSelectedDate}
        compact
        renderMeta={(date, items) => {
          if (items.length === 0) return null;
          const summary = summarizeDay(items);
          return (
            <div className="admin-calendar-summary">
              <strong>{summary.userCount} nhân viên</strong>
              <span>{summary.morningCount} sáng · {summary.afternoonCount} chiều</span>
            </div>
          );
        }}
      />

      {selectedDate && (
        <Modal title={`Nhân viên làm ngày ${formatDate(selectedDate)}`} onClose={() => setSelectedDate("")}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nhân viên</th><th>Ca</th><th>Thời gian</th><th>Làm với ai</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {daySummary.length === 0 && <EmptyRow colSpan={5}>Không có lịch trong ngày này.</EmptyRow>}
                {daySummary.map((item) => (
                  <tr key={item.user?._id || item.user?.email || item.shiftLabel}>
                    <td>{item.user?.name}</td>
                    <td>{item.shiftLabel}</td>
                    <td>{item.timeLabel}</td>
                    <td>{item.coworkers}</td>
                    <td><StatusBadge status={statusLabels[item.status] || item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </section>
  );
}
