import { Clock3, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { Alert, StatusBadge } from "../../components/DataState";
import { formatCurrency, formatDate, formatNumber, today } from "../../utils/workforce";

export default function UserOvertime() {
  const now = new Date();
  const [searchParams] = useSearchParams();
  const [month, setMonth] = useState(Number(searchParams.get("month")) || now.getMonth() + 1);
  const [year, setYear] = useState(Number(searchParams.get("year")) || now.getFullYear());
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") === "pending" ? "pending" : "");
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ date: today(), hours: "", note: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const summary = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          requests: acc.requests + 1,
          pending: acc.pending + (row.status === "pending" ? 1 : 0),
          approvedHours: acc.approvedHours + (row.status === "approved" ? Number(row.hours || 0) : 0),
          approvedAmount: acc.approvedAmount + (row.status === "approved" ? Number(row.amount || 0) : 0),
        }),
        { requests: 0, pending: 0, approvedHours: 0, approvedAmount: 0 }
      ),
    [rows]
  );
  const visibleRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((row) => (row.status || "approved") === statusFilter);
  }, [rows, statusFilter]);

  const load = async () => {
    try {
      setError("");
      setRows(await api.getMyOvertime({ month, year }));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [month, year]);

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      setError("");
      setMessage("");
      await api.createOvertimeRequest({ ...form, hours: Number(form.hours) });
      setMessage("Đã gửi phiếu tăng ca.");
      setForm({ date: today(), hours: "", note: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tăng ca</p>
          <h1>Gửi phiếu tăng ca</h1>
          <p className="page-subtitle">Nhập ngày và số giờ tăng ca để admin duyệt vào bảng lương.</p>
        </div>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

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
        <label className="field inline-field">
          <span>Trạng thái</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Tất cả</option>
            <option value="pending">Chờ duyệt</option>
          </select>
        </label>
      </div>

      <div className="stats-grid">
        <article className="stat-card"><div className="stat-icon blue"><Plus size={22} /></div><div><span>Phiếu đã gửi</span><strong>{formatNumber(summary.requests)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon amber"><Clock3 size={22} /></div><div><span>Chờ duyệt</span><strong>{formatNumber(summary.pending)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon green"><Clock3 size={22} /></div><div><span>Giờ đã duyệt</span><strong>{formatNumber(summary.approvedHours)} giờ</strong></div></article>
        <article className="stat-card"><div className="stat-icon green"><Plus size={22} /></div><div><span>Cộng lương</span><strong>{formatCurrency(summary.approvedAmount)}</strong></div></article>
      </div>

      <div className="panel form-panel overtime-form-panel">
        <form className="product-form overtime-request-form" onSubmit={submit}>
          <label className="field">
            <span>Ngày tăng ca</span>
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
          </label>
          <label className="field">
            <span>Số giờ tăng ca</span>
            <input type="number" min="0.5" step="0.5" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} required />
          </label>
          <label className="field">
            <span>Ghi chú</span>
            <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Lý do tăng ca..." />
          </label>
          <button className="button primary overtime-submit" disabled={submitting}>{submitting ? "Đang gửi..." : "Gửi phiếu tăng ca"}</button>
        </form>
      </div>

      <div className="task-board-grid overtime-request-grid">
        {visibleRows.length === 0 && <div className="panel task-board-empty">Chưa có phiếu tăng ca trong tháng này.</div>}
        {visibleRows.map((row) => (
          <article className="task-board-card" key={row._id}>
            <div className="task-board-card-header">
              <div>
                <span>Ngày tăng ca</span>
                <strong>{formatDate(row.date)}</strong>
              </div>
              <StatusBadge status={row.status || "approved"} />
            </div>
            <div className="task-board-fields">
              <div><span>Số giờ</span><strong>{formatNumber(row.hours)} giờ</strong></div>
              <div><span>Cộng lương</span><strong>{row.status === "approved" ? formatCurrency(row.amount) : "-"}</strong></div>
              <div><span>Ghi chú</span><p>{row.note || "-"}</p></div>
              <div><span>Phản hồi admin</span><p>{row.adminNote || "-"}</p></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
