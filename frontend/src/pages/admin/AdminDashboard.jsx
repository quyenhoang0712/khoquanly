import { CalendarCheck, ClipboardList, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import { formatNumber } from "../../utils/workforce";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAdminDashboard().then(setData).catch((err) => setError(err.message));
  }, []);

  const stats = [
    ["Nhân viên", data?.employees, Users, "blue"],
    ["Phiếu lịch chờ duyệt", data?.pendingSchedules, CalendarCheck, "amber"],
    ["Công việc hôm nay", data?.todayTasks, ClipboardList, "green"],
  ];

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tổng quan nhân sự</p>
          <h1>Admin Dashboard</h1>
        </div>
      </div>
      <Alert message={error} />
      <div className="stats-grid">
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
      <div className="panel form-panel">
        <h2>Luồng quản lý chính</h2>
        <p className="muted">Duyệt lịch tuần, giao việc hằng ngày, xem báo cáo, checkout và tính lương tháng cho nhân viên.</p>
      </div>
    </section>
  );
}
