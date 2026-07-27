import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  timeout: 60000,
});

// Dedicated instance for file uploads (IPFS/Pinata) which can take longer
export const uploadApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  timeout: 120000, // 2 minutes for large file uploads
});

// Attach JWT token to every request
const attachToken = (config) => {
  const token = localStorage.getItem("drivex_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};

api.interceptors.request.use(attachToken);
uploadApi.interceptors.request.use(attachToken);

// Global error handling
const handleResponseError = (err) => {
  if (err.response?.status === 401) {
    localStorage.removeItem("drivex_token");
    window.location.href = "/";
  }
  return Promise.reject(err);
};

api.interceptors.response.use((res) => res, handleResponseError);
uploadApi.interceptors.response.use((res) => res, handleResponseError);

export default api;
