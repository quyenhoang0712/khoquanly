import { Clock3, Plus, ReceiptText, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatCurrency, formatNumber } from "../../utils/workforce";

export default function AdminOvertime() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState({ userId: "", hours: "", note: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const summary = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          records: acc.records + 1,
          employees: acc.employeeIds.add(String(row.user?._id || row.user)).size,
          hours: acc.hours + Number(row.hours || 0),
          amount: acc.amount + Number(row.amount || 0),
          employeeIds: acc.employeeIds,
        }),
        { records: 0, employees: 0, hours: 0, amount: 0, employeeIds: new Set() }
      ),
    [rows]
  );

  const load = async () => {
    try {
      setError("");
      const [overtimeRows, userRows] = await Promise.all([api.getAdminOvertime({ month, year }), api.getAdminUsers()]);
      setRows(overtimeRows);
      setUsers(userRows.filter((user) => user.role === "user"));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [month, year]);

  const openCreate = () => {
    setEditingRecord(null);
    setForm({ userId: users[0]?._id || "", hours: "", note: "" });
    setError("");
    setMessage("");
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setForm({
      userId: record.user?._id || "",
      hours: String(record.hours || ""),
      note: record.note || "",
    });
    setError("");
    setMessage("");
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      setError("");
      setMessage("");
      const payload = { ...form, month, year, hours: Number(form.hours) };
      if (editingRecord) {
        await api.updateAdminOvertime(editingRecord._id, payload);
      } else {
        await api.createAdminOvertime(payload);
      }
      setOpen(false);
      setEditingRecord(null);
      setMessage(editingRecord ? "Đã cập nhật tăng ca." : "Đã ghi nhận tăng ca.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Xoá dòng tăng ca này?")) return;
    try {
      setError("");
      setMessage("");
      await api.deleteAdminOvertime(id);
      setMessage("Đã xoá tăng ca.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tăng ca</p>
          <h1>Quản lý tăng ca</h1>
        </div>
        <button className="button primary" type="button" onClick={openCreate}>
          Thêm tăng ca
        </button>
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
      </div>

      <div className="stats-grid">
        <article className="stat-card"><div className="stat-icon blue"><ReceiptText size={22} /></div><div><span>Dòng tăng ca</span><strong>{formatNumber(summary.records)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon slate"><Users size={22} /></div><div><span>Nhân viên</span><strong>{formatNumber(summary.employees)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon amber"><Clock3 size={22} /></div><div><span>Tổng giờ</span><strong>{formatNumber(summary.hours)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon green"><Plus size={22} /></div><div><span>Cộng lương</span><strong>{formatCurrency(summary.amount)}</strong></div></article>
      </div>

      <div className="task-board-grid">
        {rows.length === 0 && <div className="panel task-board-empty">Chưa có tăng ca trong tháng này.</div>}
        {rows.map((row) => (
          <article className="task-board-card" key={row._id}>
            <div className="task-board-card-header">
              <div>
                <span>Nhân viên</span>
                <strong>{row.user?.name || "Nhân viên"}</strong>
              </div>
              <div className="row-actions">
                <button className="button small ghost" type="button" onClick={() => openEdit(row)}>
                  Sửa
                </button>
                <button className="button small danger" type="button" onClick={() => remove(row._id)}>
                  Xoá
                </button>
              </div>
            </div>

            <div className="task-board-fields">
              <div>
                <span>Số giờ</span>
                <strong>{formatNumber(row.hours)}</strong>
              </div>
              <div>
                <span>Đơn giá</span>
                <strong>{formatCurrency(row.hourlyRate)}</strong>
              </div>
              <div>
                <span>Cộng lương</span>
                <strong>{formatCurrency(row.amount)}</strong>
              </div>
              <div>
                <span>Ghi chú</span>
                <p>{row.note || "-"}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {open && (
        <Modal title={editingRecord ? "Sửa tăng ca" : "Thêm tăng ca"} onClose={() => setOpen(false)}>
          <form className="product-form compact-form" onSubmit={submit}>
            <label className="field">
              <span>Nhân viên tăng ca</span>
              <select value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} required>
                <option value="">Chọn nhân viên</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>{user.name} - {user.email}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Số giờ tăng ca</span>
              <input type="number" min="0.5" step="0.5" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} required />
            </label>
            <label className="field">
              <span>Ghi chú</span>
              <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </label>
            <button className="button primary">{editingRecord ? "Lưu thay đổi" : "Lưu tăng ca"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
