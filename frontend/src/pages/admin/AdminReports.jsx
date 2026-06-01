import { Banknote, CalendarCheck, CheckCircle2, ClipboardList, LoaderCircle, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Alert, StatusBadge } from "../../components/DataState";
import { formatCurrency, formatDate, formatNumber, statusLabels, today } from "../../utils/workforce";

const currentMonth = () => today().slice(0, 7);

export default function AdminReports() {
  const [monthValue, setMonthValue] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const [year, month] = useMemo(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
    if (match) return [Number(match[1]), Number(match[2])];
    return today().split("-").slice(0, 2).map(Number);
  }, [monthValue]);

  useEffect(() => {
    api.getAdminMonthlyReport({ month, year }).then(setData).catch((err) => setError(err.message));
  }, [month, year]);

  const stats = [
    ["Tổng lương", data?.salary?.totalSalary, Banknote, "green", formatCurrency],
    ["Nhân viên", data?.salary?.employees, Users, "blue", formatNumber],
    ["Việc đã xong", data?.work?.completed, CheckCircle2, "green", formatNumber],
    ["Chưa checkout", data?.checkout?.missingDays, CalendarCheck, "amber", formatNumber],
  ];

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Báo cáo tháng</p>
          <h1>Báo cáo tổng hợp</h1>
        </div>
      </div>

      <Alert message={error} />

      <div className="toolbar date-filter">
        <input type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} />
      </div>

      <div className="stats-grid">
        {stats.map(([label, value, Icon, tone, formatter]) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}>
              <Icon size={22} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{formatter(value || 0)}</strong>
            </div>
          </article>
        ))}
      </div>

      <section className="report-section">
        <div className="report-section-header">
          <div>
            <span>Báo cáo lương</span>
            <strong>{formatCurrency(data?.salary?.totalSalary || 0)}</strong>
          </div>
          <small>{formatNumber(data?.salary?.totalShifts || 0)} ca · {formatNumber(data?.salary?.totalHours || 0)} giờ</small>
        </div>
        <div className="task-board-grid report-card-grid">
          {data?.salary?.rows?.length === 0 && <div className="panel task-board-empty">Chưa có dữ liệu lương.</div>}
          {data?.salary?.rows?.map((row) => (
            <article className="task-board-card" key={row.user?._id || row.user?.email}>
              <div className="task-board-card-header">
                <div>
                  <span>Nhân viên</span>
                  <strong>{row.user?.name || "Nhân viên"}</strong>
                </div>
                <strong>{formatCurrency(row.totalSalary)}</strong>
              </div>
              <div className="task-board-fields">
                <div><span>Email</span><strong>{row.user?.email || "-"}</strong></div>
                <div><span>Tổng ca</span><strong>{formatNumber(row.totalShifts)}</strong></div>
                <div><span>Tổng giờ</span><strong>{formatNumber(row.totalHours)}</strong></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-header">
          <div>
            <span>Báo cáo công việc</span>
            <strong>{formatNumber(data?.work?.totalTasks || 0)} công việc</strong>
          </div>
          <small>{formatNumber(data?.work?.reports || 0)} báo cáo đã gửi</small>
        </div>
        <div className="stats-grid report-mini-stats">
          <article className="stat-card"><div className="stat-icon slate"><ClipboardList size={22} /></div><div><span>Chưa làm</span><strong>{formatNumber(data?.work?.notStarted || 0)}</strong></div></article>
          <article className="stat-card"><div className="stat-icon amber"><LoaderCircle size={22} /></div><div><span>Đang làm</span><strong>{formatNumber(data?.work?.inProgress || 0)}</strong></div></article>
          <article className="stat-card"><div className="stat-icon green"><CheckCircle2 size={22} /></div><div><span>Đã xong</span><strong>{formatNumber(data?.work?.completed || 0)}</strong></div></article>
        </div>
        <div className="task-board-grid report-card-grid">
          {data?.work?.tasks?.length === 0 && <div className="panel task-board-empty">Chưa có công việc trong tháng.</div>}
          {data?.work?.tasks?.map((task) => (
            <article className="task-board-card" key={task._id}>
              <div className="task-board-card-header">
                <div>
                  <span>{formatDate(task.date)}</span>
                  <strong>{task.title}</strong>
                </div>
              </div>
              <div className="task-board-fields">
                <div><span>Nhân viên</span><strong>{task.assignedTo?.map((user) => user.name || user.email).join(", ") || "-"}</strong></div>
                <div>
                  <span>Tiến độ</span>
                  <div className="status-stack">
                    {(task.statusByUser || []).map((item, index) => (
                      <StatusBadge key={item._id || `${task._id}-${index}`} status={statusLabels[item.status] || item.status || "not-started"} />
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-header">
          <div>
            <span>Báo cáo checkout</span>
            <strong>{formatNumber(data?.checkout?.checkedOutDays || 0)} ngày đã checkout</strong>
          </div>
          <small>{formatNumber(data?.checkout?.missingDays || 0)} ngày chưa checkout</small>
        </div>
        <div className="task-board-grid report-card-grid">
          {data?.checkout?.employees?.map((row) => (
            <article className="task-board-card" key={row.user?._id || row.user?.email}>
              <div className="task-board-card-header">
                <div>
                  <span>Nhân viên</span>
                  <strong>{row.user?.name || "Nhân viên"}</strong>
                </div>
                <StatusBadge status={row.missingDays ? "pending" : "approved"} />
              </div>
              <div className="task-board-fields">
                <div><span>Ngày cần checkout</span><strong>{formatNumber(row.dueDays)}</strong></div>
                <div><span>Đã checkout</span><strong>{formatNumber(row.checkedOutDays)}</strong></div>
                <div><span>Chưa checkout</span><strong>{formatNumber(row.missingDays)}</strong></div>
                <div>
                  <span>Ngày thiếu</span>
                  <p>{row.missingDates?.length ? row.missingDates.map(formatDate).join(", ") : "-"}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
