import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, StatusBadge } from "../../components/DataState";
import { formatDate, shiftLabels, statusLabels } from "../../utils/workforce";

const positionLabels = {
  warehouse: "Nhân viên kho",
  sale: "Nhân viên sale",
};

export function AdminScheduleRequests() {
  return <RequestPage title="Duyệt đăng ký lịch tuần" />;
}

function RequestPage({ title }) {
  const [position, setPosition] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => {
    api.getAdminScheduleRequests({ status: "pending", position }).then(setRows).catch((err) => setError(err.message));
  };

  useEffect(load, [position]);

  const review = async (id, action) => {
    try {
      setError("");
      setMessage("");
      await api.reviewScheduleRequest(id, action);
      setMessage("Đã ghi nhận.");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderRequestInfo = (row) => {
    return (
      <div className="schedule-request-info">
        <strong>Tuần {formatDate(row.weekStart)}</strong>
        <div>
          {row.shifts.map((item, index) => (
            <span key={`${item.date}-${item.shift}-${index}`}>
              {formatDate(item.date)} <b>{shiftLabels[item.shift]}</b>
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="page">
      <div className="page-header"><div><p className="eyebrow">Phê duyệt</p><h1>{title}</h1></div></div>
      <Alert message={error} /><Alert message={message} type="success" />
      <div className="toolbar compact-filter">
        <select value={position} onChange={(event) => setPosition(event.target.value)}>
          <option value="">Tất cả chức vụ</option>
          <option value="warehouse">Nhân viên kho</option>
          <option value="sale">Nhân viên sale</option>
        </select>
      </div>
      {rows.length === 0 && <div className="panel task-board-empty">Không có dữ liệu.</div>}
      <div className="task-board-grid">
        {rows.map((row) => (
          <article className="task-board-card" key={row._id}>
            <div className="task-board-card-header">
              <div>
                <span>Nhân viên</span>
                <strong>{row.user?.name || "Nhân viên"}</strong>
              </div>
              <StatusBadge status={statusLabels[row.status] || row.status} />
            </div>
            <div className="task-board-fields">
              <div>
                <span>Chức vụ</span>
                <p>{positionLabels[row.user?.position || "warehouse"]}</p>
              </div>
              <div>
                <span>Ghi chú/Lý do</span>
                <p>{row.note || row.reason || "-"}</p>
              </div>
              <div className="task-board-field-wide">
                <span>Thông tin</span>
                {renderRequestInfo(row)}
              </div>
              <div className="task-board-field-wide">
                <span>Thao tác</span>
                <div className="row-actions">
                  <button className="button small primary" onClick={() => review(row._id, "approve")}>Duyệt</button>
                  <button className="button small ghost" onClick={() => review(row._id, "reject")}>Từ chối</button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
