import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, authStorage } from "../api";
import { Alert } from "../components/DataState";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authStorage.getToken()) return <Navigate to="/" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      const data = await api.login(formData);
      authStorage.setSession(data.token, data.user);
      navigate(data.user.role === "admin" ? "/admin/dashboard" : "/user/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Workforce Management</p>
        <h1>Đăng nhập</h1>
        <p className="login-subtitle">Tài khoản nhân viên sẽ do Admin tạo trong hệ thống.</p>
        <Alert message={error} />
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              placeholder="Nhập email"
              required
            />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <input
              type="password"
              value={formData.password}
              onChange={(event) => setFormData({ ...formData, password: event.target.value })}
              placeholder="Nhập mật khẩu"
              required
            />
          </label>
          <button className="button primary login-submit" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </section>
    </main>
  );
}
