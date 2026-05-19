import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatCurrency } from "../../utils/workforce";

const initialForm = {
  name: "",
  email: "",
  password: "",
  hourlyRate: 30000,
};

export default function AdminEmployees() {
  const [rows, setRows] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    try {
      setError("");
      const users = await api.getAdminUsers();
      setRows(users.filter((user) => user.role === "user"));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredRows = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(value));
  }, [keyword, rows]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await api.createAdminUser(form);
      setOpen(false);
      setForm(initialForm);
      setMessage("Đã tạo nhân sự mới.");
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Nhân sự</p>
          <h1>Quản lý nhân sự</h1>
        </div>
        <button className="button primary" type="button" onClick={() => setOpen(true)}>
          Tạo nhân sự
        </button>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-icon slate">NS</div>
          <div>
            <span>Tổng nhân sự</span>
            <strong>{rows.length}</strong>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon green">OK</div>
          <div>
            <span>Đang hoạt động</span>
            <strong>{rows.filter((user) => user.active).length}</strong>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon amber">₫</div>
          <div>
            <span>Lương giờ mặc định</span>
            <strong>{formatCurrency(30000)}</strong>
          </div>
        </article>
      </div>

      <div className="toolbar">
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo tên hoặc email..." />
      </div>

      <div className="panel table-wrap mobile-card-table">
        <table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Lương giờ</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && <EmptyRow colSpan={5}>Chưa có nhân sự.</EmptyRow>}
            {filteredRows.map((user) => (
              <tr key={user._id}>
                <td data-label="Nhân viên">
                  <div className="employee-cell">
                    <span>{user.name?.slice(0, 1)?.toUpperCase() || "N"}</span>
                    <strong>{user.name}</strong>
                  </div>
                </td>
                <td data-label="Email">{user.email}</td>
                <td data-label="Vai trò">Nhân viên</td>
                <td data-label="Lương giờ">{formatCurrency(user.hourlyRate)}</td>
                <td data-label="Trạng thái">
                  <StatusBadge status={user.active ? "approved" : "rejected"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title="Tạo nhân sự" onClose={() => setOpen(false)}>
          <form className="product-form compact-form" onSubmit={submit}>
            <label className="field">
              <span>Họ tên</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Nguyễn Văn An" required />
            </label>
            <label className="field">
              <span>Email đăng nhập</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="nhanvien@company.com"
                required
              />
            </label>
            <label className="field">
              <span>Mật khẩu</span>
              <input
                type="password"
                minLength={6}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Tối thiểu 6 ký tự"
                required
              />
            </label>
            <label className="field">
              <span>Lương theo giờ</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.hourlyRate}
                onChange={(event) => setForm({ ...form, hourlyRate: Number(event.target.value) })}
                required
              />
            </label>
            <button className="button primary" disabled={loading}>
              {loading ? "Đang tạo..." : "Tạo nhân sự"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
