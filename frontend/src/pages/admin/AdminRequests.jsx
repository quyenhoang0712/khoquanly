import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Alert, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatDate, shiftLabels, shiftTimeLabel, statusLabels } from "../../utils/workforce";

const positionLabels = {
  warehouse: "Nhân viên kho",
  sale: "Nhân viên sale",
};

const planPositions = ["warehouse", "sale"];
const planShifts = ["morning", "afternoon"];
const planShiftLabels = { morning: "Ca 1", afternoon: "Ca 2" };
const planDayLabels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const padDatePart = (value) => String(value).padStart(2, "0");
const toLocalDateString = (date) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const buildPlanDays = (weekStart) => {
  if (!weekStart) return [];
  const start = new Date(`${weekStart}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      label: planDayLabels[index],
      date: toLocalDateString(date),
    };
  });
};

const personName = (item) => item.user?.name || "Nhân viên";
const shiftOrder = { morning: 1, afternoon: 2 };

export function AdminScheduleRequests() {
  return <RequestPage title="Duyệt ngày đi làm tuần sau" />;
}

function RequestPage({ title }) {
  const [position, setPosition] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [autoPlan, setAutoPlan] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = () => {
    api.getAdminScheduleRequests({ status: "pending", position }).then(setRows).catch((err) => setError(err.message));
  };

  useEffect(load, [position]);

  const weekOptions = useMemo(() => {
    return [...new Set(rows.map((row) => row.weekStart).filter(Boolean))].sort();
  }, [rows]);

  useEffect(() => {
    if (weekOptions.length === 0) {
      setSelectedWeek("");
      return;
    }
    if (!selectedWeek || !weekOptions.includes(selectedWeek)) {
      setSelectedWeek(weekOptions[0]);
    }
  }, [selectedWeek, weekOptions]);

  const review = async (id, action) => {
    try {
      setError("");
      setMessage("");
      await api.reviewScheduleRequest(id, action);
      setMessage("Đã ghi nhận.");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const generateAutoPlan = async () => {
    if (!selectedWeek) return;
    try {
      setPlanning(true);
      setError("");
      setMessage("");
      const plan = await api.autoScheduleRequests({ weekStart: selectedWeek });
      setAutoPlan(plan);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlanning(false);
    }
  };

  const applyAutoPlan = async () => {
    if (!selectedWeek) return;
    try {
      setApplying(true);
      setError("");
      setMessage("");
      const plan = await api.autoScheduleRequests({ weekStart: selectedWeek, apply: true });
      setAutoPlan(null);
      setMessage(`Đã áp dụng AI xếp lịch: ${plan.assignments.length} ca.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  const renderRequestSchedule = (row) => {
    const grouped = row.shifts.reduce((acc, item) => {
      acc[item.date] = acc[item.date] || [];
      acc[item.date].push(item.shift);
      return acc;
    }, {});

    return (
      <div className="request-schedule">
        <div className="request-schedule-header">
          <span>Tuần</span>
          <strong>{formatDate(row.weekStart)}</strong>
        </div>
        <div className="request-schedule-days">
          {Object.entries(grouped)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, shifts]) => (
              <div className="request-schedule-day" key={date}>
                <span>{formatDate(date)}</span>
                <div>
                  {shifts
                    .sort((shiftA, shiftB) => shiftOrder[shiftA] - shiftOrder[shiftB])
                    .map((shift) => (
                      <b key={`${date}-${shift}`}>{planShiftLabels[shift]} {shiftTimeLabel(row.user?.position, shift)}</b>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  };

  const renderPlanPersonList = (items) => {
    if (!items.length) return <span className="auto-plan-empty">Trống</span>;
    return (
      <div className="auto-plan-people">
        {items.map((item, index) => (
          <span key={`${item.user?._id || personName(item)}-${index}`}>{personName(item)}</span>
        ))}
      </div>
    );
  };

  const renderAutoScheduleGrid = () => {
    const planDays = buildPlanDays(autoPlan.weekStart);
    const planItems = [...(autoPlan.existingAssignments || []), ...(autoPlan.assignments || [])];

    return (
      <div className="auto-plan-grid">
        {planPositions.map((planPosition) => (
          <section className="auto-plan-card" key={planPosition}>
            <div className="auto-plan-card-header">
              <span>Lịch</span>
              <strong>{positionLabels[planPosition]}</strong>
            </div>
            <div className="auto-week-grid">
              {planDays.map((day) => (
                <div className="auto-week-day" key={`${planPosition}-${day.date}`}>
                  <div className="auto-week-day-header">
                    <strong>{day.label}</strong>
                    <span>{formatDate(day.date)}</span>
                  </div>
                  {planShifts.map((planShift) => {
                    const items = planItems.filter((item) => item.position === planPosition && item.date === day.date && item.shift === planShift);
                    return (
                      <div className="auto-week-shift" key={`${planPosition}-${day.date}-${planShift}`}>
                        <b>{planShiftLabels[planShift]}</b>
                        {renderPlanPersonList(items)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  };

  const visibleShortages = autoPlan?.shortages?.filter((item) => item.position !== "warehouse") || [];

  return (
    <section className="page">
      <div className="page-header"><div><p className="eyebrow">Ngày đi làm</p><h1>{title}</h1></div></div>
      <Alert message={error} /><Alert message={message} type="success" />
      <div className="toolbar compact-filter">
        <select value={position} onChange={(event) => setPosition(event.target.value)}>
          <option value="">Tất cả chức vụ</option>
          <option value="warehouse">Nhân viên kho</option>
          <option value="sale">Nhân viên sale</option>
        </select>
        <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)} disabled={weekOptions.length === 0}>
          {weekOptions.length === 0 && <option value="">Chưa có tuần chờ duyệt</option>}
          {weekOptions.map((week) => (
            <option value={week} key={week}>Tuần {formatDate(week)}</option>
          ))}
        </select>
        <button className="button primary" type="button" onClick={generateAutoPlan} disabled={!selectedWeek || planning}>
          {planning ? "Đang xếp..." : "AI xếp lịch"}
        </button>
      </div>
      {rows.length === 0 && <div className="panel task-board-empty">Không có dữ liệu.</div>}
      <div className="task-board-grid">
        {rows.map((row) => (
          <article className="task-board-card" key={row._id}>
            <div className="task-board-card-header">
              <div>
                <span>Nhân viên</span>
                <strong>{row.user?.name || "Nhân viên"}</strong>
              </div>
              <StatusBadge status={statusLabels[row.status] || row.status} />
            </div>
            <div className="task-board-fields">
              <div>
                <span>Chức vụ</span>
                <p>{positionLabels[row.user?.position || "warehouse"]}</p>
              </div>
              <div>
                <span>Ghi chú</span>
                <p>{row.note || row.reason || "-"}</p>
              </div>
              <div className="task-board-field-wide request-schedule-field">{renderRequestSchedule(row)}</div>
              <div className="task-board-field-wide request-actions">
                <button className="button small primary" onClick={() => review(row._id, "approve")}>Duyệt</button>
                <button className="button small ghost" onClick={() => review(row._id, "reject")}>Từ chối</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {autoPlan && (
        <Modal title={`Bản nháp AI tuần ${formatDate(autoPlan.weekStart)}`} onClose={() => setAutoPlan(null)} className="auto-schedule-modal">
          {autoPlan.existingAssignments?.length > 0 && (
            <div className="panel task-board-empty">
              Đã có {autoPlan.existingAssignments.length} ca trong lịch hiện tại; AI chỉ xếp thêm vào các ca còn trống.
            </div>
          )}
          {renderAutoScheduleGrid()}
          {visibleShortages.length > 0 && (
            <div className="auto-shortage-panel">
              <div className="auto-shortage-header">
                <span>Còn thiếu</span>
                <strong>{visibleShortages.length} ca</strong>
              </div>
              <div className="auto-shortage-list">
                {visibleShortages.map((item) => (
                  <div className="auto-shortage-item" key={`${item.date}-${item.shift}-${item.position}`}>
                    <span>{formatDate(item.date)}</span>
                    <b>{planShiftLabels[item.shift]}</b>
                    <span>{positionLabels[item.position]}</span>
                    <strong>{item.assigned}/{item.needed}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button className="button primary" type="button" onClick={applyAutoPlan} disabled={applying || autoPlan.assignments.length === 0}>
              {applying ? "Đang áp dụng..." : "Áp dụng lịch này"}
            </button>
            <button className="button ghost" type="button" onClick={() => setAutoPlan(null)}>Đóng</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
