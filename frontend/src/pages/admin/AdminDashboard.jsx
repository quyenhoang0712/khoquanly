import { CalendarCheck, CheckCircle2, ClipboardList, FileText, Store, Users, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import { formatDate, formatNumber, today } from "../../utils/workforce";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("day");
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAdminDashboard({ mode, date }).then(setData).catch((err) => setError(err.message));
  }, [mode, date]);

  const stats = [
    ["Nhân viên", data?.employees, Users, "blue"],
    ["Đi làm", data?.scheduledEmployees, CalendarCheck, "blue"],
    [mode === "week" ? "Công việc tuần này" : "Công việc hôm nay", data?.tasks, ClipboardList, "green"],
    ["Báo cáo đã gửi", data?.reports, FileText, "purple"],
    ["Đã checkout", data?.checkouts, CheckCircle2, "green"],
    ["Phiếu lịch chờ duyệt", data?.pendingSchedules, CalendarCheck, "amber"],
  ];
  const rangeLabel = data?.range?.start === data?.range?.end
    ? formatDate(data?.range?.start)
    : `${formatDate(data?.range?.start)} - ${formatDate(data?.range?.end)}`;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tổng quan nhân sự</p>
          <h1>Báo cáo quản lý</h1>
          <p className="page-subtitle">Theo dõi lịch làm, công việc, báo cáo và checkout của kho/sale.</p>
        </div>
      </div>
      <Alert message={error} />

      <div className="toolbar dashboard-toolbar">
        <div className="segmented-control" role="tablist" aria-label="Chọn kiểu báo cáo">
          <button className={mode === "day" ? "active" : ""} type="button" onClick={() => setMode("day")}>
            Theo ngày
          </button>
          <button className={mode === "week" ? "active" : ""} type="button" onClick={() => setMode("week")}>
            Theo tuần
          </button>
        </div>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      <div className="stats-grid dashboard-stats">
        {stats.map(([label, value, Icon, tone]) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}>
              <Icon size={22} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{formatNumber(value || 0)}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="task-board-grid dashboard-report-grid">
        <PositionReportCard
          title="Nhân viên kho"
          icon={Warehouse}
          tone="green"
          summary={data?.positionSummary?.warehouse}
          mode={mode}
        />
        <PositionReportCard
          title="Nhân viên sale"
          icon={Store}
          tone="purple"
          summary={data?.positionSummary?.sale}
          mode={mode}
        />
        <article className="task-board-card dashboard-report-card">
          <div className="task-board-card-header">
            <div>
              <span>Kỳ báo cáo</span>
              <strong>{mode === "week" ? "Báo cáo theo tuần" : "Báo cáo theo ngày"}</strong>
            </div>
          </div>
          <div className="task-board-fields">
            <div className="task-board-field-wide">
              <span>Thời gian</span>
              <p>{rangeLabel}</p>
            </div>
            <div>
              <span>Công việc</span>
              <p>{formatNumber(data?.tasks || 0)}</p>
            </div>
            <div>
              <span>Báo cáo</span>
              <p>{formatNumber(data?.reports || 0)}</p>
            </div>
          </div>
        </article>

        <article className="task-board-card dashboard-report-card">
          <div className="task-board-card-header">
            <div>
              <span>Điểm danh</span>
              <strong>Checkout</strong>
            </div>
          </div>
          <div className="task-board-fields">
            <div>
              <span>Ca làm</span>
              <p>{formatNumber(data?.schedules || 0)}</p>
            </div>
            <div>
              <span>Đã checkout</span>
              <p>{formatNumber(data?.checkouts || 0)}</p>
            </div>
            <div className="task-board-field-wide">
              <span>Chờ duyệt lịch</span>
              <p>{formatNumber(data?.pendingSchedules || 0)}</p>
            </div>
          </div>
        </article>
      </div>

    </section>
  );
}

function PositionReportCard({ title, icon: Icon, tone, summary, mode }) {
  return (
    <article className={`task-board-card dashboard-report-card ${tone}`}>
      <div className="task-board-card-header">
        <div>
          <span>Chức vụ</span>
          <strong>{title}</strong>
        </div>
        <div className={`stat-icon ${tone}`}><Icon size={22} /></div>
      </div>
      <div className="task-board-fields">
        <div>
          <span>{mode === "week" ? "Có lịch trong tuần" : "Đi làm hôm nay"}</span>
          <p>{formatNumber(summary?.scheduledEmployees || 0)}</p>
        </div>
        <div>
          <span>Đã checkout</span>
          <p>{formatNumber(summary?.checkoutDays || 0)}</p>
        </div>
        <div>
          <span>Đã xong</span>
          <p>{formatNumber(summary?.completedTasks || 0)}</p>
        </div>
        <div>
          <span>Chưa/đang làm</span>
          <p>{formatNumber((summary?.notStartedTasks || 0) + (summary?.inProgressTasks || 0))}</p>
        </div>
      </div>
    </article>
  );
}
