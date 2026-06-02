import { CheckCircle2, CircleDashed, ClipboardList, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, authStorage } from "../../api";
import { Alert, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatDate, formatNumber, statusLabels, today } from "../../utils/workforce";

export default function UserTasks() {
  const currentUser = authStorage.getUser();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [status, setStatus] = useState("not-started");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const savingStatusRef = useRef(false);
  const submittingReportRef = useRef(false);

  const load = () => {
    api.getTodayTasks({ date }).then(setRows).catch((err) => setError(err.message));
  };

  useEffect(load, [date]);

  const getUserId = (value) => String(value?._id || value?.id || value || "");
  const getStatus = (task) => {
    if (task.currentStatus) return task.currentStatus;
    const currentStatus = task.statusByUser?.find((item) => getUserId(item.user) === getUserId(currentUser));
    return currentStatus?.status || "not-started";
  };

  const summary = useMemo(() => {
    const statuses = rows.map(getStatus);
    return {
      total: statuses.length,
      notStarted: statuses.filter((item) => item === "not-started").length,
      inProgress: statuses.filter((item) => item === "in-progress").length,
      completed: statuses.filter((item) => item === "completed").length,
    };
  }, [rows]);

  const stats = [
    ["Tổng việc", summary.total, ClipboardList, "blue"],
    ["Chưa làm", summary.notStarted, CircleDashed, "slate"],
    ["Đang làm", summary.inProgress, LoaderCircle, "amber"],
    ["Đã xong", summary.completed, CheckCircle2, "green"],
  ];

  const replaceTask = (updatedTask) => {
    setRows((currentRows) => currentRows.map((row) => (row._id === updatedTask._id ? updatedTask : row)));
  };

  const taskWithStatus = (task, nextStatus) => ({
    ...task,
    currentStatus: nextStatus,
  });

  const openTask = (task) => {
    setSelectedTask(task);
    const taskStatus = getStatus(task);
    setStatus(taskStatus === "completed" ? "completed" : "in-progress");
    setContent("");
    setFiles([]);
    setError("");
    setMessage("");
  };

  const saveStatus = async () => {
    if (!selectedTask) return;
    if (savingStatusRef.current) return;
    savingStatusRef.current = true;
    setSavingStatus(true);
    try {
      setError("");
      setMessage("");
      const data = await api.updateTaskStatus(selectedTask._id, status);
      const updatedTask = taskWithStatus(data, status);
      setSelectedTask(updatedTask);
      replaceTask(updatedTask);
      setMessage("Đã ghi nhận.");
      setSelectedTask(null);
    } catch (err) {
      setError(err.message);
    } finally {
      savingStatusRef.current = false;
      setSavingStatus(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!selectedTask) return;
    if (submittingReportRef.current) return;
    submittingReportRef.current = true;
    setSubmittingReport(true);

    try {
      setError("");
      setMessage("");
      const formData = new FormData();
      formData.append("content", content);
      files.forEach((file) => formData.append("images", file));
      await api.submitTaskReport(selectedTask._id, formData);
      const data = await api.updateTaskStatus(selectedTask._id, status);
      const updatedTask = taskWithStatus(data, status);
      replaceTask(updatedTask);
      setMessage("Đã ghi nhận.");
      setContent("");
      setFiles([]);
      setSelectedTask(null);
    } catch (err) {
      setError(err.message);
    } finally {
      submittingReportRef.current = false;
      setSubmittingReport(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Công việc</p>
          <h1>Việc làm hôm nay</h1>
        </div>
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
        {rows.length === 0 && <div className="panel task-board-empty">Không có dữ liệu.</div>}
        {rows.map((row) => (
          <article className="task-board-card" key={row._id}>
            <div className="task-board-card-header">
              <div>
                <span>Ngày</span>
                <strong>{formatDate(row.date)}</strong>
              </div>
              <button className="button small ghost" type="button" onClick={() => openTask(row)}>Xem</button>
            </div>

            <div className="task-board-fields">
              <div>
                <span>Tiêu đề</span>
                <strong>{row.title}</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <StatusBadge status={statusLabels[getStatus(row)] || getStatus(row)} />
              </div>
              <div>
                <span>Mô tả</span>
                <p>{row.description || "-"}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {selectedTask && (
        <Modal title={selectedTask.title} onClose={() => setSelectedTask(null)}>
          <div className="task-modal-content">
          <div className="detail-grid compact">
            <div><span>Ngày</span><strong>{formatDate(selectedTask.date)}</strong></div>
            <div><span>Trạng thái</span><strong>{statusLabels[status] || status}</strong></div>
          </div>

          <div className="task-description-box">
            <span>Việc cụ thể hôm nay</span>
            <p>{selectedTask.description || "Chưa có mô tả chi tiết."}</p>
          </div>

          <label className="field">
            <span>Cập nhật trạng thái</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="in-progress">Đang làm</option>
              <option value="completed">Đã xong</option>
            </select>
          </label>
          <button className="button small ghost" type="button" onClick={saveStatus} disabled={savingStatus}>
            {savingStatus ? "Đang lưu..." : "Lưu trạng thái"}
          </button>

          <form className="product-form compact-form" onSubmit={submitReport}>
            <label className="field">
              <span>Nội dung báo cáo</span>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nhập nội dung đã làm..." required />
            </label>
            <label className="field upload-field">
              <span>Ảnh báo cáo</span>
              <input id="task-report-images" type="file" multiple accept="image/*" onChange={(event) => setFiles(Array.from(event.target.files))} />
              <label className="upload-box" htmlFor="task-report-images">
                <strong>Chọn ảnh báo cáo</strong>
                <small>{files.length ? `${files.length} ảnh đã chọn` : "PNG, JPG hoặc ảnh chụp màn hình"}</small>
              </label>
              {files.length > 0 && (
                <div className="selected-files">
                  {files.map((file) => (
                    <span key={`${file.name}-${file.size}`}>{file.name}</span>
                  ))}
                </div>
              )}
            </label>
            <button className="button primary" disabled={submittingReport}>
              {submittingReport ? "Đang gửi..." : "Gửi báo cáo"}
            </button>
          </form>
          </div>
        </Modal>
      )}
    </section>
  );
}
