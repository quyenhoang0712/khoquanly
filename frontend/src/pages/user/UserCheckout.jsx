import { useEffect, useMemo, useRef, useState } from "react";
import { api, authStorage } from "../../api";
import { Alert } from "../../components/DataState";
import { shiftEndDateTime, shiftLabels, shiftTimeLabel, today } from "../../utils/workforce";

export default function UserCheckout() {
  const currentUser = authStorage.getUser();
  const position = currentUser?.position || "warehouse";
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [schedule, setSchedule] = useState([]);
  const [now, setNow] = useState(new Date());
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    api.getMySchedule({ date }).then(setSchedule).catch((err) => setError(err.message));
  }, [date]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const checkoutWindow = useMemo(() => {
    const scheduledShifts = schedule.filter((item) => item.status === "scheduled");
    const latestEnd = scheduledShifts
      .map((item) => shiftEndDateTime(date, position, item.shift))
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (!latestEnd) return null;
    return {
      endAt: latestEnd,
      openAt: new Date(latestEnd.getTime() - 10 * 60 * 1000),
      shifts: scheduledShifts,
    };
  }, [date, position, schedule]);

  const isToday = date === today();
  const canCheckout = Boolean(isToday && checkoutWindow && now >= checkoutWindow.openAt);
  const checkoutHint = !isToday
    ? "Chỉ được checkout cho ngày hôm nay."
    : !checkoutWindow
      ? "Bạn không có lịch làm hôm nay."
      : canCheckout
        ? "Đã tới giờ checkout."
        : `Chỉ được checkout từ ${checkoutWindow.openAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`;

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
          <p className="page-subtitle">Chỉ được checkout trong 10 phút trước giờ kết ca theo bộ phận của bạn.</p>
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
              <strong>
                {checkoutWindow?.shifts?.length
                  ? checkoutWindow.shifts.map((item) => `${shiftLabels[item.shift]} ${shiftTimeLabel(position, item.shift)}`).join(", ")
                  : "Không có lịch"}
              </strong>
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
            <input
              id="checkout-images"
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => setFiles(Array.from(event.target.files))}
            />
            <label className="upload-box" htmlFor="checkout-images">
              <strong>Chọn ảnh checkout</strong>
              <small>{files.length ? `${files.length} ảnh đã chọn` : "Ảnh khu vực, ảnh bàn giao hoặc ảnh cuối ca"}</small>
            </label>
            {files.length > 0 && (
              <div className="selected-files">
                {files.map((file) => (
                  <span key={`${file.name}-${file.size}`}>{file.name}</span>
                ))}
              </div>
            )}
          </label>

          <button className="button primary" type="submit" disabled={submitting || !canCheckout}>
            {submitting ? "Đang checkout..." : "Checkout"}
          </button>
        </form>
      </div>
    </section>
  );
}
