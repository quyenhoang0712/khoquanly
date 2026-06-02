import { ReceiptText, Users, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import { formatCurrency, formatDate, formatNumber } from "../../utils/workforce";

export default function AdminServiceExpenses() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState({ totalRecords: 0, totalAmount: 0, employees: 0, byUser: [], rows: [] });
  const [error, setError] = useState("");

  const rows = data.rows || [];
  const byUser = data.byUser || [];
  const average = useMemo(() => (data.totalRecords ? data.totalAmount / data.totalRecords : 0), [data]);

  useEffect(() => {
    api.getAdminServiceExpenses({ month, year }).then(setData).catch((err) => setError(err.message));
  }, [month, year]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tổng hợp theo tháng</p>
          <h1>Chi Phí dịch vụ</h1>
          <p className="page-subtitle">Các khoản nhân viên đã ứng trước trong ngày.</p>
        </div>
      </div>

      <Alert message={error} />

      <div className="toolbar salary-toolbar">
        <label className="field inline-field">
          <span>Tháng</span>
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
              <option key={item} value={item}>Tháng {item}</option>
            ))}
          </select>
        </label>
        <label className="field inline-field">
          <span>Năm</span>
          <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
        </label>
      </div>

      <div className="stats-grid">
        <article className="stat-card"><div className="stat-icon green"><WalletCards size={22} /></div><div><span>Tổng chi phí</span><strong>{formatCurrency(data.totalAmount)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon blue"><ReceiptText size={22} /></div><div><span>Số báo cáo</span><strong>{formatNumber(data.totalRecords)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon slate"><Users size={22} /></div><div><span>Nhân viên</span><strong>{formatNumber(data.employees)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon amber"><ReceiptText size={22} /></div><div><span>Trung bình</span><strong>{formatCurrency(average)}</strong></div></article>
      </div>

      <div className="task-board-grid">
        {byUser.length === 0 && <div className="panel task-board-empty">Chưa có chi phí dịch vụ trong tháng này.</div>}
        {byUser.map((item) => (
          <article className="task-board-card" key={item.user?._id || item.user}>
            <div className="task-board-card-header">
              <div>
                <span>Nhân viên</span>
                <strong>{item.user?.name || "Nhân viên"}</strong>
              </div>
            </div>
            <div className="task-board-fields">
              <div>
                <span>Số báo cáo</span>
                <strong>{formatNumber(item.records)}</strong>
              </div>
              <div>
                <span>Tổng ứng trước</span>
                <strong>{formatCurrency(item.amount)}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="panel table-wrap mobile-card-table">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Nhân viên</th>
              <th>Nội dung</th>
              <th>Số tiền</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5} />}
            {rows.map((row) => (
              <tr key={row._id}>
                <td data-label="Ngày">{formatDate(row.date)}</td>
                <td data-label="Nhân viên">{row.user?.name || "-"}</td>
                <td data-label="Nội dung">{row.title}</td>
                <td data-label="Số tiền">{formatCurrency(row.amount)}</td>
                <td data-label="Ghi chú">{row.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
