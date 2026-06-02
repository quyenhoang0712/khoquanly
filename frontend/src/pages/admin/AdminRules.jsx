import { FileText, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import Modal from "../../components/Modal";

const emptyForm = { title: "", content: "", order: "", active: true };

export default function AdminRules() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setError("");
      setRows(await api.getAdminRules());
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingRule(null);
    setForm({ ...emptyForm, order: String((rows.at(-1)?.order || rows.length) + 1) });
    setError("");
    setMessage("");
    setOpen(true);
  };

  const openEdit = (rule) => {
    setEditingRule(rule);
    setForm({
      title: rule.title || "",
      content: rule.content || "",
      order: String(rule.order || ""),
      active: rule.active !== false,
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
      const payload = { ...form, order: Number(form.order || 0) };
      if (editingRule) {
        await api.updateAdminRule(editingRule._id, payload);
      } else {
        await api.createAdminRule(payload);
      }
      setOpen(false);
      setEditingRule(null);
      setMessage(editingRule ? "Đã cập nhật nội quy." : "Đã thêm nội quy.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Xoá nội quy này?")) return;
    try {
      setError("");
      setMessage("");
      await api.deleteAdminRule(id);
      setMessage("Đã xoá nội quy.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Quy định</p>
          <h1>Quản lý nội quy</h1>
          <p className="page-subtitle">Admin có thể thêm, sửa, ẩn hoặc xoá nội quy hiển thị cho nhân viên.</p>
        </div>
        <button className="button primary" type="button" onClick={openCreate}>
          <Plus size={18} />
          Thêm nội quy
        </button>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

      <div className="task-board-grid">
        {rows.length === 0 && <div className="panel task-board-empty">Chưa có nội quy.</div>}
        {rows.map((rule) => (
          <article className="task-board-card rules-admin-card" key={rule._id}>
            <div className="task-board-card-header">
              <div>
                <span>Thứ tự {rule.order || 0}</span>
                <strong><FileText size={18} /> {rule.title}</strong>
              </div>
              <span className={`badge ${rule.active === false ? "muted" : "success"}`}>
                {rule.active === false ? "Đang ẩn" : "Đang hiện"}
              </span>
            </div>
            <div className="task-board-fields">
              <div className="task-board-field-wide">
                <span>Nội dung</span>
                <p>{rule.content}</p>
              </div>
              <div className="task-board-field-wide">
                <span>Thao tác</span>
                <div className="row-actions">
                  <button className="button small ghost" type="button" onClick={() => openEdit(rule)}>Sửa</button>
                  <button className="button small danger" type="button" onClick={() => remove(rule._id)}>Xoá</button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {open && (
        <Modal title={editingRule ? "Sửa nội quy" : "Thêm nội quy"} onClose={() => setOpen(false)}>
          <form className="product-form compact-form" onSubmit={submit}>
            <label className="field">
              <span>Tiêu đề</span>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </label>
            <label className="field">
              <span>Thứ tự hiển thị</span>
              <input type="number" value={form.order} onChange={(event) => setForm({ ...form, order: event.target.value })} />
            </label>
            <label className="field">
              <span>Nội dung</span>
              <textarea rows={10} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required />
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              <span>Hiển thị cho nhân viên</span>
            </label>
            <button className="button primary">{editingRule ? "Lưu nội quy" : "Thêm nội quy"}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
