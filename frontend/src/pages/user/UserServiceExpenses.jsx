import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import { formatCurrency, formatDate, today } from "../../utils/workforce";

export default function UserServiceExpenses() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ title: "", amount: "", note: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows]);

  const load = async () => {
    try {
      setError("");
      setRows(await api.getMyServiceExpenses({ date }));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [date]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      setMessage("");
      await api.createServiceExpense({
        date,
        title: form.title,
        amount: Number(form.amount),
        note: form.note,
      });
      setForm({ title: "", amount: "", note: "" });
      setMessage("Đã gửi chi phí dịch vụ.");
      await load();
    } catch (err) {
      setError(err.message);
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Báo cáo trong ngày</p>
          <h1>Chi Phí dịch vụ</h1>
          <p className="page-subtitle">Ghi lại khoản tiền đã ứng trước trong ngày để admin tổng hợp theo tháng.</p>
        </div>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

      <div className="panel form-panel">
        <form className="product-form" onSubmit={submit}>
          <label className="field">
            <span>Ngày</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>

          <label className="field">
            <span>Ứng trước tiền gì</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Ví dụ: phí giao hàng, gửi xe, mua vật tư..."
              required
            />
          </label>

          <label className="field">
            <span>Số tiền</span>
            <input
              type="number"
              min="1000"
              step="1000"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="Nhập số tiền"
              required
            />
          </label>

          <label className="field">
            <span>Ghi chú</span>
            <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ghi chú thêm nếu cần..." />
          </label>

          <button className="button primary" type="submit" disabled={submitting}>
            {submitting ? "Đang gửi..." : "Gửi chi phí"}
          </button>
        </form>
      </div>

      <div className="page-header compact-page-header">
        <div>
          <h2>Đã ghi trong ngày</h2>
          <p className="page-subtitle">Tổng: {formatCurrency(total)}</p>
        </div>
      </div>

      <div className="panel table-wrap mobile-card-table">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Nội dung</th>
              <th>Số tiền</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={4} />}
            {rows.map((row) => (
              <tr key={row._id}>
                <td data-label="Ngày">{formatDate(row.date)}</td>
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
