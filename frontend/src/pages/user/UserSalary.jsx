import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import { formatCurrency, formatDate, formatNumber } from "../../utils/workforce";

export default function UserSalary() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [salary, setSalary] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.getMySalary({ month, year }).then(setSalary).catch((err) => setError(err.message)); }, [month, year]);
  return <section className="page"><div className="page-header"><div><p className="eyebrow">Lương tháng</p><h1>Lương của tôi</h1></div></div><Alert message={error} /><div className="toolbar"><input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} /><input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></div><div className="stats-grid"><article className="stat-card"><div><span>Số ca đã làm</span><strong>{formatNumber(salary?.totalShifts || 0)}</strong></div></article><article className="stat-card"><div><span>Tổng giờ</span><strong>{formatNumber(salary?.totalHours || 0)}</strong></div></article><article className="stat-card"><div><span>Tổng lương</span><strong>{formatCurrency(salary?.totalSalary || 0)}</strong></div></article></div><div className="panel table-wrap mobile-card-table"><table><thead><tr><th>Ngày</th><th>Ca sáng</th><th>Ca chiều</th><th>Giờ</th><th>Lương</th></tr></thead><tbody>{!salary?.details?.length && <EmptyRow colSpan={5} />}{salary?.details?.map((item) => <tr key={item.date}><td data-label="Ngày">{formatDate(item.date)}</td><td data-label="Ca sáng">{item.morning ? "Có" : "-"}</td><td data-label="Ca chiều">{item.afternoon ? "Có" : "-"}</td><td data-label="Giờ">{item.hours}</td><td data-label="Lương">{formatCurrency(item.salary)}</td></tr>)}</tbody></table></div></section>;
}
