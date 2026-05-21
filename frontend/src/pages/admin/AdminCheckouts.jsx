import { useEffect, useState } from "react";
import { api } from "../../api";
import { Alert, EmptyRow } from "../../components/DataState";
import { assetUrl, formatDate, today } from "../../utils/workforce";

export default function AdminCheckouts() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAdminCheckouts({ date }).then(setRows).catch((err) => setError(err.message));
  }, [date]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1>Checkout nhân viên</h1>
        </div>
      </div>

      <Alert message={error} />

      <div className="toolbar">
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
            {rows.map((row) => (
              <tr key={row._id}>
                <td data-label="Ngày">{formatDate(row.date)}</td>
                <td data-label="Nhân viên">{row.user?.name}</td>
                <td data-label="Thời gian">{new Date(row.checkoutAt).toLocaleString("vi-VN")}</td>
                <td data-label="Ghi chú">{row.note || "-"}</td>
                <td data-label="Ảnh checkout">
                  {row.images?.length ? (
                    <div className="image-list">
                      {row.images.map((image) => (
                        <a key={image} href={assetUrl(image)} target="_blank" rel="noreferrer">
                          <img src={assetUrl(image)} alt="checkout" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
