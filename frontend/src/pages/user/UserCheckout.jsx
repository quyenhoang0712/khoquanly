import { useState } from "react";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import { today } from "../../utils/workforce";

export default function UserCheckout() {
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event) => { event.preventDefault(); try { await api.checkout({ date, note }); setMessage("Checkout thành công."); setError(""); } catch (err) { setError(err.message); } };
  return <section className="page"><div className="page-header"><div><p className="eyebrow">Cuối ngày</p><h1>Checkout</h1></div></div><Alert message={error} /><Alert message={message} type="success" /><div className="panel form-panel"><form className="product-form" onSubmit={submit}><label className="field"><span>Ngày</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><label className="field"><span>Ghi chú</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="button primary">Checkout</button></form></div></section>;
}
