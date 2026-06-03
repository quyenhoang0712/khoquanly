import { CalendarCheck, ClipboardList, Clock3, LogOut, Wallet } from "lucide-react";
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
  const [scheduleRequests, setScheduleRequests] = useState([]);
  const [overtimeRows, setOvertimeRows] = useState([]);
  const [salary, setSalary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const now = new Date();
    Promise.all([
      api.getMySchedule({ date: today() }),
      api.getTodayTasks(),
      api.getMyCheckouts({ date: today() }),
      api.getMySalary(),
      api.getMyScheduleRequests({ status: "pending" }),
      api.getMyOvertime({ month: now.getMonth() + 1, year: now.getFullYear() }),
    ])
      .then(([scheduleData, taskData, checkoutData, salaryData, requestData, overtimeData]) => {
        setSchedule(scheduleData);
        setTasks(taskData);
        setCheckouts(checkoutData);
        setScheduleRequests(requestData);
        setOvertimeRows(overtimeData);
        setSalary(salaryData);
      })
      .catch((err) => setError(err.message));
  }, []);

  const unfinishedTasks = tasks.filter((task) => task.currentStatus !== "completed");
  const checkedOut = checkouts.length > 0;
  const pendingOvertime = overtimeRows.filter((row) => row.status === "pending").length;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const actionItems = [
    {
      to: `/user/checkout?date=${today()}`,
      icon: LogOut,
      tone: checkedOut || schedule.length === 0 ? "blue" : "amber",
      title: "Checkout hôm nay",
      value: schedule.length > 0 && !checkedOut ? 1 : 0,
      detail: schedule.length === 0 ? "Hôm nay bạn không có ca làm" : checkedOut ? "Bạn đã checkout hôm nay" : "Bạn có ca làm và chưa checkout",
    },
    {
      to: `/user/tasks?date=${today()}&status=unfinished`,
      icon: ClipboardList,
      tone: unfinishedTasks.length ? "green" : "blue",
      title: "Việc chưa xong",
      value: unfinishedTasks.length,
      detail: unfinishedTasks.length ? unfinishedTasks[0]?.title : "Không còn việc cần xử lý hôm nay",
    },
    {
      to: "/user/schedule-request?status=pending",
      icon: CalendarCheck,
      tone: scheduleRequests.length ? "amber" : "blue",
      title: "Lịch chờ duyệt",
      value: scheduleRequests.length,
      detail: scheduleRequests.length ? "Phiếu đăng ký lịch đang chờ admin duyệt" : "Không có phiếu lịch chờ duyệt",
    },
    {
      to: `/user/overtime?month=${currentMonth}&year=${currentYear}&status=pending`,
      icon: Clock3,
      tone: pendingOvertime ? "purple" : "blue",
      title: "Tăng ca chờ duyệt",
      value: pendingOvertime,
      detail: pendingOvertime ? "Phiếu tăng ca đang chờ admin duyệt" : "Không có tăng ca chờ duyệt",
    },
  ];
  const actionTotal = actionItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
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

      <section className="dashboard-actions-panel">
        <div className="dashboard-actions-header">
          <div>
            <span>Việc cần xử lý</span>
            <strong>{actionTotal ? `${formatNumber(actionTotal)} mục cần xem` : "Không có việc tồn đọng"}</strong>
          </div>
          <ClipboardList size={22} />
        </div>
        <div className="dashboard-actions-grid">
          {actionItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link className={`dashboard-action-card ${item.tone}`} to={item.to} key={item.title}>
                <div className={`stat-icon ${item.tone}`}>
                  <Icon size={20} />
                </div>
                <div>
                  <span>{item.title}</span>
                  <strong>{formatNumber(item.value || 0)}</strong>
                  <p>{item.detail}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

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
