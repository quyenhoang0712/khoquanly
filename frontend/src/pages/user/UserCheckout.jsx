import { useRef, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import { today } from "../../utils/workforce";

export default function UserCheckout() {
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("date", date);
      formData.append("note", note);
      files.forEach((file) => formData.append("images", file));

      await api.checkout(formData);
      setMessage("Checkout thành công.");
      setError("");
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
        </div>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

      <div className="panel form-panel">
        <form className="product-form" onSubmit={submit}>
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

          <button className="button primary" type="submit" disabled={submitting}>
            {submitting ? "Đang checkout..." : "Checkout"}
          </button>
        </form>
      </div>
    </section>
  );
}
