import { Camera, CalendarCheck, CheckCircle2, Lock, UserRound, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, authStorage } from "../../api";
import { monthKey, splitMonthKey } from "../../components/CalendarMonth";
import { Alert } from "../../components/DataState";
import Modal from "../../components/Modal";
import { assetUrl, formatCurrency, formatDate, formatNumber, shiftLabels, shiftTimeLabel } from "../../utils/workforce";

const positionLabels = {
  warehouse: "Nhân viên kho",
  sale: "Nhân viên sale",
};

export default function UserProfile() {
  const [profile, setProfile] = useState(authStorage.getUser());
  const [month] = useState(monthKey());
  const [schedule, setSchedule] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [salary, setSalary] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const load = async () => {
    try {
      setError("");
      const params = splitMonthKey(month);
      const [profileData, scheduleData, checkoutData, salaryData] = await Promise.all([
        api.getMyProfile(),
        api.getMySchedule(params),
        api.getMyCheckouts(params),
        api.getMySalary(params),
      ]);
      setProfile(profileData);
      setSchedule(scheduleData);
      setCheckouts(checkoutData);
      setSalary(salaryData);
      authStorage.setSession(authStorage.getToken(), { ...authStorage.getUser(), ...profileData });
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [month]);

  const checkoutDates = useMemo(() => new Set(checkouts.map((item) => item.date)), [checkouts]);
  const scheduledDates = useMemo(() => new Set(schedule.filter((item) => item.status === "scheduled").map((item) => item.date)), [schedule]);
  const workedSchedules = useMemo(
    () => schedule.filter((item) => item.status === "scheduled" && checkoutDates.has(item.date)),
    [checkoutDates, schedule]
  );
  const latestShift = useMemo(
    () => [...workedSchedules].sort((a, b) => b.date.localeCompare(a.date) || b.shift.localeCompare(a.shift))[0],
    [workedSchedules]
  );

  const stats = [
    ["Ngày có lịch", scheduledDates.size, CalendarCheck, "blue"],
    ["Ngày đã checkout", checkoutDates.size, CheckCircle2, "green"],
    ["Ca được tính", workedSchedules.length, UserRound, "amber"],
    ["Lương kỳ này", formatCurrency(salary?.totalSalary || 0), Wallet, "purple"],
  ];

  const avatarInitial = (profile?.name || profile?.email || "N").trim().charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar ? assetUrl(profile.avatar) : "";

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setError("");
      setMessage("");
      const formData = new FormData();
      formData.append("avatar", file);
      const updated = await api.updateMyAvatar(formData);
      setProfile(updated);
      authStorage.setSession(authStorage.getToken(), { ...authStorage.getUser(), ...updated });
      setMessage("Đã cập nhật ảnh đại diện.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Mật khẩu mới nhập lại không khớp");
      return;
    }
    try {
      setChangingPassword(true);
      setError("");
      setMessage("");
      await api.updateMyPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordOpen(false);
      setMessage("Đã đổi mật khẩu.");
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <section className="page profile-page">
      <div className="page-header profile-page-title">
        <div>
          <p className="eyebrow">Cá nhân</p>
          <h1>Hồ sơ của tôi</h1>
        </div>
      </div>

      <div className="profile-cover" />
      <div className="profile-header">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            {avatarUrl ? <img src={avatarUrl} alt={profile?.name || "avatar"} /> : <span>{avatarInitial}</span>}
          </div>
          <label className="profile-avatar-button" title="Đổi ảnh đại diện">
            <Camera size={18} />
            <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
          </label>
        </div>
        <div className="profile-title">
          <h1>{profile?.name || "Nhân viên"}</h1>
          <p>{positionLabels[profile?.position] || "Nhân viên"} · {profile?.email}</p>
          <button className="button small ghost profile-password-trigger" type="button" onClick={() => setPasswordOpen(true)}>
            <Lock size={16} />
            Đổi mật khẩu
          </button>
        </div>
      </div>

      <Alert message={error} />
      <Alert message={message} type="success" />

      <div className="stats-grid profile-stats">
        {stats.map(([label, value, Icon, tone]) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}>
              <Icon size={22} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{typeof value === "number" ? formatNumber(value) : value}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="task-board-grid profile-grid">
        <article className="task-board-card profile-summary-card">
          <div className="task-board-card-header">
            <div>
              <span>Tháng đã làm</span>
              <strong>{formatNumber(workedSchedules.length)} ca được tính công</strong>
            </div>
          </div>
          <div className="task-board-fields">
            <div>
              <span>Ngày vào hệ thống</span>
              <p>{profile?.createdAt ? formatDate(profile.createdAt) : "-"}</p>
            </div>
            <div>
              <span>Đơn giá</span>
              <p>{formatCurrency(profile?.hourlyRate || 0)}</p>
            </div>
            <div className="task-board-field-wide">
              <span>Ca đã làm gần nhất</span>
              <p>
                {latestShift
                  ? `${formatDate(latestShift.date)} · ${shiftLabels[latestShift.shift]} ${shiftTimeLabel(profile?.position, latestShift.shift)}`
                  : "Chưa có ca được tính công trong tháng này"}
              </p>
            </div>
          </div>
        </article>
      </div>

      {passwordOpen && (
        <Modal title="Đổi mật khẩu" onClose={() => setPasswordOpen(false)}>
          <form className="profile-password-form" onSubmit={changePassword}>
            <label className="field">
              <span>Mật khẩu hiện tại</span>
              <input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required autoFocus />
            </label>
            <label className="field">
              <span>Mật khẩu mới</span>
              <input type="password" minLength={6} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required />
            </label>
            <label className="field">
              <span>Nhập lại mật khẩu mới</span>
              <input type="password" minLength={6} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required />
            </label>
            <button className="button primary" type="submit" disabled={changingPassword}>
              {changingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
