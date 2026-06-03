const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export const API_ORIGIN = (() => {
  try {
    const url = new URL(API_URL, window.location.origin);
    url.pathname = url.pathname.replace(/\/api\/?$/, "");
    url.search = "";
    url.hash = "";
    return url.origin + url.pathname.replace(/\/$/, "");
  } catch {
    return API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
  }
})();

export const assetUrl = (path) => {
  if (!path) return "";
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:") || path.startsWith("blob:")) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
};

export const shiftLabels = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  "full-day": "Cả ngày",
};

export const shiftTimesByPosition = {
  warehouse: {
    morning: { start: "09:00", end: "13:00", label: "09:00 - 13:00" },
    afternoon: { start: "13:00", end: "17:00", label: "13:00 - 17:00" },
  },
  sale: {
    morning: { start: "10:00", end: "16:00", label: "10:00 - 16:00" },
    afternoon: { start: "16:00", end: "22:00", label: "16:00 - 22:00" },
  },
};

export const positionKey = (position) => (position === "sale" ? "sale" : "warehouse");

export const shiftTimeLabel = (position, shift) => shiftTimesByPosition[positionKey(position)]?.[shift]?.label || "-";

export const shiftEndDateTime = (date, position, shift) => {
  const end = shiftTimesByPosition[positionKey(position)]?.[shift]?.end;
  return end ? new Date(`${date}T${end}:00`) : null;
};

export const statusLabels = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Approved",
  leave: "Nghỉ",
  "not-started": "Chưa làm",
  "in-progress": "Đang làm",
  completed: "Đã xong",
};

const toLocalDateString = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const formatDate = (value) => {
  if (!value) return "-";
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};
export const today = () => toLocalDateString(new Date());

export const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));

export const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));

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
