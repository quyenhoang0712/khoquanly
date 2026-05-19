import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import CalendarMonth, { describeShift, groupByDate, monthKey, splitMonthKey } from "../../components/CalendarMonth";
import { Alert, EmptyRow, StatusBadge } from "../../components/DataState";
import Modal from "../../components/Modal";
import { API_ORIGIN, formatDate, shiftLabels, statusLabels } from "../../utils/workforce";

export default function UserSchedule() {
  const [month, setMonth] = useState(monthKey());
  const [rows, setRows] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [coworkers, setCoworkers] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    const params = splitMonthKey(month);
    Promise.all([api.getMySchedule(params), api.getMyCheckouts(params)])
      .then(([scheduleData, checkoutData]) => {
        setRows(scheduleData);
        setCheckouts(checkoutData);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [month]);

  const itemsByDate = useMemo(() => groupByDate(rows), [rows]);
  const checkoutByDate = useMemo(() => Object.fromEntries(checkouts.map((item) => [item.date, item])), [checkouts]);
  const dayItems = selectedDate ? itemsByDate[selectedDate] || [] : [];
  const checkout = selectedDate ? checkoutByDate[selectedDate] : null;
  const coworkerNames = [...new Set(coworkers.map((item) => item.user?.name).filter(Boolean))];

  const openDay = async (date) => {
    setSelectedDate(date);
    try {
      setCoworkers(await api.getCoworkers({ date }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Lịch làm</p>
          <h1>Lịch của tôi</h1>
        </div>
      </div>
      <Alert message={error} />
      <div className="toolbar calendar-toolbar">
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        <div className="calendar-legend">
          <span className="legend-dot morning" /> Ca sáng
          <span className="legend-dot afternoon" /> Ca chiều
          <span className="legend-dot leave" /> Nghỉ
        </div>
      </div>
      <CalendarMonth
        month={month}
        itemsByDate={itemsByDate}
        onDayClick={openDay}
        renderMeta={(date) => checkoutByDate[date] && <span className="calendar-checkout">Đã checkout</span>}
      />

      {selectedDate && (
        <Modal title={`Chi tiết ${formatDate(selectedDate)}`} onClose={() => setSelectedDate("")}>
          <div className="detail-grid">
            <div><span>Ngày làm</span><strong>{formatDate(selectedDate)}</strong></div>
            <div><span>Checkout</span><strong>{checkout ? "Đã checkout" : "Chưa checkout"}</strong></div>
            <div><span>Làm với ai</span><strong>{coworkerNames.join(", ") || "-"}</strong></div>
            <div><span>Ghi chú</span><strong>{checkout?.note || "-"}</strong></div>
          </div>
          {checkout?.images?.length > 0 && (
            <div className="checkout-images">
              <span>Ảnh checkout</span>
              <div className="image-list">
                {checkout.images.map((image) => (
                  <a key={image} href={`${API_ORIGIN}${image}`} target="_blank" rel="noreferrer">
                    <img src={`${API_ORIGIN}${image}`} alt="checkout" />
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="table-wrap mobile-card-table">
            <table>
              <thead><tr><th>Ca làm</th><th>Thời gian</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {dayItems.length === 0 && <EmptyRow colSpan={3}>Không có lịch trong ngày này.</EmptyRow>}
                {dayItems.map((item) => (
                  <tr key={item._id}>
                    <td data-label="Ca làm">{describeShift(item)}</td>
                    <td data-label="Thời gian">{item.status === "leave" ? "-" : item.shift === "morning" ? "09:00 - 13:00" : "13:00 - 17:00"}</td>
                    <td data-label="Trạng thái"><StatusBadge status={statusLabels[item.status] || item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </section>
  );
}
