export function Alert({ message, type = "danger" }) {
  if (!message) return null;
  return <div className={`alert ${type}`}>{message}</div>;
}

export function EmptyRow({ colSpan, children = "Không có dữ liệu." }) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty-cell">
        {children}
      </td>
    </tr>
  );
}

export function StatusBadge({ status }) {
  const display = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    scheduled: "Approved",
    leave: "Nghỉ",
    "not-started": "Chưa làm",
    "in-progress": "Đang làm",
    completed: "Completed",
  }[status] || status;
  const tone = {
    pending: "warning",
    Pending: "warning",
    approved: "success",
    Approved: "success",
    rejected: "danger",
    Rejected: "danger",
    scheduled: "success",
    leave: "warning",
    "not-started": "muted",
    "Chưa làm": "muted",
    "in-progress": "info",
    "Đang làm": "info",
    completed: "success",
    Completed: "success",
  }[status];

  return <span className={`badge ${tone || "muted"}`}>{display}</span>;
}
