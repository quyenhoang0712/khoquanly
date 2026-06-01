import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import Modal from "../../components/Modal";
import { assetUrl, formatDate, today } from "../../utils/workforce";

export default function AdminCheckouts() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [selectedCheckout, setSelectedCheckout] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAdminCheckouts({ date }).then(setRows).catch((err) => setError(err.message));
  }, [date]);

  const checkoutImages = (checkout) =>
    (checkout?.imageUrls?.length ? checkout.imageUrls : checkout?.images || []).map(assetUrl);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1>Checkout nhân viên</h1>
        </div>
      </div>

      <Alert message={error} />

      <div className="toolbar compact-filter">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      <div className="panel table-wrap mobile-card-table">
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Nhân viên</th>
              <th>Thời gian</th>
              <th>Ghi chú</th>
              <th>Ảnh checkout</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5} />}
            {rows.map((row) => {
              const images = checkoutImages(row);
              return (
                <tr key={row._id}>
                  <td data-label="Ngày">{formatDate(row.date)}</td>
                  <td data-label="Nhân viên">{row.user?.name}</td>
                  <td data-label="Thời gian">{new Date(row.checkoutAt).toLocaleString("vi-VN")}</td>
                  <td data-label="Ghi chú">{row.note || "-"}</td>
                  <td data-label="Ảnh checkout">
                    {images.length ? (
                      <div className="checkout-image-actions">
                        <button className="checkout-thumb-button" type="button" onClick={() => setSelectedCheckout(row)}>
                          <img src={images[0]} alt="checkout" />
                          {images.length > 1 && <span>+{images.length - 1}</span>}
                        </button>
                        <button className="button small ghost" type="button" onClick={() => setSelectedCheckout(row)}>
                          Xem ảnh
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedCheckout && (
        <Modal title={`Ảnh checkout - ${selectedCheckout.user?.name || "Nhân viên"}`} onClose={() => setSelectedCheckout(null)}>
          <div className="checkout-preview-grid">
            {checkoutImages(selectedCheckout).map((image, index) => (
              <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer">
                <img src={image} alt={`checkout ${index + 1}`} />
              </a>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}
