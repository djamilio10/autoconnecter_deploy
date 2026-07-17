import axios from 'axios';

// ── Tokens : access en mémoire (anti-XSS), refresh en cookie HttpOnly (serveur) ─
// L'access n'est PAS persisté en localStorage : un script injecté (XSS) ne peut donc
// pas le lire. Au refresh de page, la mémoire est perdue mais l'access est restauré
// via /token/refresh qui lit le cookie HttpOnly (inaccessible au JS).
let _accessToken = null;
export const getAccessToken = () => _accessToken;
export const setAccessToken = (t) => { _accessToken = t || null; };
export const clearAuth = () => {
  _accessToken = null;
  // Nettoyage des anciennes clés au cas où un client serait migré depuis l'ancienne version.
  ['access_token', 'refresh_token', 'user'].forEach(k => localStorage.removeItem(k));
};

// ── Instance axios ──────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || '/api';
// withCredentials envoie automatiquement le cookie refresh aux endpoints concernés.
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Refresh : protection anti-recursion + une seule requete a la fois ──────
let refreshPromise = null;

const doRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/token/refresh/`, {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.access);
        return data.access;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

/** Tente de restaurer l'access token au démarrage de l'app via le cookie refresh.
 *  Renvoie true si l'utilisateur est authentifié, false sinon. */
export const bootstrapAuth = async () => {
  try {
    await doRefresh();
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
};

api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;
    const status = error.response?.status;

    if (
      status !== 401 ||
      original?._retry ||
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/register') ||
      original?.url?.includes('/token/refresh')
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      const newAccess = await doRefresh();
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch (refreshErr) {
      clearAuth();
      window.dispatchEvent(new CustomEvent('auth:logout'));
      return Promise.reject(refreshErr);
    }
  }
);

// ── Endpoints ───────────────────────────────────────────────────────────────
export const authApi = {
  register: d => api.post('/auth/register/', d),
  verifyEmail: d => api.post('/auth/verify-email/', d),
  resendVerification: email => api.post('/auth/resend-verification/', { email }),
  requestPasswordReset: email => api.post('/auth/password-reset/request/', { email }),
  confirmPasswordReset: d => api.post('/auth/password-reset/confirm/', d),
  login: d => api.post('/auth/login/', d),
  logout: () => api.post('/auth/logout/').catch(() => null).finally(clearAuth),
  profile: () => api.get('/auth/profile/'),
  updateProfile: d => api.patch('/auth/profile/update/', d),
  changePassword: d => api.post('/auth/change-password/', d),
  twoFactorSetup: () => api.post('/auth/2fa/setup/'),
  twoFactorEnable: code => api.post('/auth/2fa/enable/', { code }),
  twoFactorDisable: code => api.post('/auth/2fa/disable/', { code }),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return api.post('/auth/avatar/', fd);
  },
};

export const carsApi = {
  list: params => api.get('/cars/', { params }),
  detail: id => api.get(`/cars/${id}/`),
  create: d => api.post('/cars/create/', d),
  update: (id, d) => api.patch(`/cars/${id}/edit/`, d),
  delete: id => api.delete(`/cars/${id}/edit/`),
  uploadImages: (id, files) => {
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    return api.post(`/cars/${id}/images/`, fd);
  },
  deleteImage: (carId, imageId) => api.delete(`/cars/${carId}/images/${imageId}/`),
  setPrimaryImage: (carId, imageId) => api.patch(`/cars/${carId}/images/${imageId}/set-primary/`),
  report: (carId, d) => api.post(`/cars/${carId}/report/`, d),
};

export const sellersApi = {
  list: () => api.get('/sellers/'),
  detail: id => api.get(`/sellers/${id}/`),
  requestPremium: () => api.post('/sellers/premium/request/'),
  premiumCheckout: (d) => api.post('/premium/checkout/', d),
  premiumStatus: (ref) => api.get('/premium/status/', { params: { ref } }),
  uploadLogo: (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return api.post('/sellers/logo/', fd);
  },
  reviews: id => api.get(`/sellers/${id}/reviews/`),
  addReview: (sellerId, d) => api.post(`/sellers/${sellerId}/reviews/`, d),
};

export const notificationsApi = {
  list: () => api.get('/auth/notifications/'),
  markRead: (ids) => api.post('/auth/notifications/read/', { ids: ids || [] }),
};

export const messagingApi = {
  conversations: () => api.get('/conversations/'),
  startConversation: d => api.post('/conversations/', d),
  messages: convId => api.get(`/conversations/${convId}/messages/`),
  sendMessage: (convId, content) => api.post(`/conversations/${convId}/messages/`, { content }),
};

export const appointmentsApi = {
  list: () => api.get('/appointments/'),
  create: d => api.post('/appointments/', d),
  update: (id, d) => api.patch(`/appointments/${id}/`, d),
};

export const favoritesApi = {
  list: () => api.get('/favorites/'),
  toggle: carId => api.post(`/favorites/${carId}/toggle/`),
};

export const dashboardApi = {
  seller: () => api.get('/dashboard/seller/'),
};

export const settingsApi = {
  public: () => api.get('/auth/settings/'),
  admin: () => api.get('/auth/admin/settings/'),
  update: d => api.patch('/auth/admin/settings/', d),
};

export const adminApi = {
  stats: () => api.get('/auth/admin/stats/'),
  users: params => api.get('/auth/admin/users/', { params }),
  updateUser: (id, d) => api.patch(`/auth/admin/users/${id}/`, d),
  deleteUser: id => api.delete(`/auth/admin/users/${id}/delete/`),
  banUser: (id, d) => api.post(`/auth/admin/users/${id}/ban/`, d),
  cars: params => api.get('/auth/admin/cars/', { params }),
  updateCar: (id, d) => api.patch(`/auth/admin/cars/${id}/`, d),
  deleteCar: id => api.delete(`/auth/admin/cars/${id}/delete/`),
  sellers: () => api.get('/auth/admin/sellers/'),
  verifySeller: (id, d) => api.patch(`/auth/admin/sellers/${id}/verify/`, d),
  sellerPremium: (id, d) => api.patch(`/auth/admin/sellers/${id}/premium/`, d),
  appointments: params => api.get('/auth/admin/appointments/', { params }),
  updateAppointment: (id, d) => api.patch(`/auth/admin/appointments/${id}/`, d),
  reports: params => api.get('/auth/admin/reports/', { params }),
  handleReport: (id, d) => api.patch(`/auth/admin/reports/${id}/`, d),
  auditLog: () => api.get('/auth/admin/audit/'),
};

export default api;

export const rentalApi = {
  list: () => api.get('/rental-requests/'),
  create: d => api.post('/rental-requests/', d),
  detail: id => api.get(`/rental-requests/${id}/`),
  update: (id, d) => api.patch(`/rental-requests/${id}/`, d),
  availability: carId => api.get(`/cars/${carId}/availability/`),
};
