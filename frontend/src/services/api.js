import axios from "axios";

const api = axios.create({ baseURL: "/api", withCredentials: true });

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sn_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("sn_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login:    (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  me:       ()     => api.get("/auth/me"),
};

export const trafficAPI = {
  getLogs:      (params) => api.get("/traffic", { params }),
  getLiveStats: ()       => api.get("/traffic/live-stats"),
  ingest:       (data)   => api.post("/traffic/ingest", data),
};

export const detectionAPI = {
  getAttacks:  (params) => api.get("/detection/attacks", { params }),
  getAttack:   (id)     => api.get(`/detection/attacks/${id}`),
  resolveAttack:(id, notes) => api.patch(`/detection/attacks/${id}/resolve`, { notes }),
  getStats:    ()       => api.get("/detection/stats"),
  predict:     (data)   => api.post("/detection/predict", data),
  getModelInfo:()       => api.get("/detection/model-info"),
};

export const analyticsAPI = {
  getOverview:     ()       => api.get("/analytics/overview"),
  getTrafficSeries:(params) => api.get("/analytics/traffic-series", { params }),
  getAttackTypes:  (params) => api.get("/analytics/attack-types", { params }),
  getTopAttackers: ()       => api.get("/analytics/top-attackers"),
  getHourlySummary:()       => api.get("/analytics/hourly-summary"),
};

export const mitigationAPI = {
  getRules:      ()     => api.get("/mitigation/rules"),
  toggleRule:    (id)   => api.patch(`/mitigation/rules/${id}/toggle`),
  createRule:    (data) => api.post("/mitigation/rules", data),
  deleteRule:    (id)   => api.delete(`/mitigation/rules/${id}`),
  getBlockedIPs: (params) => api.get("/mitigation/blocked-ips", { params }),
  blockIP:       (data) => api.post("/mitigation/blocked-ips", data),
  unblockIP:     (id)   => api.delete(`/mitigation/blocked-ips/${id}`),
};

export const alertsAPI = {
  getAlerts:   (params) => api.get("/alerts", { params }),
  markRead:    (id)     => api.patch(`/alerts/${id}/read`),
  markAllRead: ()       => api.patch("/alerts/read-all"),
  deleteAlert: (id)     => api.delete(`/alerts/${id}`),
};

export default api;
