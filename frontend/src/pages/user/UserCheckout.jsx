import { Camera, MapPin, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, authStorage } from "../../api";
import { Alert } from "../../components/DataState";
import Modal from "../../components/Modal";
import { shiftLabels, shiftTimeLabel, today } from "../../utils/workforce";

const MAX_IMAGES = 6;

const checkoutStamp = (date = new Date()) =>
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

export default function UserCheckout() {
  const currentUser = authStorage.getUser();
  const position = currentUser?.position || "warehouse";
  const [searchParams] = useSearchParams();
  const [note, setNote] = useState("");
  const [date, setDate] = useState(searchParams.get("date") || today());
  const [schedule, setSchedule] = useState([]);
  const [now, setNow] = useState(new Date());
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState("");
  const [cameraShots, setCameraShots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const submittingRef = useRef(false);

  const stopCamera = () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCaptureLoading(false);
  };

  useEffect(() => {
    api.getMySchedule({ date }).then(setSchedule).catch((err) => setError(err.message));
  }, [date]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  useEffect(() => () => stopCamera(), []);

  const scheduledShifts = useMemo(() => {
    return schedule.filter((item) => item.status === "scheduled");
  }, [schedule]);

  const todayShiftLabel = useMemo(() => {
    return scheduledShifts.length
      ? scheduledShifts.map((item) => `${shiftLabels[item.shift]} ${shiftTimeLabel(position, item.shift)}`).join(", ")
      : "Không có lịch";
  }, [position, scheduledShifts]);

  const isToday = date === today();
  const canCheckout = isToday;
  const checkoutHint = !isToday
    ? "Chỉ được checkout cho ngày hôm nay."
    : "Có thể checkout để test.";

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
      setError("Trình duyệt này không hỗ trợ camera. Bạn có thể chọn ảnh từ máy.");
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
      setError("Không mở được camera. Hãy cấp quyền camera trong trình duyệt.");
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
    const stampLines = [checkoutStamp(new Date()), ...String(location).split(",").map((line) => line.trim()).filter(Boolean)];
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
    const y = Math.max(padding, Math.round((height - blockHeight) * 0.18));

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
          const fileName = `checkout-${Date.now()}.jpg`;
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
    if (files.length >= MAX_IMAGES) {
      setError(`Chỉ được gửi tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }

    setCaptureLoading(true);
    const photo = await drawStampedPhoto();
    setCaptureLoading(false);
    if (!photo) {
      setError("Không chụp được ảnh. Hãy thử lại hoặc chọn ảnh từ máy.");
      return;
    }

    setError("");
    setFiles((current) => [...current, photo.file].slice(0, MAX_IMAGES));
    setCameraShots((current) => [...current, { name: photo.file.name, preview: photo.preview }].slice(0, MAX_IMAGES));
  };

  const removeFile = (index) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setCameraShots((current) => current.filter((shot) => files[index]?.name !== shot.name));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!canCheckout) {
      setError(checkoutHint);
      setMessage("");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      setError("");
      setMessage("");
      const formData = new FormData();
      formData.append("date", date);
      formData.append("note", note);
      files.forEach((file) => formData.append("images", file));

      await api.checkout(formData);
      setMessage("Đã ghi nhận.");
      setFiles([]);
      setCameraShots([]);
    } catch (err) {
      setError(err.message);
      setMessage("");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Cuối ngày</p>
          <h1>Checkout</h1>
        </div>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

      <div className="panel form-panel">
        <form className="product-form" onSubmit={submit}>
          <div className="checkout-rule-box">
            <div>
              <span>Bộ phận</span>
              <strong>{position === "sale" ? "Sale" : "Kho"}</strong>
            </div>
            <div>
              <span>Ca hôm nay</span>
              <strong>{todayShiftLabel}</strong>
            </div>
            <div>
              <span>Trạng thái checkout</span>
              <strong>{checkoutHint}</strong>
            </div>
          </div>

          <label className="field">
            <span>Ngày</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>

          <label className="field">
            <span>Ghi chú</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú cuối ca..." />
          </label>

          <label className="field upload-field">
            <span>Ảnh checkout</span>
            <div className="checkout-camera-actions">
              <button className="button primary" type="button" onClick={openCamera} disabled={cameraLoading || files.length >= MAX_IMAGES}>
                <Camera size={18} />
                {cameraLoading ? "Đang mở camera..." : "Chụp bằng camera"}
              </button>
            </div>
            <canvas ref={canvasRef} className="checkout-canvas" />

            <div className="upload-box">
              <strong>{files.length ? `${files.length}/${MAX_IMAGES} ảnh đã chọn` : "Chưa có ảnh checkout"}</strong>
              <small>Chỉ chụp trực tiếp bằng camera để tự đóng dấu ngày giờ và vị trí</small>
            </div>

            {cameraShots.length > 0 && (
              <div className="checkout-captured-grid">
                {cameraShots.map((shot) => (
                  <img key={shot.name} src={shot.preview} alt="Ảnh checkout đã đóng dấu" />
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

          <button className="button primary" type="submit" disabled={submitting || !canCheckout}>
            {submitting ? "Đang checkout..." : "Checkout"}
          </button>
        </form>
      </div>

      {cameraOpen && (
        <Modal title="Chụp ảnh checkout" onClose={stopCamera} className="checkout-camera-modal">
          <div className="checkout-camera-view checkout-camera-shutter">
            <video ref={videoRef} autoPlay playsInline muted />
            <div className="checkout-camera-time">{checkoutStamp(now)}</div>
            <div className="checkout-camera-badge">
              <MapPin size={16} />
              <span>{geoStatus || "Ảnh sẽ tự đóng dấu ngày giờ và vị trí"}</span>
            </div>
            <div className="checkout-shutter-hint">
              <Camera size={22} />
              <span>{captureLoading ? "Đang chụp..." : files.length >= MAX_IMAGES ? `Đã đủ ${MAX_IMAGES} ảnh` : "Bấm nút Chụp ảnh"}</span>
            </div>
          </div>
          <div className="checkout-camera-modal-actions">
            <button className="button primary" type="button" onClick={capturePhoto} disabled={captureLoading || files.length >= MAX_IMAGES}>
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
