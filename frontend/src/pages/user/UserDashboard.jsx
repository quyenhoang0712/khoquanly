import { CalendarCheck, ClipboardList, Clock, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import { formatCurrency, formatNumber, shiftLabels, today } from "../../utils/workforce";

export default function UserDashboard() {
  const [schedule, setSchedule] = useState([]);
  const [coworkers, setCoworkers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [salary, setSalary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getMySchedule({ date: today() }), api.getCoworkers({ date: today() }), api.getTodayTasks(), api.getMySalary()])
      .then(([scheduleData, coworkersData, taskData, salaryData]) => { setSchedule(scheduleData); setCoworkers(coworkersData); setTasks(taskData); setSalary(salaryData); })
      .catch((err) => setError(err.message));
  }, []);

  const coworkerNames = [...new Set(coworkers.map((item) => item.user?.name).filter(Boolean))];
  const stats = [
    ["Ca hôm nay", schedule.map((item) => shiftLabels[item.shift]).join(", ") || "Không có", CalendarCheck, "blue"],
    ["Làm với", coworkerNames.join(", ") || "-", Clock, "slate"],
    ["Công việc hôm nay", formatNumber(tasks.length), ClipboardList, "green"],
    ["Lương tạm tính", formatCurrency(salary?.totalSalary || 0), Wallet, "amber"],
  ];

  return <section className="page"><div className="page-header"><div><p className="eyebrow">Cá nhân</p><h1>Dashboard nhân viên</h1></div></div><Alert message={error} /><div className="stats-grid">{stats.map(([label, value, Icon, tone]) => <article className="stat-card" key={label}><div className={`stat-icon ${tone}`}><Icon size={22} /></div><div><span>{label}</span><strong>{value}</strong></div></article>)}</div></section>;
}
