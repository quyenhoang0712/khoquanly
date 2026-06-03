import { Clock3, Plus, ReceiptText, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { Alert, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatCurrency, formatDate, formatNumber } from "../../utils/workforce";

export default function AdminOvertime() {
  const now = new Date();
  const [searchParams] = useSearchParams();
  const [month, setMonth] = useState(Number(searchParams.get("month")) || now.getMonth() + 1);
  const [year, setYear] = useState(Number(searchParams.get("year")) || now.getFullYear());
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") === "pending" ? "pending" : "");
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
          pending: acc.pending + (row.status === "pending" ? 1 : 0),
          employees: acc.employeeIds.add(String(row.user?._id || row.user)).size,
          hours: acc.hours + (row.status === "approved" || !row.status ? Number(row.hours || 0) : 0),
          amount: acc.amount + (row.status === "approved" || !row.status ? Number(row.amount || 0) : 0),
          employeeIds: acc.employeeIds,
        }),
        { records: 0, pending: 0, employees: 0, hours: 0, amount: 0, employeeIds: new Set() }
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
    setForm({ userId: users[0]?._id || "", date: "", hours: "", note: "" });
    setError("");
    setMessage("");
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setForm({
      userId: record.user?._id || "",
      date: record.date || "",
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

  const review = async (record, action) => {
    const adminNote = action === "rejected" ? window.prompt("Lý do từ chối phiếu tăng ca?", "") || "" : "";
    try {
      setError("");
      setMessage("");
      await api.reviewAdminOvertime(record._id, { action, adminNote });
      setMessage(action === "approved" ? "Đã duyệt tăng ca." : "Đã từ chối tăng ca.");
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
          <h1>Duyệt tăng ca</h1>
          <p className="page-subtitle">Duyệt phiếu tăng ca nhân viên gửi để cộng vào bảng lương.</p>
        </div>
        <button className="button primary" type="button" onClick={openCreate}>
          Thêm tay
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
        <label className="field inline-field">
          <span>Trạng thái</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Tất cả</option>
            <option value="pending">Chờ duyệt</option>
          </select>
        </label>
      </div>

      <div className="stats-grid">
        <article className="stat-card"><div className="stat-icon blue"><ReceiptText size={22} /></div><div><span>Dòng tăng ca</span><strong>{formatNumber(summary.records)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon amber"><ReceiptText size={22} /></div><div><span>Chờ duyệt</span><strong>{formatNumber(summary.pending)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon slate"><Users size={22} /></div><div><span>Nhân viên</span><strong>{formatNumber(summary.employees)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon purple"><Clock3 size={22} /></div><div><span>Giờ đã duyệt</span><strong>{formatNumber(summary.hours)}</strong></div></article>
        <article className="stat-card"><div className="stat-icon green"><Plus size={22} /></div><div><span>Cộng lương</span><strong>{formatCurrency(summary.amount)}</strong></div></article>
      </div>

      <div className="task-board-grid">
        {visibleRows.length === 0 && <div className="panel task-board-empty">Chưa có tăng ca trong tháng này.</div>}
        {visibleRows.map((row) => (
          <article className="task-board-card" key={row._id}>
            <div className="task-board-card-header">
              <div>
                <span>Nhân viên</span>
                <strong>{row.user?.name || "Nhân viên"}</strong>
              </div>
              <StatusBadge status={row.status || "approved"} />
              <div className="row-actions">
                {row.status === "pending" && (
                  <>
                    <button className="button small primary" type="button" onClick={() => review(row, "approved")}>
                      Duyệt
                    </button>
                    <button className="button small danger" type="button" onClick={() => review(row, "rejected")}>
                      Từ chối
                    </button>
                  </>
                )}
                <button className="button small ghost" type="button" onClick={() => openEdit(row)}>
                  Sửa
                </button>
              </div>
            </div>

            <div className="task-board-fields">
              <div>
                <span>Ngày tăng ca</span>
                <strong>{row.date ? formatDate(row.date) : "-"}</strong>
              </div>
              <div>
                <span>Số giờ</span>
                <strong>{formatNumber(row.hours)} giờ</strong>
              </div>
              <div>
                <span>Đơn giá</span>
                <strong>{formatCurrency(row.hourlyRate)}</strong>
              </div>
              <div>
                <span>Cộng lương</span>
                <strong>{row.status === "rejected" ? "-" : formatCurrency(row.amount)}</strong>
              </div>
              <div>
                <span>Ghi chú</span>
                <p>{row.note || "-"}</p>
              </div>
              <div>
                <span>Phản hồi admin</span>
                <p>{row.adminNote || "-"}</p>
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
              <span>Ngày tăng ca</span>
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
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
