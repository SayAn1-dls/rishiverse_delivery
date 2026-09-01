import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});

export function apiError(e) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || "").join(" ");
  return e?.message || "Something went wrong";
}

export const photoUrl = (deliveryId) =>
  `${process.env.REACT_APP_BACKEND_URL}/api/deliveries/${deliveryId}/photo`;

export default api;
