import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import { API_ORIGIN, formatDate, today } from "../../utils/workforce";

export default function AdminReports() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api.getAdminReports({ date }).then(setRows).catch((err) => setError(err.message)); }, [date]);
  return (
    <section className="page">
      <div className="page-header"><div><p className="eyebrow">Báo cáo cuối ngày</p><h1>Báo cáo nhân viên</h1></div></div>
      <Alert message={error} />
      <div className="toolbar"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
      <div className="panel table-wrap mobile-card-table"><table><thead><tr><th>Ngày</th><th>Nhân viên</th><th>Công việc</th><th>Nội dung</th><th>Ảnh</th></tr></thead><tbody>
        {rows.length === 0 && <EmptyRow colSpan={5} />}
        {rows.map((row) => <tr key={row._id}><td data-label="Ngày">{formatDate(row.date)}</td><td data-label="Nhân viên">{row.user?.name}</td><td data-label="Công việc">{row.task?.title}</td><td data-label="Nội dung">{row.content}</td><td data-label="Ảnh"><div className="image-list">{row.images?.map((img) => <a key={img} href={`${API_ORIGIN}${img}`} target="_blank" rel="noreferrer"><img src={`${API_ORIGIN}${img}`} alt="report" /></a>)}</div></td></tr>)}
      </tbody></table></div>
    </section>
  );
}
