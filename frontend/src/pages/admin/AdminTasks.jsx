import { CheckCircle2, CircleDashed, ClipboardList, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { Alert, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { assetUrl, formatDate, formatNumber, statusLabels, today } from "../../utils/workforce";

export default function AdminTasks() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", date: today(), assignedTo: [] });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const summary = useMemo(() => {
    const statuses = rows.flatMap((row) => row.statusByUser?.map((item) => item.status || "not-started") || ["not-started"]);

    return {
      total: statuses.length,
      notStarted: statuses.filter((status) => status === "not-started").length,
      inProgress: statuses.filter((status) => status === "in-progress").length,
      completed: statuses.filter((status) => status === "completed").length,
    };
  }, [rows]);

  const stats = [
    ["Tổng việc", summary.total, ClipboardList, "blue"],
    ["Chưa làm", summary.notStarted, CircleDashed, "slate"],
    ["Đang làm", summary.inProgress, LoaderCircle, "amber"],
    ["Đã xong", summary.completed, CheckCircle2, "green"],
  ];

  const loadTasks = async () => {
    try {
      setError("");
      setRows(await api.getAdminTasks({ date }));
    } catch (err) {
      setError(err.message);
    }
  };

  const openDetail = async (taskId) => {
    try {
      setError("");
      setDetail(await api.getAdminTask(taskId));
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Xoá công việc này? Báo cáo liên quan cũng sẽ bị xoá.")) return;
    try {
      setError("");
      setMessage("");
      await api.deleteAdminTask(taskId);
      setMessage("Đã ghi nhận.");
      setDetail(null);
      loadTasks();
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
    const interval = window.setInterval(loadTasks, 5000);
    return () => window.clearInterval(interval);
  }, [date]);

  useEffect(() => {
    if (!detail?.task?._id) return undefined;
    const interval = window.setInterval(() => {
      api.getAdminTask(detail.task._id).then(setDetail).catch((err) => setError(err.message));
    }, 5000);
    return () => window.clearInterval(interval);
  }, [detail?.task?._id]);

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
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      setError("");
      setMessage("");
      await api.createAdminTask(form);
      setOpen(false);
      setMessage("Đã ghi nhận.");
      setForm({ title: "", description: "", date: today(), assignedTo: [] });
      loadTasks();
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
          <p className="eyebrow">Công việc</p>
          <h1>Giao việc trong ngày</h1>
        </div>
        <button className="button primary" type="button" onClick={() => setOpen(true)}>
          Tạo công việc
        </button>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

      <div className="stats-grid">
        {stats.map(([label, value, Icon, tone]) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}>
              <Icon size={22} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{formatNumber(value || 0)}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="toolbar date-filter">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      <div className="task-board-grid">
        {rows.length === 0 && (
          <div className="panel task-board-empty">
            Không có dữ liệu.
          </div>
        )}
        {rows.map((row) => (
          <article className="task-board-card" key={row._id}>
            <div className="task-board-card-header">
              <div>
                <span>Ngày</span>
                <strong>{formatDate(row.date)}</strong>
              </div>
              <div className="row-actions">
                <button className="button small ghost" type="button" onClick={() => openDetail(row._id)}>Xem</button>
                <button className="button small danger" type="button" onClick={() => deleteTask(row._id)}>Xoá</button>
              </div>
            </div>

            <div className="task-board-fields">
              <div>
                <span>Tiêu đề</span>
                <strong>{row.title || "-"}</strong>
              </div>
              <div>
                <span>Nhân viên</span>
                <strong>{row.assignedTo?.map((user) => user?.name || user?.email || "Nhân viên").join(", ") || "-"}</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <div className="status-stack">
                  {(row.statusByUser || []).map((item, index) => (
                    <span className="status-with-name" key={item._id || `${row._id}-${index}`}>
                      <StatusBadge status={statusLabels[item.status] || item.status || "not-started"} />
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span>Mô tả</span>
                <p>{row.description || "-"}</p>
              </div>
            </div>
          </article>
        ))}
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
            <button className="button primary" disabled={submitting}>
              {submitting ? "Đang giao..." : "Giao việc"}
            </button>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Chi tiết công việc - ${detail.task?.title || "Công việc"}`} onClose={() => setDetail(null)}>
          <div className="task-modal-content">
            <div className="detail-grid compact">
              <div><span>Ngày</span><strong>{formatDate(detail.task?.date)}</strong></div>
              <div><span>Nhân viên</span><strong>{detail.task?.assignedTo?.map((user) => user.name || user.email).join(", ") || "-"}</strong></div>
            </div>

            <div className="task-description-box">
              <span>Mô tả công việc</span>
              <p>{detail.task?.description || "Không có mô tả."}</p>
            </div>

            <div className="task-description-box">
              <span>Trạng thái từng nhân viên</span>
              <div className="status-stack">
                {(detail.task?.statusByUser || []).map((item, index) => (
                  <span className="status-with-name" key={item._id || index}>
                    <small>{item.user?.name || item.user?.email || "Nhân viên"}</small>
                    <StatusBadge status={statusLabels[item.status] || item.status || "not-started"} />
                  </span>
                ))}
              </div>
            </div>

            <div className="task-description-box">
              <span>Báo cáo đã gửi</span>
              {!detail.reports?.length && <p>Chưa có báo cáo.</p>}
              {detail.reports?.map((report) => (
                <div className="task-report-card" key={report._id}>
                  <strong>{report.user?.name || "Nhân viên"}</strong>
                  <p>{report.content}</p>
                  {report.images?.length > 0 && (
                    <div className="image-list">
                      {report.images.map((image) => (
                        <a key={image} href={assetUrl(image)} target="_blank" rel="noreferrer">
                          <img src={assetUrl(image)} alt="report" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button className="button danger" type="button" onClick={() => deleteTask(detail.task?._id)}>Xoá công việc</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
