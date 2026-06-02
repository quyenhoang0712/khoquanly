import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import CalendarMonth, { groupByDate, monthKey, splitMonthKey } from "../../components/CalendarMonth";
import { Alert, EmptyRow, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatDate, shiftTimeLabel, statusLabels } from "../../utils/workforce";

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
      shiftOption: hasMorning && hasAfternoon ? "full" : hasMorning ? "morning" : hasAfternoon ? "afternoon" : "off",
      shiftLabel: hasMorning && hasAfternoon ? "Full ca" : hasMorning ? "Ca sáng" : hasAfternoon ? "Ca chiều" : "-",
      timeLabel: isLeave
        ? "-"
        : hasMorning && hasAfternoon
          ? `${shiftTimeLabel(group.user?.position, "morning").split(" - ")[0]} - ${shiftTimeLabel(group.user?.position, "afternoon").split(" - ")[1]}`
          : group.shifts.map((shift) => shiftTimeLabel(group.user?.position, shift)).join(", ") || "-",
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
  const [position, setPosition] = useState("");
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [scheduleForm, setScheduleForm] = useState({ userId: "", shiftOption: "full", status: "scheduled" });
  const [editingUserId, setEditingUserId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const load = () => {
    api.getAdminSchedules({ ...splitMonthKey(month), position, shift }).then(setRows).catch((err) => setError(err.message));
  };

  useEffect(() => {
    api.getAdminUsers().then((items) => setUsers(items.filter((item) => item.role === "user"))).catch((err) => setError(err.message));
  }, []);
  useEffect(load, [month, position, shift]);

  const itemsByDate = useMemo(() => groupByDate(rows), [rows]);
  const dayItems = selectedDate ? itemsByDate[selectedDate] || [] : [];
  const daySummary = useMemo(() => summarizeEmployeeSchedules(dayItems), [dayItems]);

  const openDate = (date) => {
    setSelectedDate(date);
    setEditingUserId("");
    setScheduleForm({ userId: "", shiftOption: "full", status: "scheduled" });
    setError("");
    setMessage("");
  };

  const submitSchedule = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      setError("");
      setMessage("");
      const payload = {
        userId: scheduleForm.userId,
        date: selectedDate,
        shiftOption: scheduleForm.shiftOption,
        status: scheduleForm.status,
      };

      if (editingUserId) {
        await api.updateAdminSchedule(selectedDate, editingUserId, payload);
        setMessage("Đã ghi nhận.");
      } else {
        await api.createAdminSchedule(payload);
        setMessage("Đã ghi nhận.");
      }

      setEditingUserId("");
      setScheduleForm({ userId: "", shiftOption: "full", status: "scheduled" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const editSchedule = (item) => {
    setEditingUserId(item.user?._id || "");
    setScheduleForm({
      userId: item.user?._id || "",
      shiftOption: item.shiftOption,
      status: item.status === "leave" ? "leave" : "scheduled",
    });
    setMessage("");
  };

  const deleteSchedule = async (item) => {
    const targetUserId = item.user?._id;
    if (!targetUserId) return;
    try {
      setError("");
      setMessage("");
      await api.deleteAdminSchedule(selectedDate, targetUserId);
      setMessage("Đã ghi nhận.");
      if (editingUserId === targetUserId) {
        setEditingUserId("");
        setScheduleForm({ userId: "", shiftOption: "full", status: "scheduled" });
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Lịch làm việc</p>
          <h1>Lịch nhân viên</h1>
        </div>
      </div>
      <Alert message={error} />
      <Alert message={message} type="success" />
      <div className="toolbar calendar-toolbar">
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        <select value={position} onChange={(event) => setPosition(event.target.value)}>
          <option value="">Tất cả nhân viên</option>
          <option value="warehouse">Nhân viên kho</option>
          <option value="sale">Nhân viên sale</option>
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
        onDayClick={openDate}
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
          <form className="schedule-editor-form" onSubmit={submitSchedule}>
            <label className="field">
              <span>Nhân viên</span>
              <select
                value={scheduleForm.userId}
                onChange={(event) => setScheduleForm({ ...scheduleForm, userId: event.target.value })}
                disabled={Boolean(editingUserId)}
                required
              >
                <option value="">Chọn nhân viên</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>{user.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Ca làm</span>
              <select value={scheduleForm.shiftOption} onChange={(event) => setScheduleForm({ ...scheduleForm, shiftOption: event.target.value })}>
                <option value="morning">Ca sáng</option>
                <option value="afternoon">Ca chiều</option>
                <option value="full">Full ca</option>
                <option value="off">Xóa lịch ngày này</option>
              </select>
            </label>
            <label className="field">
              <span>Trạng thái</span>
              <select value={scheduleForm.status} onChange={(event) => setScheduleForm({ ...scheduleForm, status: event.target.value })}>
                <option value="scheduled">Đi làm</option>
                <option value="leave">Nghỉ</option>
              </select>
            </label>
            <div className="schedule-editor-actions">
              <button className="button primary" type="submit" disabled={submitting}>
                {submitting ? "Đang lưu..." : editingUserId ? "Lưu lịch" : "Thêm vào lịch"}
              </button>
              {editingUserId && (
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => {
                    setEditingUserId("");
                    setScheduleForm({ userId: "", shiftOption: "full", status: "scheduled" });
                  }}
                >
                  Hủy sửa
                </button>
              )}
            </div>
          </form>

          <div className="table-wrap mobile-card-table">
            <table>
              <thead><tr><th>Nhân viên</th><th>Ca</th><th>Thời gian</th><th>Làm với ai</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {daySummary.length === 0 && <EmptyRow colSpan={6}>Không có lịch trong ngày này.</EmptyRow>}
                {daySummary.map((item) => (
                  <tr key={item.user?._id || item.user?.email || item.shiftLabel}>
                    <td data-label="Nhân viên">{item.user?.name}</td>
                    <td data-label="Ca">{item.shiftLabel}</td>
                    <td data-label="Thời gian">{item.timeLabel}</td>
                    <td data-label="Làm với ai">{item.coworkers}</td>
                    <td data-label="Trạng thái"><StatusBadge status={statusLabels[item.status] || item.status} /></td>
                    <td data-label="Thao tác">
                      <div className="row-actions">
                        <button className="button small ghost" type="button" onClick={() => editSchedule(item)}>Sửa</button>
                        <button className="button small danger" type="button" onClick={() => deleteSchedule(item)}>Xóa</button>
                      </div>
                    </td>
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
