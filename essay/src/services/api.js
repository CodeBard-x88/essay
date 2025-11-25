const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const MODEL_API_BASE_URL = import.meta.env.VITE_MODEL_API_BASE_URL || "http://localhost:8000";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || "Request failed";
    throw new Error(message);
  }

  return payload;
}

export const api = {
  register: (data) => request("/api/users/register", { method: "POST", body: data }),
  login: (data) => request("/api/users/login", { method: "POST", body: data }),
  fetchStudents: (token) => request("/api/students", { token }),
  createStudent: (token, data) => request("/api/students", { method: "POST", body: data, token }),
  fetchEssays: (token) => request("/api/essays", { token }),
  saveEssay: (token, data) => request("/api/essays", { method: "POST", body: data, token }),
  fetchAssignments: (token) => request("/api/assignments", { token }),
  createAssignment: (token, data) => request("/api/assignments", { method: "POST", body: data, token }),
  getAssignment: (token, id) => request(`/api/assignments/${id}`, { token }),
};

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getModelApiBaseUrl() {
  return MODEL_API_BASE_URL;
}

export async function evaluateEssayWithAI({ submissionText, studentName, assignmentId }) {
  const response = await fetch(`${MODEL_API_BASE_URL}/api/grade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      submission_text: submissionText,
      student_name: studentName,
      assignment_id: assignmentId,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.detail || "AI evaluation failed";
    throw new Error(message);
  }

  return payload;
}

