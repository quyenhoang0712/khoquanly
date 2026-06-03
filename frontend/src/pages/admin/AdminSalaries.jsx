import { Banknote, Clock3, Plus, ReceiptText, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import Modal from "../../components/Modal";
import { exportCsv, formatCurrency, formatDate, formatNumber, salaryPeriodLabel, shiftTimeLabel } from "../../utils/workforce";

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
          overtimeHours: acc.overtimeHours + Number(row.overtimeHours || 0),
          overtimeSalary: acc.overtimeSalary + Number(row.overtimeSalary || 0),
          travelAllowance: acc.travelAllowance + Number(row.travelAllowance || 0),
          salary: acc.salary + Number(row.totalSalary || 0),
        }),
        { employees: 0, shifts: 0, hours: 0, overtimeHours: 0, overtimeSalary: 0, travelAllowance: 0, salary: 0 }
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
      ["Nhan vien", "Email", "Tong ca", "Tong gio", "Gio tang ca", "Tien tang ca", "Phi di lai", "Tong luong"],
      ...rows.map((row) => [
        row.user?.name,
        row.user?.email,
        row.totalShifts,
        row.totalHours,
        row.overtimeHours || 0,
        row.overtimeSalary || 0,
        row.travelAllowance || 0,
        row.totalSalary,
      ]),
    ]);
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Payroll</p>
          <h1>Bảng lương nhân viên</h1>
          <p className="muted">Kỳ lương 4 tuần, bắt đầu ngày 11: {periodLabel}</p>
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
        <article className="stat-card"><div className="stat-icon blue"><Users size={22} /></div><div><span>Nhân viên</span><strong>{formatNumber(summary.employees)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon slate"><ReceiptText size={22} /></div><div><span>Tổng ca</span><strong>{formatNumber(summary.shifts)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon amber"><Clock3 size={22} /></div><div><span>Tổng giờ</span><strong>{formatNumber(summary.hours)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon purple"><Plus size={22} /></div><div><span>Tăng ca</span><strong>{formatNumber(summary.overtimeHours)} giờ</strong></div></article>
        <article className="stat-card"><div className="stat-icon blue"><ReceiptText size={22} /></div><div><span>Phí đi lại</span><strong>{formatCurrency(summary.travelAllowance)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon green"><Banknote size={22} /></div><div><span>Tổng lương</span><strong>{formatCurrency(summary.salary)}</strong></div></article>
      </div>

      {loading && <div className="panel task-board-empty">Đang tải bảng lương...</div>}
      {!loading && rows.length === 0 && <div className="panel task-board-empty">Không có dữ liệu.</div>}
      <div className="task-board-grid">
        {!loading &&
          rows.map((row) => (
            <article className="task-board-card" key={row.user?._id || row.user?.email}>
              <div className="task-board-card-header">
                <div>
                  <span>Nhân viên</span>
                  <strong>{row.user?.name || "Nhân viên"}</strong>
                </div>
                <button className="button small ghost" type="button" onClick={() => openDetail(row.user?._id)}>
                  Xem
                </button>
              </div>
              <div className="task-board-fields">
                <div className="task-board-field-wide">
                  <span>Email</span>
                  <p>{row.user?.email || "-"}</p>
                </div>
                <div>
                  <span>Tổng ca</span>
                  <p>{formatNumber(row.totalShifts)}</p>
                </div>
                <div>
                  <span>Tổng giờ</span>
                  <p>{formatNumber(row.totalHours)}</p>
                </div>
                <div>
                  <span>Tăng ca</span>
                  <p>{formatNumber(row.overtimeHours || 0)} giờ · {formatCurrency(row.overtimeSalary || 0)}</p>
                </div>
                <div>
                  <span>Phí đi lại</span>
                  <p>{row.travelAllowance ? formatCurrency(row.travelAllowance) : "-"}</p>
                </div>
                <div>
                  <span>Tổng lương</span>
                  <p><strong>{formatCurrency(row.totalSalary)}</strong></p>
                </div>
              </div>
            </article>
          ))}
      </div>

      {detail && (
        <Modal title={`Chi tiết lương - ${detail.user?.name || "Nhân viên"}`} onClose={() => setDetail(null)}>
          <p className="muted">Kỳ lương 4 tuần, bắt đầu ngày 11: {salaryPeriodLabel(detail.month, detail.year, detail.periodStart, detail.periodEnd)}</p>
          <div className="salary-detail-summary">
            <div><span>Tổng ca</span><strong>{formatNumber(detail.totalShifts)}</strong></div>
            <div><span>Tổng giờ</span><strong>{formatNumber(detail.totalHours)}</strong></div>
            <div><span>Tăng ca</span><strong>{formatNumber(detail.overtimeHours || 0)} giờ</strong></div>
            <div><span>Phí đi lại</span><strong>{formatCurrency(detail.travelAllowance || 0)}</strong></div>
            <div><span>Tổng lương</span><strong>{formatCurrency(detail.totalSalary)}</strong></div>
          </div>
          {detail.overtimeRecords?.length > 0 && (
            <div className="table-wrap mobile-card-table">
              <table>
                <thead>
                  <tr>
                    <th>Ngày tăng ca</th>
                    <th>Giờ</th>
                    <th>Đơn giá</th>
                    <th>Tiền tăng ca</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.overtimeRecords.map((item) => (
                    <tr key={item._id}>
                      <td data-label="Ngày tăng ca">{item.date ? formatDate(item.date) : `Tháng ${item.month}/${item.year}`}</td>
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
                    <td data-label="Ca sáng">{item.morning ? shiftTimeLabel(detail.user?.position, "morning") : "-"}</td>
                    <td data-label="Ca chiều">{item.afternoon ? shiftTimeLabel(detail.user?.position, "afternoon") : "-"}</td>
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
