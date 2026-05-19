import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow, StatusBadge } from "../../components/DataState";
import { formatDate, shiftLabels, statusLabels } from "../../utils/workforce";

export function AdminScheduleRequests() {
  return <RequestPage type="schedule" title="Duyệt đăng ký lịch tuần" />;
}

export function AdminLeaveRequests() {
  return <RequestPage type="leave" title="Duyệt phiếu xin nghỉ" />;
}

function RequestPage({ type, title }) {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    const getter = type === "schedule" ? api.getAdminScheduleRequests : api.getAdminLeaveRequests;
    getter({ status }).then(setRows).catch((err) => setError(err.message));
  };

  useEffect(load, [status, type]);

  const review = async (id, action) => {
    try {
      setError("");
      const fn = type === "schedule" ? api.reviewScheduleRequest : api.reviewLeaveRequest;
      await fn(id, action);
      setMessage(action === "approve" ? "Đã duyệt phiếu." : "Đã từ chối phiếu.");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page">
      <div className="page-header"><div><p className="eyebrow">Phê duyệt</p><h1>{title}</h1></div></div>
      <Alert message={error} /><Alert message={message} type="success" />
      <div className="toolbar"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
      <div className="panel table-wrap mobile-card-table">
        <table>
          <thead><tr><th>Nhân viên</th><th>Thông tin</th><th>Ghi chú/Lý do</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5} />}
            {rows.map((row) => (
              <tr key={row._id}>
                <td data-label="Nhân viên">{row.user?.name}</td>
                <td data-label="Thông tin">{type === "schedule" ? `Tuần ${formatDate(row.weekStart)}: ${row.shifts.map((item) => `${formatDate(item.date)} ${shiftLabels[item.shift]}`).join(", ")}` : `${formatDate(row.date)} - ${shiftLabels[row.shift]}`}</td>
                <td data-label="Ghi chú/Lý do">{row.note || row.reason || "-"}</td>
                <td data-label="Trạng thái"><StatusBadge status={statusLabels[row.status] || row.status} /></td>
                <td data-label="Thao tác"><div className="row-actions"><button className="button small primary" onClick={() => review(row._id, "approve")}>Duyệt</button><button className="button small ghost" onClick={() => review(row._id, "reject")}>Từ chối</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
