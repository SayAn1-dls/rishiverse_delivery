import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rishi_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiError(e) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || "").join(" ");
  return e?.message || "Something went wrong";
}

export const photoUrl = (deliveryId) =>
  `${process.env.REACT_APP_BACKEND_URL}/api/deliveries/${deliveryId}/photo?auth=${localStorage.getItem("rishi_token")}`;

export default api;
