import { Camera, CheckCircle2, Clock, UserCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { Alert } from "../../components/DataState";
import Modal from "../../components/Modal";
import { assetUrl, formatDate, formatNumber, today } from "../../utils/workforce";

export default function AdminCheckouts() {
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || today());
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") === "missing" ? "missing" : "");
  const [checkouts, setCheckouts] = useState([]);
  const [scheduledUsers, setScheduledUsers] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmingUserId, setConfirmingUserId] = useState("");

  const load = () => {
    setError("");
    return Promise.all([api.getAdminCheckouts({ date }), api.getAdminSchedules({ date, status: "scheduled" })])
      .then(([checkoutRows, scheduleRows]) => {
        setCheckouts(checkoutRows);
        const usersById = new Map();
        scheduleRows.forEach((row) => {
          const user = row.user;
          const userId = user?._id || user;
          if (userId && user?.active !== false) usersById.set(String(userId), user);
        });
        setScheduledUsers(Array.from(usersById.values()));
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, [date]);

  const checkoutImages = (checkout) =>
    (checkout?.imageUrls?.length ? checkout.imageUrls : checkout?.images || []).map(assetUrl);

  const scheduledUserIds = useMemo(() => {
    return new Set(scheduledUsers.map((user) => String(user._id)).filter(Boolean));
  }, [scheduledUsers]);

  const visibleCheckouts = useMemo(() => {
    return checkouts.filter((row) => scheduledUserIds.has(String(row.user?._id || row.user)));
  }, [checkouts, scheduledUserIds]);

  const summary = useMemo(() => {
    const checkedOutScheduledIds = new Set(visibleCheckouts.map((row) => String(row.user?._id || row.user)).filter(Boolean));
    const imageCount = visibleCheckouts.reduce((sum, row) => sum + checkoutImages(row).length, 0);
    return {
      records: visibleCheckouts.length,
      employees: checkedOutScheduledIds.size,
      scheduled: scheduledUsers.length,
      missing: scheduledUsers.filter((user) => !checkedOutScheduledIds.has(String(user._id))).length,
      images: imageCount,
    };
  }, [scheduledUsers, visibleCheckouts]);

  const records = useMemo(() => {
    const checkoutByUser = new Map(visibleCheckouts.map((row) => [String(row.user?._id || row.user), row]));
    const allRecords = scheduledUsers.map((user) => ({
      user,
      checkout: checkoutByUser.get(String(user._id)) || null,
    }));
    return statusFilter === "missing" ? allRecords.filter((record) => !record.checkout) : allRecords;
  }, [scheduledUsers, statusFilter, visibleCheckouts]);

  const checkoutTime = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  const confirmCheckout = async (record) => {
    const userId = record.user?._id;
    if (!userId) return;
    try {
      setConfirmingUserId(userId);
      setError("");
      setMessage("");
      await api.confirmAdminCheckout({
        userId,
        date,
        note: "Admin xác nhận checkout để bổ sung dữ liệu lương.",
      });
      setMessage(`Đã xác nhận checkout cho ${record.user?.name || "nhân viên"}.`);
      setSelectedRecord(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmingUserId("");
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1>Checkout nhân viên</h1>
          <p className="page-subtitle">Theo dõi nhân viên đã checkout trong ngày và xem ảnh bàn giao nếu có.</p>
        </div>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

      <div className="checkout-overview">
        <div className="checkout-date-card">
          <span>ngày xem</span>
          <strong>{formatDate(date)}</strong>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Chọn ngày checkout" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái checkout">
            <option value="">Tất cả</option>
            <option value="missing">Chưa checkout</option>
          </select>
        </div>
        <article className="checkout-summary-card green">
          <CheckCircle2 size={22} />
          <div>
            <span>lượt checkout</span>
            <strong>{formatNumber(summary.records)}</strong>
          </div>
        </article>
        <article className="checkout-summary-card blue">
          <UserCheck size={22} />
          <div>
            <span>có lịch làm</span>
            <strong>{formatNumber(summary.scheduled)}</strong>
          </div>
        </article>
        <article className="checkout-summary-card red">
          <XCircle size={22} />
          <div>
            <span>chưa checkout</span>
            <strong>{formatNumber(summary.missing)}</strong>
          </div>
        </article>
        <article className="checkout-summary-card amber">
          <Camera size={22} />
          <div>
            <span>ảnh bàn giao</span>
            <strong>{formatNumber(summary.images)}</strong>
          </div>
        </article>
      </div>

      <div className="checkout-list">
        {records.length === 0 && <div className="panel task-board-empty">Ngày này chưa có nhân viên được xếp lịch.</div>}
        {records.map((record) => {
          const row = record.checkout;
          const images = checkoutImages(row);
          const checkedOut = Boolean(row);
          const name = record.user?.name || "Nhân viên";
          const initial = name.trim().charAt(0).toUpperCase();
          return (
            <button className={`checkout-record-card ${checkedOut ? "is-checked" : "is-missing"}`} type="button" key={record.user._id} onClick={() => setSelectedRecord(record)}>
              <div className="checkout-person">
                <div className="checkout-avatar">{initial}</div>
                <div>
                  <span>nhân viên</span>
                  <strong>{name}</strong>
                </div>
              </div>

              <div className="checkout-record-meta">
                <div>
                  <span>trạng thái</span>
                  <strong className={`checkout-status-text ${checkedOut ? "done" : "missing"}`}>{checkedOut ? "Đã checkout" : "Chưa checkout"}</strong>
                </div>
                <div>
                  <span>thời gian</span>
                  <strong><Clock size={16} /> {checkedOut ? checkoutTime(row.checkoutAt) : "-"}</strong>
                </div>
              </div>

              <div className="checkout-media">
                {checkedOut && images.length ? (
                  <div className="checkout-image-actions">
                    <span className="checkout-thumb-button">
                      <img src={images[0]} alt="checkout" />
                      {images.length > 1 && <span>+{images.length - 1}</span>}
                    </span>
                    <span className="checkout-open-detail">Chi tiết</span>
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {selectedRecord && (
        <Modal title={`Chi tiết checkout - ${selectedRecord.user?.name || "Nhân viên"}`} onClose={() => setSelectedRecord(null)}>
          <div className="checkout-detail">
            <div className="checkout-detail-grid">
              <div>
                <span>trạng thái</span>
                <strong>{selectedRecord.checkout ? "Đã checkout" : "Chưa checkout"}</strong>
              </div>
              <div>
                <span>ngày</span>
                <strong>{formatDate(date)}</strong>
              </div>
              <div>
                <span>thời gian</span>
                <strong>{selectedRecord.checkout ? checkoutTime(selectedRecord.checkout.checkoutAt) : "-"}</strong>
              </div>
              <div>
                <span>ghi chú</span>
                <p>{selectedRecord.checkout?.note || "Không có ghi chú"}</p>
              </div>
            </div>

            {selectedRecord.checkout && checkoutImages(selectedRecord.checkout).length > 0 ? (
              <div className="checkout-preview-grid">
                {checkoutImages(selectedRecord.checkout).map((image, index) => (
                  <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer">
                    <img src={image} alt={`checkout ${index + 1}`} />
                  </a>
                ))}
              </div>
            ) : (
              <div className="checkout-detail-empty">Không có ảnh checkout.</div>
            )}

            {!selectedRecord.checkout && (
              <button className="button primary" type="button" onClick={() => confirmCheckout(selectedRecord)} disabled={confirmingUserId === selectedRecord.user?._id}>
                {confirmingUserId === selectedRecord.user?._id ? "Đang xác nhận..." : "Xác nhận đã checkout"}
              </button>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
