export const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace("/api", "");

export const shiftLabels = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  "full-day": "Cả ngày",
};

export const statusLabels = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Approved",
  leave: "Nghỉ",
  "not-started": "Chưa làm",
  "in-progress": "Đang làm",
  completed: "Completed",
};

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "-");
export const today = () => new Date().toISOString().slice(0, 10);

export const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));

export const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));

const toLocalDateString = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const salaryPeriodRange = (month, year) => {
  const startDate = new Date(Number(year), Number(month) - 1, 11);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 27);

  return {
    start: toLocalDateString(startDate),
    end: toLocalDateString(endDate),
  };
};

export const salaryPeriodLabel = (month, year, periodStart, periodEnd) => {
  const fallback = salaryPeriodRange(month, year);
  return `${formatDate(periodStart || fallback.start)} - ${formatDate(periodEnd || fallback.end)}`;
};

export const exportCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
