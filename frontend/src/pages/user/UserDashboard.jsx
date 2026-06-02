import { ArrowRight, CalendarCheck, ClipboardList, LogOut, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, authStorage } from "../../api";
import { Alert } from "../../components/DataState";
import { formatCurrency, formatNumber, shiftLabels, shiftTimeLabel, today } from "../../utils/workforce";

export default function UserDashboard() {
  const currentUser = authStorage.getUser();
  const position = currentUser?.position || "warehouse";
  const [schedule, setSchedule] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [salary, setSalary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getMySchedule({ date: today() }), api.getTodayTasks(), api.getMyCheckouts({ date: today() }), api.getMySalary()])
      .then(([scheduleData, taskData, checkoutData, salaryData]) => {
        setSchedule(scheduleData);
        setTasks(taskData);
        setCheckouts(checkoutData);
        setSalary(salaryData);
      })
      .catch((err) => setError(err.message));
  }, []);

  const completedTasks = tasks.filter((task) => task.currentStatus === "completed").length;
  const checkedOut = checkouts.length > 0;
  const stats = [
    ["Ca hôm nay", schedule.map((item) => `${shiftLabels[item.shift]} ${shiftTimeLabel(position, item.shift)}`).join(", ") || "Không có", CalendarCheck, "blue"],
    ["Công việc hôm nay", formatNumber(tasks.length), ClipboardList, "green"],
    ["Lương tạm tính", formatCurrency(salary?.totalSalary || 0), Wallet, "amber"],
  ];

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Cá nhân</p>
          <h1>Dashboard nhân viên</h1>
        </div>
      </div>
      <Alert message={error} />

      <div className="daily-report-grid">
        <Link className="daily-report-card green" to="/user/tasks">
          <div className="daily-report-icon">
            <ClipboardList size={24} />
          </div>
          <div>
            <span>Báo cáo ngày</span>
            <strong>Việc làm hôm nay</strong>
            <p>{formatNumber(completedTasks)}/{formatNumber(tasks.length)} việc đã xong</p>
          </div>
          <ArrowRight size={20} />
        </Link>
        <Link className={`daily-report-card ${checkedOut ? "blue" : "amber"}`} to="/user/checkout">
          <div className="daily-report-icon">
            <LogOut size={24} />
          </div>
          <div>
            <span>Cuối ca</span>
            <strong>Checkout</strong>
            <p>{checkedOut ? "Đã checkout hôm nay" : "Bấm để qua trang checkout"}</p>
          </div>
          <ArrowRight size={20} />
        </Link>
      </div>

      <div className="stats-grid">
        {stats.map(([label, value, Icon, tone]) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}>
              <Icon size={22} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
