import { AlertCircle, CalendarCheck, CheckCircle2, ClipboardList, Clock3, FileText, LogOut, Store, Users, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  const chartGroups = useMemo(() => buildDashboardCharts(data), [data]);

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
        <div className={`segmented-control dashboard-mode-toggle ${mode === "week" ? "week-active" : ""}`} role="tablist" aria-label="Chọn kiểu báo cáo">
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

      <AdminActionItems data={data} mode={mode} />

      <DashboardCharts groups={chartGroups} />

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

const chartColors = ["#2f6df6", "#0ea47a", "#7c3aed", "#d17a00", "#e11d48"];

function buildDashboardCharts(data) {
  const warehouse = data?.positionSummary?.warehouse || {};
  const sale = data?.positionSummary?.sale || {};
  const employeeRows = data?.employeeRows || [];
  const scheduledDays = employeeRows.reduce((sum, item) => sum + Number(item.scheduledDays || 0), 0);
  const checkoutDays = employeeRows.reduce((sum, item) => sum + Number(item.checkoutDays || 0), 0);
  const missingCheckoutDays = Math.max(scheduledDays - checkoutDays, 0);
  const completedTasks = Number(warehouse.completedTasks || 0) + Number(sale.completedTasks || 0);
  const inProgressTasks = Number(warehouse.inProgressTasks || 0) + Number(sale.inProgressTasks || 0);
  const notStartedTasks = Number(warehouse.notStartedTasks || 0) + Number(sale.notStartedTasks || 0);
  const pendingSchedules = Number(data?.actionItems?.pendingSchedules || 0);
  const pendingOvertime = Number(data?.actionItems?.pendingOvertime || 0);
  const missingCheckouts = Number(data?.actionItems?.missingCheckouts?.length || 0);
  const unfinishedTasks = Number(data?.actionItems?.unfinishedTasks?.length || 0);

  return [
    {
      title: "Cơ cấu nhân sự",
      subtitle: "Kho / Sale",
      totalLabel: `${formatNumber(data?.employees || 0)} người`,
      segments: [
        { label: "Kho", value: Number(warehouse.employees || 0), color: chartColors[1] },
        { label: "Sale", value: Number(sale.employees || 0), color: chartColors[2] },
      ],
    },
    {
      title: "Tỷ lệ checkout",
      subtitle: "Theo ngày có lịch",
      totalLabel: `${formatNumber(checkoutDays)}/${formatNumber(scheduledDays)} ngày`,
      segments: [
        { label: "Đã checkout", value: checkoutDays, color: chartColors[1] },
        { label: "Thiếu", value: missingCheckoutDays, color: chartColors[4] },
      ],
    },
    {
      title: "Tiến độ task",
      subtitle: "Trạng thái công việc",
      totalLabel: `${formatNumber(completedTasks + inProgressTasks + notStartedTasks)} task`,
      segments: [
        { label: "Xong", value: completedTasks, color: chartColors[1] },
        { label: "Đang làm", value: inProgressTasks, color: chartColors[0] },
        { label: "Chưa làm", value: notStartedTasks, color: chartColors[3] },
      ],
    },
    {
      title: "Việc tồn đọng",
      subtitle: "Cần admin xử lý",
      totalLabel: `${formatNumber(pendingSchedules + pendingOvertime + missingCheckouts + unfinishedTasks)} mục`,
      segments: [
        { label: "Lịch", value: pendingSchedules, color: chartColors[3] },
        { label: "Tăng ca", value: pendingOvertime, color: chartColors[2] },
        { label: "Checkout", value: missingCheckouts, color: chartColors[0] },
        { label: "Task", value: unfinishedTasks, color: chartColors[1] },
      ],
    },
  ];
}

function DashboardCharts({ groups }) {
  return (
    <section className="dashboard-chart-grid">
      {groups.map((group) => (
        <article className="dashboard-chart-card" key={group.title}>
          <div className="dashboard-chart-copy">
            <span>{group.subtitle}</span>
            <strong>{group.title}</strong>
          </div>
          <DonutChart segments={group.segments} label={group.totalLabel} />
          <div className="dashboard-chart-legend">
            {group.segments.map((segment) => (
              <div key={segment.label}>
                <i style={{ background: segment.color }} />
                <span>{segment.label}</span>
                <strong>{formatNumber(segment.value || 0)}</strong>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function DonutChart({ segments, label }) {
  const total = segments.reduce((sum, segment) => sum + Number(segment.value || 0), 0);
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-chart" aria-label={label}>
      <svg viewBox="0 0 120 120" role="img">
        <circle className="donut-chart-track" cx="60" cy="60" r={radius} />
        {total > 0 &&
          segments.map((segment) => {
            const value = Number(segment.value || 0);
            const dash = (value / total) * circumference;
            const circle = (
              <circle
                className="donut-chart-segment"
                cx="60"
                cy="60"
                r={radius}
                stroke={segment.color}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                key={segment.label}
              />
            );
            offset += dash;
            return circle;
          })}
      </svg>
      <div>
        <strong>{total > 0 ? Math.round((Number(segments[0]?.value || 0) / total) * 100) : 0}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function AdminActionItems({ data, mode }) {
  const params = new URLSearchParams();
  if (data?.date) params.set("date", data.date);
  const month = data?.date ? Number(data.date.slice(5, 7)) : new Date().getMonth() + 1;
  const year = data?.date ? Number(data.date.slice(0, 4)) : new Date().getFullYear();
  const missingCheckouts = data?.actionItems?.missingCheckouts || [];
  const unfinishedTasks = data?.actionItems?.unfinishedTasks || [];
  const pendingSchedules = data?.actionItems?.pendingSchedules || 0;
  const pendingOvertime = data?.actionItems?.pendingOvertime || 0;
  const total = pendingSchedules + pendingOvertime + missingCheckouts.length + unfinishedTasks.length;
  const label = mode === "week" ? "trong tuần đang xem" : "trong ngày đang xem";

  return (
    <section className="dashboard-actions-panel">
      <div className="dashboard-actions-header">
        <div>
          <span>Việc cần xử lý</span>
          <strong>{total ? `${formatNumber(total)} mục cần xem` : "Không có việc tồn đọng"}</strong>
        </div>
        <AlertCircle size={22} />
      </div>

      <div className="dashboard-actions-grid">
        <ActionCard
          to="/admin/schedule-requests?status=pending"
          icon={CalendarCheck}
          tone="amber"
          title="Duyệt đăng ký lịch"
          value={pendingSchedules}
          detail={pendingSchedules ? "Phiếu lịch đang chờ admin duyệt" : "Không có phiếu lịch chờ duyệt"}
        />
        <ActionCard
          to={`/admin/overtime?month=${month}&year=${year}&status=pending`}
          icon={Clock3}
          tone="purple"
          title="Duyệt tăng ca"
          value={pendingOvertime}
          detail={pendingOvertime ? "Phiếu tăng ca đang chờ quyết định" : "Không có tăng ca chờ duyệt"}
        />
        <ActionCard
          to={`/admin/checkouts?${params.toString()}&status=missing`}
          icon={LogOut}
          tone="blue"
          title="Thiếu checkout"
          value={missingCheckouts.length}
          detail={missingCheckouts.length ? `${missingCheckouts[0]?.user?.name || "Nhân viên"} chưa checkout ${formatDate(missingCheckouts[0]?.date)}` : `Không thiếu checkout ${label}`}
        />
        <ActionCard
          to={`/admin/tasks?${params.toString()}&status=unfinished`}
          icon={ClipboardList}
          tone="green"
          title="Task chưa xong"
          value={unfinishedTasks.length}
          detail={unfinishedTasks.length ? `${unfinishedTasks[0]?.user?.name || "Nhân viên"}: ${unfinishedTasks[0]?.title}` : `Không còn task chưa xong ${label}`}
        />
      </div>
    </section>
  );
}

function ActionCard({ to, icon: Icon, tone, title, value, detail }) {
  return (
    <Link className={`dashboard-action-card ${tone}`} to={to}>
      <div className={`stat-icon ${tone}`}>
        <Icon size={20} />
      </div>
      <div>
        <span>{title}</span>
        <strong>{formatNumber(value || 0)}</strong>
        <p>{detail}</p>
      </div>
    </Link>
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
