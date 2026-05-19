import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import Modal from "../../components/Modal";
import { exportCsv, formatCurrency, formatDate, formatNumber, salaryPeriodLabel } from "../../utils/workforce";

export default function AdminSalaries() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const summary = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          employees: acc.employees + 1,
          shifts: acc.shifts + Number(row.totalShifts || 0),
          hours: acc.hours + Number(row.totalHours || 0),
          salary: acc.salary + Number(row.totalSalary || 0),
        }),
        { employees: 0, shifts: 0, hours: 0, salary: 0 }
      ),
    [rows]
  );
  const periodLabel = salaryPeriodLabel(month, year, rows[0]?.periodStart, rows[0]?.periodEnd);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setRows(await api.getAdminSalaries({ month, year }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [month, year]);

  const openDetail = async (userId) => {
    try {
      setError("");
      setDetail(await api.getAdminSalaryDetail(userId, { month, year }));
    } catch (err) {
      setError(err.message);
    }
  };

  const doExport = () => {
    exportCsv(`bang-luong-ky-${month}-${year}.csv`, [
      ["Ky luong", periodLabel],
      ["Nhan vien", "Email", "Tong ca", "Tong gio", "Tong luong"],
      ...rows.map((row) => [row.user?.name, row.user?.email, row.totalShifts, row.totalHours, row.totalSalary]),
    ]);
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Payroll</p>
          <h1>Bảng lương nhân viên</h1>
          <p className="muted">Kỳ lương 4 tuần: {periodLabel}</p>
        </div>
        <button className="button primary" type="button" onClick={doExport}>
          Xuất bảng lương
        </button>
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

      <div className="stats-grid salary-stats">
        <article className="stat-card"><div><span>Nhân viên</span><strong>{formatNumber(summary.employees)}</strong></div></article>
        <article className="stat-card"><div><span>Tổng ca</span><strong>{formatNumber(summary.shifts)}</strong></div></article>
        <article className="stat-card"><div><span>Tổng giờ</span><strong>{formatNumber(summary.hours)}</strong></div></article>
        <article className="stat-card"><div><span>Tổng lương</span><strong>{formatCurrency(summary.salary)}</strong></div></article>
      </div>

      <div className="panel table-wrap mobile-card-table">
        <table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Tổng ca</th>
              <th>Tổng giờ</th>
              <th>Tổng lương</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {loading && <EmptyRow colSpan={6}>Đang tải bảng lương...</EmptyRow>}
            {!loading && rows.length === 0 && <EmptyRow colSpan={6} />}
            {!loading &&
              rows.map((row) => (
                <tr key={row.user?._id || row.user?.email}>
                  <td data-label="Nhân viên"><strong>{row.user?.name || "Nhân viên"}</strong></td>
                  <td data-label="Email">{row.user?.email || "-"}</td>
                  <td data-label="Tổng ca">{formatNumber(row.totalShifts)}</td>
                  <td data-label="Tổng giờ">{formatNumber(row.totalHours)}</td>
                  <td data-label="Tổng lương"><strong>{formatCurrency(row.totalSalary)}</strong></td>
                  <td data-label="Chi tiết"><button className="button small ghost" type="button" onClick={() => openDetail(row.user?._id)}>Xem</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <Modal title={`Chi tiết lương - ${detail.user?.name || "Nhân viên"}`} onClose={() => setDetail(null)}>
          <p className="muted">Kỳ lương 4 tuần: {salaryPeriodLabel(detail.month, detail.year, detail.periodStart, detail.periodEnd)}</p>
          <div className="salary-detail-summary">
            <div><span>Tổng ca</span><strong>{formatNumber(detail.totalShifts)}</strong></div>
            <div><span>Tổng giờ</span><strong>{formatNumber(detail.totalHours)}</strong></div>
            <div><span>Tổng lương</span><strong>{formatCurrency(detail.totalSalary)}</strong></div>
          </div>
          <div className="table-wrap mobile-card-table">
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
                {detail.details?.length === 0 && <EmptyRow colSpan={5} />}
                {detail.details?.map((item) => (
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
        </Modal>
      )}
    </section>
  );
}
