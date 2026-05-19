import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  LogOut,
  Menu,
  ReceiptText,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authStorage } from "../api";

const adminItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/admin/employees", label: "Nhân sự", icon: Users },
  { to: "/admin/schedules", label: "Lịch nhân viên", icon: CalendarDays },
  { to: "/admin/schedule-requests", label: "Duyệt lịch tuần", icon: ClipboardCheck },
  { to: "/admin/leave-requests", label: "Duyệt xin nghỉ", icon: FileText },
  { to: "/admin/tasks", label: "Giao việc", icon: ClipboardCheck },
  { to: "/admin/checkouts", label: "Checkout", icon: Clock },
  { to: "/admin/reports", label: "Báo cáo", icon: FileText },
  { to: "/admin/salaries", label: "Bảng lương", icon: ReceiptText },
];

const userItems = [
  { to: "/user/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/user/schedule", label: "Lịch của tôi", icon: CalendarDays },
  { to: "/user/schedule-request", label: "Đăng ký lịch", icon: ClipboardCheck },
  { to: "/user/leave-request", label: "Xin nghỉ", icon: FileText },
  { to: "/user/tasks", label: "Việc hôm nay", icon: ClipboardCheck },
  { to: "/user/checkout", label: "Checkout", icon: Clock },
  { to: "/user/salary", label: "Lương của tôi", icon: ReceiptText },
];

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const user = authStorage.getUser();
  const navItems = user?.role === "admin" ? adminItems : userItems;

  const logout = () => {
    authStorage.clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={() => setOpen(false)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="admin-box">
          <div>
            <span>{user?.role === "admin" ? "Admin" : "Nhân viên"}</span>
            <strong>{user?.name || user?.email}</strong>
          </div>
          <button type="button" onClick={logout} aria-label="Đăng xuất">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <button className="mobile-menu" type="button" onClick={() => setOpen(!open)} aria-label="Menu">
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      <main className="main-content">
        <nav className="top-nav" aria-label="Điều hướng nhanh">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `top-nav-link ${isActive ? "active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </main>
    </div>
  );
}
