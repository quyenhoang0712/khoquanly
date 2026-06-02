import { createPortal } from "react-dom";

export default function Modal({ title, children, onClose, className = "" }) {
  return createPortal(
    <div className="modal-backdrop">
      <div className={`modal ${className}`.trim()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng">
            x
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
