
const BASE = (import.meta.env.VITE_API_URL || "") + "/api";
const KEY = "ems_token";

export const getToken = () => localStorage.getItem(KEY);

export const setToken = (t) =>
  t
    ? localStorage.setItem(KEY, t)
    : localStorage.removeItem(KEY);

// Common API request function
async function request(method, path, body) {
  let res;

  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(getToken()
          ? { Authorization: `Bearer ${getToken()}` }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Is the Flask backend running?"
    );
  }

  let data = null;

  try {
    data = await res.json();
  } catch {
    // Empty response body
  }

  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") {
      setToken(null);
      window.dispatchEvent(new Event("ems-logout"));
    }

    throw new Error(
      (data && data.error) || `Request failed (${res.status})`
    );
  }

  return data;
}

// Upload task attachments
async function uploadTaskAttachments(taskId, files) {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  let res;

  try {
    res = await fetch(`${BASE}/tasks/${taskId}/attachments`, {
      method: "POST",
      headers: getToken()
        ? { Authorization: `Bearer ${getToken()}` }
        : {},
      body: formData,
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Is the Flask backend running?"
    );
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      data?.error || `Upload failed (${res.status})`
    );
  }

  return data;
}

// Download task attachment
async function downloadTaskAttachment(taskId, attachmentId) {
  let res;

  try {
    res = await fetch(
      `${BASE}/tasks/${taskId}/attachments/${attachmentId}/download`,
      {
        headers: getToken()
          ? { Authorization: `Bearer ${getToken()}` }
          : {},
      }
    );
  } catch {
    throw new Error(
      "Cannot reach the server. Is the Flask backend running?"
    );
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Download failed");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "attachment";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

// Main API methods
export const api = {
  // Authentication
  login: (email, password) =>
    request("POST", "/auth/login", { email, password }),

  me: () => request("GET", "/auth/me"),

  changePassword: (current_password, new_password) =>
    request("POST", "/auth/change-password", {
      current_password,
      new_password,
    }),

  // Users
  users: () => request("GET", "/users"),

  createUser: (u) =>
    request("POST", "/users", u),

  updateUser: (id, u) =>
    request("PUT", `/users/${id}`, u),

  // Tasks
  tasks: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(
        ([, v]) => v !== "" && v != null
      )
    ).toString();

    return request(
      "GET",
      "/tasks" + (qs ? `?${qs}` : "")
    );
  },

  createTask: (t) =>
    request("POST", "/tasks", t),

  updateTask: (id, t) =>
    request("PUT", `/tasks/${id}`, t),

  setStatus: (id, status) =>
    request("PATCH", `/tasks/${id}/status`, { status }),

  deleteTask: (id) =>
    request("DELETE", `/tasks/${id}`),

  // Task attachments
  uploadTaskAttachments: uploadTaskAttachments,

  taskAttachments: (taskId) =>
    request("GET", `/tasks/${taskId}/attachments`),

  downloadTaskAttachment: downloadTaskAttachment,

  deleteTaskAttachment: (taskId, attachmentId) =>
    request(
      "DELETE",
      `/tasks/${taskId}/attachments/${attachmentId}`
    ),

  // Dashboard
  dashboard: () =>
    request("GET", "/dashboard"),

  // Emails
  emails: () =>
    request("GET", "/emails"),

  runReminders: () =>
    request("POST", "/reminders/run"),

  // Attendance
  enrollFace: (id, photo, consent) =>
    request("POST", `/attendance/enroll/${id}`, {
      photo,
      consent,
    }),

  attendanceStatus: () =>
    request("GET", "/attendance/status"),

  markAttendance: (payload) =>
    request("POST", "/attendance/mark", payload),

  attendanceRecords: (date = "") =>
    request(
      "GET",
      "/attendance/records" +
        (date
          ? `?date=${encodeURIComponent(date)}`
          : "")
    ),

  officeSettings: () =>
    request("GET", "/attendance/office"),

  saveOfficeSettings: (settings) =>
    request("PUT", "/attendance/office", settings),

  deleteFaceEnrollment: () =>
    request("DELETE", "/attendance/enrollment"),
};
