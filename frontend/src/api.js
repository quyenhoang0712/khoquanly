const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
const TOKEN_KEY = "workforce_token";
const USER_KEY = "workforce_user";

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },
  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && window.location.pathname !== "/login") {
      authStorage.clearSession();
      window.location.assign("/login");
    }
    throw new Error(data.message || "Request failed");
  }
  return data;
};

const request = async (url, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const token = authStorage.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(url, { ...options, headers });
  } catch (error) {
    throw new Error("Không kết nối được backend. Hãy chạy backend ở http://localhost:5001");
  }
};

const query = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") searchParams.append(key, value);
  });
  const value = searchParams.toString();
  return value ? `?${value}` : "";
};

const jsonOptions = (method, payload) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

export const api = {
  async login(payload) {
    return parseResponse(await request(`${API_BASE_URL}/auth/login`, jsonOptions("POST", payload)));
  },
  async getCurrentUser() {
    return parseResponse(await request(`${API_BASE_URL}/auth/me`));
  },

  async getAdminDashboard(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/dashboard${query(params)}`));
  },
  async getAdminUsers() {
    return parseResponse(await request(`${API_BASE_URL}/admin/users`));
  },
  async getAdminRules() {
    return parseResponse(await request(`${API_BASE_URL}/admin/rules`));
  },
  async createAdminRule(payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/rules`, jsonOptions("POST", payload)));
  },
  async updateAdminRule(id, payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/rules/${id}`, jsonOptions("PUT", payload)));
  },
  async deleteAdminRule(id) {
    return parseResponse(await request(`${API_BASE_URL}/admin/rules/${id}`, { method: "DELETE" }));
  },
  async createAdminUser(payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/users`, jsonOptions("POST", payload)));
  },
  async updateAdminUser(id, payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/users/${id}`, jsonOptions("PUT", payload)));
  },
  async deleteAdminUser(id) {
    return parseResponse(await request(`${API_BASE_URL}/admin/users/${id}`, { method: "DELETE" }));
  },
  async getAdminSchedules(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/schedules${query(params)}`));
  },
  async createAdminSchedule(payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/schedules`, jsonOptions("POST", payload)));
  },
  async updateAdminSchedule(date, userId, payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/schedules/${date}/${userId}`, jsonOptions("PUT", payload)));
  },
  async deleteAdminSchedule(date, userId) {
    return parseResponse(await request(`${API_BASE_URL}/admin/schedules/${date}/${userId}`, { method: "DELETE" }));
  },
  async getAdminScheduleRequests(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/schedule-requests${query(params)}`));
  },
  async reviewScheduleRequest(id, action, adminNote = "") {
    return parseResponse(await request(`${API_BASE_URL}/admin/schedule-requests/${id}/${action}`, jsonOptions("PUT", { adminNote })));
  },
  async autoScheduleRequests(payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/schedule-requests/auto-schedule`, jsonOptions("POST", payload)));
  },
  async createAdminTask(payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/tasks`, jsonOptions("POST", payload)));
  },
  async getAdminTasks(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/tasks${query(params)}`));
  },
  async getAdminTask(id) {
    return parseResponse(await request(`${API_BASE_URL}/admin/tasks/${id}`));
  },
  async deleteAdminTask(id) {
    return parseResponse(await request(`${API_BASE_URL}/admin/tasks/${id}`, { method: "DELETE" }));
  },
  async getAdminReports(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/reports${query(params)}`));
  },
  async getAdminMonthlyReport(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/monthly-report${query(params)}`));
  },
  async getAdminCheckouts(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/checkouts${query(params)}`));
  },
  async confirmAdminCheckout(payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/checkouts/manual`, jsonOptions("POST", payload)));
  },
  async getAdminSalaries(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/salaries${query(params)}`));
  },
  async getAdminOvertime(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/overtime${query(params)}`));
  },
  async getAdminServiceExpenses(params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/service-expenses${query(params)}`));
  },
  async createAdminOvertime(payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/overtime`, jsonOptions("POST", payload)));
  },
  async updateAdminOvertime(id, payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/overtime/${id}`, jsonOptions("PUT", payload)));
  },
  async deleteAdminOvertime(id) {
    return parseResponse(await request(`${API_BASE_URL}/admin/overtime/${id}`, { method: "DELETE" }));
  },
  async reviewAdminOvertime(id, payload) {
    return parseResponse(await request(`${API_BASE_URL}/admin/overtime/${id}/review`, jsonOptions("PUT", payload)));
  },
  async getAdminSalaryDetail(userId, params) {
    return parseResponse(await request(`${API_BASE_URL}/admin/salaries/${userId}${query(params)}`));
  },

  async getMySchedule(params) {
    return parseResponse(await request(`${API_BASE_URL}/user/my-schedule${query(params)}`));
  },
  async getMyProfile() {
    return parseResponse(await request(`${API_BASE_URL}/user/profile`));
  },
  async updateMyAvatar(formData) {
    return parseResponse(await request(`${API_BASE_URL}/user/profile/avatar`, { method: "PUT", body: formData }));
  },
  async updateMyPassword(payload) {
    return parseResponse(await request(`${API_BASE_URL}/user/profile/password`, jsonOptions("PUT", payload)));
  },
  async getMyCheckouts(params) {
    return parseResponse(await request(`${API_BASE_URL}/user/my-checkouts${query(params)}`));
  },
  async getCoworkers(params) {
    return parseResponse(await request(`${API_BASE_URL}/user/coworkers${query(params)}`));
  },
  async getMyScheduleRequests(params) {
    return parseResponse(await request(`${API_BASE_URL}/user/schedule-requests${query(params)}`));
  },
  async createScheduleRequest(payload) {
    return parseResponse(await request(`${API_BASE_URL}/user/schedule-requests`, jsonOptions("POST", payload)));
  },
  async getTodayTasks(params) {
    return parseResponse(await request(`${API_BASE_URL}/user/today-tasks${query(params)}`));
  },
  async getTask(id) {
    return parseResponse(await request(`${API_BASE_URL}/user/tasks/${id}`));
  },
  async updateTaskStatus(id, status) {
    return parseResponse(await request(`${API_BASE_URL}/user/tasks/${id}/status`, jsonOptions("PUT", { status })));
  },
  async submitTaskReport(id, formData) {
    return parseResponse(await request(`${API_BASE_URL}/user/tasks/${id}/report`, { method: "POST", body: formData }));
  },
  async checkout(payload) {
    if (payload instanceof FormData) {
      return parseResponse(await request(`${API_BASE_URL}/user/checkout`, { method: "POST", body: payload }));
    }
    return parseResponse(await request(`${API_BASE_URL}/user/checkout`, jsonOptions("POST", payload)));
  },
  async getMyServiceExpenses(params) {
    return parseResponse(await request(`${API_BASE_URL}/user/service-expenses${query(params)}`));
  },
  async createServiceExpense(payload) {
    return parseResponse(await request(`${API_BASE_URL}/user/service-expenses`, jsonOptions("POST", payload)));
  },
  async getMyOvertime(params) {
    return parseResponse(await request(`${API_BASE_URL}/user/overtime${query(params)}`));
  },
  async createOvertimeRequest(payload) {
    return parseResponse(await request(`${API_BASE_URL}/user/overtime`, jsonOptions("POST", payload)));
  },
  async getMySalary(params) {
    return parseResponse(await request(`${API_BASE_URL}/user/my-salary${query(params)}`));
  },
  async getRules() {
    return parseResponse(await request(`${API_BASE_URL}/user/rules`));
  },
};
