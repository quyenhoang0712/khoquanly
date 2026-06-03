import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { authStorage } from "./api";
import AppLayout from "./components/AppLayout";
import AdminCheckouts from "./pages/admin/AdminCheckouts";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEmployees from "./pages/admin/AdminEmployees";
import { AdminScheduleRequests } from "./pages/admin/AdminRequests";
import AdminOvertime from "./pages/admin/AdminOvertime";
import AdminReports from "./pages/admin/AdminReports";
import AdminRules from "./pages/admin/AdminRules";
import AdminSalaries from "./pages/admin/AdminSalaries";
import AdminSchedules from "./pages/admin/AdminSchedules";
import AdminServiceExpenses from "./pages/admin/AdminServiceExpenses";
import AdminTasks from "./pages/admin/AdminTasks";
import Login from "./pages/Login";
import UserCheckout from "./pages/user/UserCheckout";
import UserDashboard from "./pages/user/UserDashboard";
import UserOvertime from "./pages/user/UserOvertime";
import UserProfile from "./pages/user/UserProfile";
import UserRules from "./pages/user/UserRules";
import UserSalary from "./pages/user/UserSalary";
import UserSchedule from "./pages/user/UserSchedule";
import UserScheduleRequest from "./pages/user/UserScheduleRequest";
import UserServiceExpenses from "./pages/user/UserServiceExpenses";
import UserTasks from "./pages/user/UserTasks";
import "./styles.css";

function ProtectedRoute({ role }) {
  const user = authStorage.getUser();
  if (!authStorage.getToken() || !user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/user/dashboard"} replace />;
  return <AppLayout />;
}

function HomeRedirect() {
  const user = authStorage.getUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/user/dashboard"} replace />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/employees" element={<AdminEmployees />} />
          <Route path="/admin/schedules" element={<AdminSchedules />} />
          <Route path="/admin/schedule-requests" element={<AdminScheduleRequests />} />
          <Route path="/admin/tasks" element={<AdminTasks />} />
          <Route path="/admin/service-expenses" element={<AdminServiceExpenses />} />
          <Route path="/admin/overtime" element={<AdminOvertime />} />
          <Route path="/admin/checkouts" element={<AdminCheckouts />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/salaries" element={<AdminSalaries />} />
          <Route path="/admin/rules" element={<AdminRules />} />
        </Route>

        <Route element={<ProtectedRoute role="user" />}>
          <Route path="/user/dashboard" element={<UserDashboard />} />
          <Route path="/user/profile" element={<UserProfile />} />
          <Route path="/user/schedule" element={<UserSchedule />} />
          <Route path="/user/schedule-request" element={<UserScheduleRequest />} />
          <Route path="/user/tasks" element={<UserTasks />} />
          <Route path="/user/service-expenses" element={<UserServiceExpenses />} />
          <Route path="/user/overtime" element={<UserOvertime />} />
          <Route path="/user/checkout" element={<UserCheckout />} />
          <Route path="/user/salary" element={<UserSalary />} />
          <Route path="/user/rules" element={<UserRules />} />
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
