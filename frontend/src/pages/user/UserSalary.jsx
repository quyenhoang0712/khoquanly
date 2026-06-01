import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import { formatCurrency, formatDate, formatNumber, salaryPeriodLabel } from "../../utils/workforce";

export default function UserSalary() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [salary, setSalary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMySalary({ month, year }).then(setSalary).catch((err) => setError(err.message));
  }, [month, year]);

  const periodLabel = salaryPeriodLabel(month, year, salary?.periodStart, salary?.periodEnd);

  return (
    <section className="page user-salary-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Kỳ lương</p>
          <h1>Lương của tôi</h1>
          <p className="muted">Tính theo 4 tuần: {periodLabel}</p>
        </div>
      </div>

      <Alert message={error} />

      <div className="toolbar salary-toolbar">
        <label className="field inline-field">
          <span>Kỳ bắt đầu tháng</span>
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
        <article className="stat-card"><div><span>Số ca đã làm</span><strong>{formatNumber(salary?.totalShifts || 0)}</strong></div></article>
        <article className="stat-card"><div><span>Tổng giờ</span><strong>{formatNumber(salary?.totalHours || 0)}</strong></div></article>
        <article className="stat-card"><div><span>Tăng ca</span><strong>{formatNumber(salary?.overtimeHours || 0)} giờ</strong></div></article>
        <article className="stat-card"><div><span>Tổng lương</span><strong>{formatCurrency(salary?.totalSalary || 0)}</strong></div></article>
      </div>

      {salary?.overtimeRecords?.length > 0 && (
        <div className="panel table-wrap salary-table">
          <table>
            <thead>
              <tr>
                <th>Tăng ca</th>
                <th>Giờ</th>
                <th>Đơn giá</th>
                <th>Tiền tăng ca</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {salary.overtimeRecords.map((item) => (
                <tr key={item._id}>
                  <td data-label="Tăng ca">Tháng {item.month}/{item.year}</td>
                  <td data-label="Giờ">{formatNumber(item.hours)}</td>
                  <td data-label="Đơn giá">{formatCurrency(item.hourlyRate)}</td>
                  <td data-label="Tiền tăng ca">{formatCurrency(item.amount)}</td>
                  <td data-label="Ghi chú">{item.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel table-wrap salary-table">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Ca sáng</th>
              <th>Ca chiều</th>
              <th>Giờ</th>
              <th>Lương</th>
            </tr>
          </thead>
          <tbody>
            {!salary?.details?.length && <EmptyRow colSpan={5} />}
            {salary?.details?.map((item) => (
              <tr key={item.date}>
                <td data-label="Ngày">{formatDate(item.date)}</td>
                <td data-label="Ca sáng">{item.morning ? "09:00 - 13:00" : "-"}</td>
                <td data-label="Ca chiều">{item.afternoon ? "13:00 - 17:00" : "-"}</td>
                <td data-label="Giờ">{formatNumber(item.hours)}</td>
                <td data-label="Lương">{formatCurrency(item.salary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="salary-mobile-list">
        {!salary?.details?.length && <div className="salary-day-card empty">Không có dữ liệu lương trong kỳ này.</div>}
        {salary?.details?.map((item) => (
          <article className="salary-day-card" key={item.date}>
            <div className="salary-day-head">
              <span>Ngày</span>
              <strong>{formatDate(item.date)}</strong>
            </div>
            <div className="salary-shifts">
              <span className={item.morning ? "shift-pill active" : "shift-pill"}>
                Ca sáng {item.morning ? "09:00 - 13:00" : "-"}
              </span>
              <span className={item.afternoon ? "shift-pill active afternoon" : "shift-pill"}>
                Ca chiều {item.afternoon ? "13:00 - 17:00" : "-"}
              </span>
            </div>
            <div className="salary-day-total">
              <div>
                <span>Giờ</span>
                <strong>{formatNumber(item.hours)}</strong>
              </div>
              <div>
                <span>Lương</span>
                <strong>{formatCurrency(item.salary)}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
