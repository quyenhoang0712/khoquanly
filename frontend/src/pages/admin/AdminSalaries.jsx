import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import Modal from "../../components/Modal";
import { exportCsv, formatCurrency, formatDate, formatNumber } from "../../utils/workforce";

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
    exportCsv(`bang-luong-${month}-${year}.csv`, [
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
        </div>
        <button className="button primary" type="button" onClick={doExport}>
          Xuất bảng lương
        </button>
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

      <div className="stats-grid salary-stats">
        <article className="stat-card"><div><span>Nhân viên</span><strong>{formatNumber(summary.employees)}</strong></div></article>
        <article className="stat-card"><div><span>Tổng ca</span><strong>{formatNumber(summary.shifts)}</strong></div></article>
        <article className="stat-card"><div><span>Tổng giờ</span><strong>{formatNumber(summary.hours)}</strong></div></article>
        <article className="stat-card"><div><span>Tổng lương</span><strong>{formatCurrency(summary.salary)}</strong></div></article>
      </div>

      <div className="panel table-wrap">
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
                  <td><strong>{row.user?.name || "Nhân viên"}</strong></td>
                  <td>{row.user?.email || "-"}</td>
                  <td>{formatNumber(row.totalShifts)}</td>
                  <td>{formatNumber(row.totalHours)}</td>
                  <td><strong>{formatCurrency(row.totalSalary)}</strong></td>
                  <td><button className="button small ghost" type="button" onClick={() => openDetail(row.user?._id)}>Xem</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <Modal title={`Chi tiết lương - ${detail.user?.name || "Nhân viên"}`} onClose={() => setDetail(null)}>
          <div className="salary-detail-summary">
            <div><span>Tổng ca</span><strong>{formatNumber(detail.totalShifts)}</strong></div>
            <div><span>Tổng giờ</span><strong>{formatNumber(detail.totalHours)}</strong></div>
            <div><span>Tổng lương</span><strong>{formatCurrency(detail.totalSalary)}</strong></div>
          </div>
          <div className="table-wrap">
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
                    <td>{formatDate(item.date)}</td>
                    <td>{item.morning ? "09:00 - 13:00" : "-"}</td>
                    <td>{item.afternoon ? "13:00 - 17:00" : "-"}</td>
                    <td>{formatNumber(item.hours)}</td>
                    <td>{formatCurrency(item.salary)}</td>
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
