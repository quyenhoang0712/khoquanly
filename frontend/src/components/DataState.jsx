import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Alert({ message, type = "danger" }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message || type !== "success") return undefined;

    const timer = window.setTimeout(() => setVisible(false), 2600);
    return () => window.clearTimeout(timer);
  }, [message, type]);

  if (!message) return null;
  if (type === "success") {
    return createPortal(
      <div className={`toast-notice ${visible ? "show" : "hide"}`} role="status" aria-live="polite">
        <strong>{message}</strong>
      </div>,
      document.body
    );
  }

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
