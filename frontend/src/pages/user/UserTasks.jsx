import { Camera, CheckCircle2, CircleDashed, ClipboardList, LoaderCircle, MapPin, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, authStorage } from "../../api";
import { Alert, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { formatDate, formatNumber, statusLabels, today } from "../../utils/workforce";

const MAX_REPORT_IMAGES = 6;

const reportStamp = (date = new Date()) =>
  `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)} at ${date.toLocaleTimeString("vi-VN", { hour12: false })}`;

const wrapText = (context, text, maxWidth) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines;
};

export default function UserTasks() {
  const currentUser = authStorage.getUser();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [status, setStatus] = useState("not-started");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [reportShots, setReportShots] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(new Date());
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const savingStatusRef = useRef(false);
  const submittingReportRef = useRef(false);

  const load = () => {
    api.getTodayTasks({ date }).then(setRows).catch((err) => setError(err.message));
  };

  useEffect(load, [date]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCaptureLoading(false);
  };

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  useEffect(() => () => stopCamera(), []);

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
    setReportShots([]);
    stopCamera();
    setError("");
    setMessage("");
  };

  const closeTask = () => {
    stopCamera();
    setSelectedTask(null);
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
      setReportShots([]);
      closeTask();
    } catch (err) {
      setError(err.message);
    } finally {
      submittingReportRef.current = false;
      setSubmittingReport(false);
    }
  };

  const readLocation = async () => {
    if (!navigator.geolocation) return "Không lấy được vị trí";

    setGeoStatus("Đang lấy vị trí...");
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 18000, maximumAge: 120000 });
      }).catch(
        () =>
          new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
          })
      );
      const { latitude, longitude } = position.coords;
      const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=vi`);
        const data = await response.json();
        const address = data.address || {};
        const lines = [
          address.road || data.name,
          address.suburb || address.city_district || address.town || address.city,
          address.city || address.state,
          address.country,
        ].filter(Boolean);
        const label = lines.length ? [...new Set(lines)].join(", ") : data.display_name || fallback;
        setGeoStatus(label);
        return label;
      } catch {
        setGeoStatus(fallback);
        return fallback;
      }
    } catch {
      const message = "Không lấy được vị trí - mở Safari/Chrome và bật quyền vị trí";
      setGeoStatus(message);
      return message;
    }
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt này không hỗ trợ camera.");
      return;
    }

    try {
      setError("");
      setCameraLoading(true);
      readLocation();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError("Không mở được camera. Hãy cấp quyền camera để chụp ảnh báo cáo.");
    } finally {
      setCameraLoading(false);
    }
  };

  const drawStampedPhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, width, height);

    const location = await readLocation();
    const stampLines = [reportStamp(new Date()), selectedTask?.title || "Báo cáo công việc", ...String(location).split(",").map((line) => line.trim()).filter(Boolean)];
    const fontSize = Math.max(26, Math.round(width * 0.04));
    const lineHeight = Math.round(fontSize * 1.2);
    const padding = Math.round(width * 0.04);
    const maxTextWidth = Math.round(width * 0.72);

    context.textAlign = "right";
    context.textBaseline = "top";
    context.font = `600 ${fontSize}px Arial, sans-serif`;

    const lines = stampLines.flatMap((line) => wrapText(context, line, maxTextWidth));
    const blockHeight = lines.length * lineHeight;
    const x = width - padding;
    const y = Math.max(padding, Math.round((height - blockHeight) * 0.16));

    lines.forEach((line, index) => {
      const lineY = y + index * lineHeight;
      context.lineWidth = Math.max(4, Math.round(fontSize * 0.12));
      context.strokeStyle = "rgba(15, 23, 42, 0.45)";
      context.strokeText(line, x, lineY);
      context.fillStyle = "rgba(255, 255, 255, 0.94)";
      context.fillText(line, x, lineY);
    });

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const fileName = `task-report-${Date.now()}.jpg`;
          resolve({
            file: new File([blob], fileName, { type: "image/jpeg" }),
            preview: canvas.toDataURL("image/jpeg", 0.86),
          });
        },
        "image/jpeg",
        0.9
      );
    });
  };

  const capturePhoto = async () => {
    if (files.length >= MAX_REPORT_IMAGES) {
      setError(`Chỉ được gửi tối đa ${MAX_REPORT_IMAGES} ảnh.`);
      return;
    }

    setCaptureLoading(true);
    const photo = await drawStampedPhoto();
    setCaptureLoading(false);
    if (!photo) {
      setError("Không chụp được ảnh. Hãy thử lại.");
      return;
    }

    setError("");
    setFiles((current) => [...current, photo.file].slice(0, MAX_REPORT_IMAGES));
    setReportShots((current) => [...current, { name: photo.file.name, preview: photo.preview }].slice(0, MAX_REPORT_IMAGES));
  };

  const removeFile = (index) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setReportShots((current) => current.filter((shot) => files[index]?.name !== shot.name));
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
        <Modal title={selectedTask.title} onClose={closeTask}>
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
              <div className="checkout-camera-actions">
                <button className="button primary" type="button" onClick={openCamera} disabled={cameraLoading || files.length >= MAX_REPORT_IMAGES}>
                  <Camera size={18} />
                  {cameraLoading ? "Đang mở camera..." : "Chụp ảnh báo cáo"}
                </button>
              </div>
              <canvas ref={canvasRef} className="checkout-canvas" />
              <div className="upload-box">
                <strong>{files.length ? `${files.length}/${MAX_REPORT_IMAGES} ảnh đã chụp` : "Chưa có ảnh báo cáo"}</strong>
                <small>Chỉ chụp trực tiếp bằng camera để tự đóng dấu ngày giờ và vị trí</small>
              </div>
              {reportShots.length > 0 && (
                <div className="checkout-captured-grid">
                  {reportShots.map((shot) => (
                    <img key={shot.name} src={shot.preview} alt="Ảnh báo cáo đã đóng dấu" />
                  ))}
                </div>
              )}
              {files.length > 0 && (
                <div className="selected-files">
                  {files.map((file, index) => (
                    <span key={`${file.name}-${file.size}`}>
                      {file.name}
                      <button type="button" onClick={() => removeFile(index)} aria-label={`Xóa ${file.name}`}>
                        <X size={12} />
                      </button>
                    </span>
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

      {cameraOpen && (
        <Modal title="Chụp ảnh báo cáo" onClose={stopCamera} className="checkout-camera-modal">
          <div className="checkout-camera-view checkout-camera-shutter">
            <video ref={videoRef} autoPlay playsInline muted />
            <div className="checkout-camera-time">{reportStamp(now)}</div>
            <div className="checkout-camera-badge">
              <MapPin size={16} />
              <span>{geoStatus || "Ảnh sẽ tự đóng dấu ngày giờ và vị trí"}</span>
            </div>
            <div className="checkout-shutter-hint">
              <Camera size={22} />
              <span>{captureLoading ? "Đang chụp..." : files.length >= MAX_REPORT_IMAGES ? `Đã đủ ${MAX_REPORT_IMAGES} ảnh` : "Bấm nút Chụp ảnh"}</span>
            </div>
          </div>
          <div className="checkout-camera-modal-actions">
            <button className="button primary" type="button" onClick={capturePhoto} disabled={captureLoading || files.length >= MAX_REPORT_IMAGES}>
              <Camera size={18} />
              {captureLoading ? "Đang chụp..." : "Chụp ảnh"}
            </button>
            <button className="button ghost" type="button" onClick={stopCamera}>
              <X size={18} />
              Đóng
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
