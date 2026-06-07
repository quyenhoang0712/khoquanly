import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import Modal from "../../components/Modal";
import { assetUrl, formatCurrency } from "../../utils/workforce";

const initialForm = {
  name: "",
  email: "",
  password: "",
  position: "warehouse",
  hourlyRate: 30000,
};

const positionLabels = {
  warehouse: "Nhân viên kho",
  sale: "Nhân viên sale",
};

export default function AdminEmployees() {
  const [rows, setRows] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

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
    return rows.filter((user) => `${user.name} ${user.email} ${positionLabels[user.position || "warehouse"]}`.toLowerCase().includes(value));
  }, [keyword, rows]);

  const groupedRows = useMemo(
    () => [
      {
        key: "sale",
        title: "Nhân viên sale",
        rows: filteredRows.filter((user) => user.position === "sale"),
      },
      {
        key: "warehouse",
        title: "Nhân viên kho",
        rows: filteredRows.filter((user) => (user.position || "warehouse") === "warehouse"),
      },
    ],
    [filteredRows]
  );

  const submit = async (event) => {
    event.preventDefault();
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setLoading(true);
      setError("");
      setMessage("");
      if (editingUser) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.updateAdminUser(editingUser._id, payload);
        setMessage("Đã ghi nhận.");
      } else {
        const created = await api.createAdminUser(form);
        setMessage(
          created.emailDelivery?.sent
            ? "Đã tạo nhân sự và gửi thông tin đăng nhập qua email."
            : created.emailDelivery?.queued
              ? "Đã tạo nhân sự. Email thông tin đăng nhập đang được gửi."
            : `Đã tạo nhân sự nhưng chưa gửi được email. ${created.emailDelivery?.reason || "Vui lòng kiểm tra cấu hình SMTP."}`
        );
      }
      setOpen(false);
      setEditingUser(null);
      setForm(initialForm);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(initialForm);
    setError("");
    setMessage("");
    setOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      position: user.position || "warehouse",
      hourlyRate: user.hourlyRate || 30000,
    });
    setError("");
    setMessage("");
    setOpen(true);
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Xoá nhân sự ${user.name}? Tất cả lịch làm, đăng ký lịch, checkout, lương, tăng ca, phí dịch vụ, báo cáo và phân công liên quan sẽ bị xoá khỏi database.`)) return;
    try {
      setError("");
      setMessage("");
      await api.deleteAdminUser(user._id);
      setMessage("Đã xoá nhân sự và toàn bộ dữ liệu liên quan.");
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Nhân sự</p>
          <h1>Quản lý nhân sự</h1>
        </div>
        <button className="button primary" type="button" onClick={openCreate}>
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
          <div className="stat-icon green">K</div>
          <div>
            <span>Nhân viên kho</span>
            <strong>{rows.filter((user) => (user.position || "warehouse") === "warehouse").length}</strong>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-icon amber">S</div>
          <div>
            <span>Nhân viên sale</span>
            <strong>{rows.filter((user) => user.position === "sale").length}</strong>
          </div>
        </article>
      </div>

      <div className="toolbar compact-filter search-filter">
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo tên hoặc email..." />
      </div>

      <div className="employee-section-list">
        {filteredRows.length === 0 && <div className="panel task-board-empty">Chưa có nhân sự.</div>}
        {groupedRows.map((group) => (
          <section className="employee-section" key={group.key}>
            <div className="employee-section-header">
              <h2>{group.title}</h2>
              <span>{group.rows.length} nhân sự</span>
            </div>
            {group.rows.length === 0 ? (
              <div className="panel task-board-empty employee-empty">Chưa có {group.title.toLowerCase()}.</div>
            ) : (
              <div className="task-board-grid employee-card-grid">
                {group.rows.map((user) => (
                  <article className="task-board-card employee-card" key={user._id}>
                    <div className="task-board-card-header">
                      <div className="employee-card-title">
                        <span className="employee-avatar">
                          {user.avatar ? <img src={assetUrl(user.avatar)} alt={user.name || "avatar"} /> : user.name?.slice(0, 1)?.toUpperCase() || "N"}
                        </span>
                        <div>
                          <span>Nhân viên</span>
                          <strong>{user.name}</strong>
                        </div>
                      </div>
                      <div className="row-actions">
                        <button className="button small ghost" type="button" onClick={() => openEdit(user)}>
                          Sửa
                        </button>
                        <button className="button small danger" type="button" onClick={() => deleteUser(user)}>
                          Xoá
                        </button>
                      </div>
                    </div>

                    <div className="task-board-fields">
                      <div>
                        <span>Email</span>
                        <strong>{user.email}</strong>
                      </div>
                      <div>
                        <span>Chức vụ</span>
                        <strong>{positionLabels[user.position || "warehouse"]}</strong>
                      </div>
                      <div>
                        <span>Lương giờ</span>
                        <strong>{formatCurrency(user.hourlyRate)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {open && (
        <Modal title={editingUser ? "Sửa nhân sự" : "Tạo nhân sự"} onClose={() => setOpen(false)}>
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
              <span>Chức vụ</span>
              <select value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })}>
                <option value="warehouse">Nhân viên kho</option>
                <option value="sale">Nhân viên sale</option>
              </select>
            </label>
            <label className="field">
              <span>{editingUser ? "Mật khẩu mới" : "Mật khẩu"}</span>
              <input
                type="password"
                minLength={6}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder={editingUser ? "Bỏ trống nếu không đổi" : "Tối thiểu 6 ký tự"}
                required={!editingUser}
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
              {loading ? "Đang lưu..." : editingUser ? "Lưu thay đổi" : "Tạo nhân sự"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
