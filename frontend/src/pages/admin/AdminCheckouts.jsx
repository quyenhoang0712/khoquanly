import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import { formatDate, today } from "../../utils/workforce";

export default function AdminCheckouts() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api.getAdminCheckouts({ date }).then(setRows).catch((err) => setError(err.message)); }, [date]);
  return <section className="page"><div className="page-header"><div><p className="eyebrow">Checkout</p><h1>Checkout nhân viên</h1></div></div><Alert message={error} /><div className="toolbar"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className="panel table-wrap"><table><thead><tr><th>Ngày</th><th>Nhân viên</th><th>Thời gian</th><th>Ghi chú</th></tr></thead><tbody>{rows.length === 0 && <EmptyRow colSpan={4} />}{rows.map((row) => <tr key={row._id}><td>{formatDate(row.date)}</td><td>{row.user?.name}</td><td>{new Date(row.checkoutAt).toLocaleString("vi-VN")}</td><td>{row.note || "-"}</td></tr>)}</tbody></table></div></section>;
}
