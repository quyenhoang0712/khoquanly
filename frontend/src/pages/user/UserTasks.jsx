import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatDate, statusLabels, today } from "../../utils/workforce";

export default function UserTasks() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [status, setStatus] = useState("not-started");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    api.getTodayTasks({ date }).then(setRows).catch((err) => setError(err.message));
  };

  useEffect(load, [date]);

  const getStatus = (task) => task.statusByUser?.[0]?.status || "not-started";

  const openTask = (task) => {
    setSelectedTask(task);
    setStatus(getStatus(task));
    setContent("");
    setFiles([]);
    setError("");
    setMessage("");
  };

  const saveStatus = async () => {
    if (!selectedTask) return;
    try {
      const data = await api.updateTaskStatus(selectedTask._id, status);
      setSelectedTask(data);
      setMessage("Đã cập nhật trạng thái.");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!selectedTask) return;

    try {
      const formData = new FormData();
      formData.append("content", content);
      files.forEach((file) => formData.append("images", file));
      await api.submitTaskReport(selectedTask._id, formData);
      if (status !== "completed") await api.updateTaskStatus(selectedTask._id, "completed");
      setMessage("Đã gửi ảnh báo cáo và hoàn thành công việc.");
      setStatus("completed");
      setContent("");
      setFiles([]);
      load();
    } catch (err) {
      setError(err.message);
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
      <div className="toolbar">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <div className="panel table-wrap mobile-card-table">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Công việc</th>
              <th>Mô tả ngắn</th>
              <th>Trạng thái</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5} />}
            {rows.map((row) => (
              <tr key={row._id}>
                <td data-label="Ngày">{formatDate(row.date)}</td>
                <td data-label="Công việc">{row.title}</td>
                <td data-label="Mô tả">{row.description || "-"}</td>
                <td data-label="Trạng thái"><StatusBadge status={statusLabels[getStatus(row)] || getStatus(row)} /></td>
                <td data-label="Chi tiết"><button className="button small ghost" type="button" onClick={() => openTask(row)}>Xem việc</button></td>
              </tr>
            ))}
          </tbody>
        </table>
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
              <option value="not-started">Chưa làm</option>
              <option value="in-progress">Đang làm</option>
              <option value="completed">Đã xong</option>
            </select>
          </label>
          <button className="button small ghost" type="button" onClick={saveStatus}>Lưu trạng thái</button>

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
            <button className="button primary">Gửi báo cáo</button>
          </form>
          </div>
        </Modal>
      )}
    </section>
  );
}
