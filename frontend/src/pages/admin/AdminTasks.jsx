import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatDate, statusLabels, today } from "../../utils/workforce";

export default function AdminTasks() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", date: today(), assignedTo: [] });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadTasks = async () => {
    try {
      setError("");
      setRows(await api.getAdminTasks({ date }));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    api
      .getAdminUsers()
      .then((items) => setUsers(items.filter((item) => item.role === "user")))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadTasks();
  }, [date]);

  const toggleUser = (userId) => {
    setForm((current) => ({
      ...current,
      assignedTo: current.assignedTo.includes(userId)
        ? current.assignedTo.filter((id) => id !== userId)
        : [...current.assignedTo, userId],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      setError("");
      await api.createAdminTask(form);
      setOpen(false);
      setMessage("Đã giao việc.");
      setForm({ title: "", description: "", date: today(), assignedTo: [] });
      loadTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Công việc</p>
          <h1>Giao việc trong ngày</h1>
        </div>
        <button className="button primary" type="button" onClick={() => setOpen(true)}>
          Tạo công việc
        </button>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

      <div className="toolbar">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      <div className="panel table-wrap mobile-card-table">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Tiêu đề</th>
              <th>Nhân viên</th>
              <th>Trạng thái</th>
              <th>Mô tả</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5} />}
            {rows.map((row) => (
              <tr key={row._id}>
                <td data-label="Ngày">{formatDate(row.date)}</td>
                <td data-label="Tiêu đề">{row.title || "-"}</td>
                <td data-label="Nhân viên">{row.assignedTo?.map((user) => user?.name || user?.email || "Nhân viên").join(", ") || "-"}</td>
                <td data-label="Trạng thái">
                  <div className="status-stack">
                    {(row.statusByUser || []).map((item, index) => (
                      <span className="status-with-name" key={item._id || `${row._id}-${index}`}>
                        {item.user?.name && <small>{item.user.name}</small>}
                        <StatusBadge status={statusLabels[item.status] || item.status || "not-started"} />
                      </span>
                    ))}
                  </div>
                </td>
                <td data-label="Mô tả">{row.description || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title="Tạo công việc" onClose={() => setOpen(false)}>
          <form className="product-form compact-form" onSubmit={submit}>
            <label className="field">
              <span>Tiêu đề</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </label>
            <label className="field">
              <span>Ngày</span>
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
            </label>
            <div className="field">
              <span>Nhân viên nhận việc</span>
              <div className="employee-picker">
                {users.map((user) => (
                  <label className={`employee-chip ${form.assignedTo.includes(user._id) ? "active" : ""}`} key={user._id}>
                    <input type="checkbox" checked={form.assignedTo.includes(user._id)} onChange={() => toggleUser(user._id)} />
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </label>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Mô tả</span>
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <button className="button primary">Giao việc</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
