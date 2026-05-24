import { useRef, useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import { shiftLabels } from "../../utils/workforce";

export default function UserLeaveRequest() {
  const [form, setForm] = useState({ date: "", shift: "full-day", reason: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api.createLeaveRequest(form);
      setMessage("Đã ghi nhận.");
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return <section className="page"><div className="page-header"><div><p className="eyebrow">Phiếu xin nghỉ</p><h1>Xin nghỉ</h1></div></div><Alert message={error} /><Alert message={message} type="success" /><div className="panel form-panel"><form className="product-form" onSubmit={submit}><label className="field"><span>Ngày nghỉ</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label><label className="field"><span>Ca</span><select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}><option value="full-day">{shiftLabels["full-day"]}</option><option value="morning">{shiftLabels.morning}</option><option value="afternoon">{shiftLabels.afternoon}</option></select></label><label className="field"><span>Lý do</span><textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required /></label><button className="button primary" disabled={submitting}>{submitting ? "Đang gửi..." : "Gửi phiếu"}</button></form></div></section>;
}
