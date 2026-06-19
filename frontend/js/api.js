/* =====================================================
   PILAH PILIH – Frontend API Client
   Hubungkan frontend ke backend REST API
   ===================================================== */
'use strict';

const IS_PROD = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_BASE = IS_PROD 
  ? 'https://pilahpilih-backend-abc-gfa9dgdtfmfjbsgp.southeastasia-01.azurewebsites.net/api' 
  : 'http://localhost:5000/api';
window.API_BASE = API_BASE;

/* ── STORAGE HELPERS ── */
const Storage = {
  get: (key) => {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return localStorage.getItem(key); }
  },
  set: (key, val) => localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : val),
  remove: (key) => localStorage.removeItem(key),
  getToken: () => localStorage.getItem('pp_token'),
  setToken: (t) => localStorage.setItem('pp_token', t),
  getUser: () => { try { return JSON.parse(localStorage.getItem('pp_user')); } catch { return null; } },
  setUser: (u) => localStorage.setItem('pp_user', JSON.stringify(u)),
  clear: () => { localStorage.removeItem('pp_token'); localStorage.removeItem('pp_user'); }
};

/* ── BASE FETCH WRAPPER ── */
async function apiRequest(method, path, body = null, isFormData = false) {
  const token = Storage.getToken();
  const headers = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const opts = { method, headers, cache: 'no-store' };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  try {
    const res  = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json();

    if (!res.ok) {
      throw new APIError(data.message || 'Terjadi kesalahan', res.status, data.errors);
    }
    return data;
  } catch (err) {
    if (err instanceof APIError) throw err;
    throw new APIError('Tidak dapat terhubung ke server. Periksa koneksi Anda.', 0);
  }
}

class APIError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.name = 'APIError';
  }
}

const get  = (path)         => apiRequest('GET',    path);
const post = (path, body)   => apiRequest('POST',   path, body);
const put  = (path, body)   => apiRequest('PUT',    path, body);
const patch= (path, body)   => apiRequest('PATCH',  path, body);
const del  = (path)         => apiRequest('DELETE', path);

/* ================================================
   AUTH API
   ================================================ */
const AuthAPI = {
  async register(data) {
    const res = await post('/auth/register', data);
    if (res.data?.token) {
      Storage.setToken(res.data.token);
      Storage.setUser(res.data.user);
    }
    return res;
  },

  async login(email, password) {
    const res = await post('/auth/login', { email, password });
    if (res.data?.token) {
      Storage.setToken(res.data.token);
      Storage.setUser(res.data.user);
      Storage.set('pp_profile', res.data.profile);
    }
    return res;
  },

  async sendOTP(identifier, purpose = 'verify') {
    return post('/auth/send-otp', { identifier, purpose });
  },

  async verifyOTP(identifier, code, purpose = 'verify') {
    return post('/auth/verify-otp', { identifier, code, purpose });
  },

  async forgotPassword(identifier) {
    return post('/auth/forgot-password', { identifier });
  },

  async resetPassword(identifier, code, new_password) {
    return post('/auth/reset-password', { identifier, code, new_password });
  },

  async getMe() {
    return get('/auth/me');
  },

  logout() {
    Storage.clear();
    goTo('login');
    showToast('👋 Berhasil logout');
  },

  isLoggedIn() {
    return !!Storage.getToken();
  },

  getCurrentUser() {
    return Storage.getUser();
  }
};

/* ================================================
   USER API
   ================================================ */
const UserAPI = {
  getProfile:     ()       => get('/users/profile'),
  updateProfile:  (data)   => put('/users/profile', data),
  changePassword: (data)   => put('/users/change-password', data),
  getStats:       ()       => get('/users/stats'),
  getLeaderboard: ()       => get('/users/leaderboard'),
};

/* ================================================
   CATEGORY API
   ================================================ */
const CategoryAPI = {
  getAll:        ()    => get('/categories'),
  getById:       (id)  => get(`/categories/${id}`),
  getLatestPrices: ()  => get('/categories/prices/latest'),
};

/* ================================================
   TRANSACTION API
   ================================================ */
const TransactionAPI = {
  create: (data)           => post('/transactions', data),
  getAll: (params = {})    => get(`/transactions?${new URLSearchParams(params)}`),
  getById: (id)            => get(`/transactions/${id}`),
  updateStatus: (id, status) => patch(`/transactions/${id}/status`, { status }),
  cancel: (id)             => del(`/transactions/${id}`),
};

/* ================================================
   PICKUP API
   ================================================ */
const PickupAPI = {
  getAll:        (params = {}) => get(`/pickups?${new URLSearchParams(params)}`),
  getById:       (id)          => get(`/pickups/${id}`),
  accept:        (id)          => patch(`/pickups/${id}/accept`),
  reject:        (id, reason)  => patch(`/pickups/${id}/reject`, { reason }),
  updateStatus:  (id, data)    => patch(`/pickups/${id}/status`, data),
  stats:        (params = {}) => get(`/pickups/stats${Object.keys(params).length ? '?' + new URLSearchParams(params) : ''}`),
  getLocation:   (id)          => get(`/pickups/${id}/location`),
  getChat:       (id)          => get(`/pickups/${id}/chat`),
  sendMessage:   (id, msg)     => post(`/pickups/${id}/chat`, { message: msg }),
};

/* ================================================
   REWARD API
   ================================================ */
const RewardAPI = {
  getAll:         (cat)  => get(cat ? `/rewards?category=${cat}` : '/rewards'),
  redeem:         (id)   => post(`/rewards/${id}/redeem`),
  getRedemptions: ()     => get('/rewards/redemptions/me'),
};

/* ================================================
   WALLET API
   ================================================ */
const WalletAPI = {
  getBalance: ()     => get(`/wallet/balance?t=${Date.now()}`),
  getHistory: (p={}) => get(`/wallet/history?${new URLSearchParams(p)}`),
  withdraw:   (data) => post('/wallet/withdraw', data),
};

/* ================================================
   NOTIFICATION API
   ================================================ */
const NotifAPI = {
  getAll:    ()   => get('/notifications'),
  markRead:  (id) => patch(`/notifications/${id}/read`),
  markAllRead: () => patch('/notifications/read-all'),
};

/* ================================================
   ADMIN API
   ================================================ */
const AdminAPI = {
  getDashboard:   ()       => get('/admin/dashboard'),
  getReports:     (p = {}) => get(`/admin/reports?${new URLSearchParams(p)}`),
  getPetugasStats: ()      => get('/admin/petugas-stats'),
  addIncome:      (data)   => post('/admin/income', data),
};

/* ================================================
   UTILITY: Format angka & tanggal
   ================================================ */
const Format = {
  currency: (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID'),
  weight:   (n) => Number(n || 0).toFixed(1) + ' kg',
  date:     (s) => new Date(s).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }),
  datetime: (s) => new Date(s).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }),
  relative: (s) => {
    const diff = Date.now() - new Date(s).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Baru saja';
    if (m < 60) return `${m} menit lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    return Format.date(s);
  }
};

/* ================================================
   INIT: Auto-load data jika sudah login
   ================================================ */
async function initAPI() {
  if (!AuthAPI.isLoggedIn()) return;

  try {
    // Refresh profil dari server
    const meRes = await AuthAPI.getMe();
    if (meRes.success) {
      Storage.setUser(meRes.data.user);
      Storage.set('pp_profile', meRes.data.profile);
    }

    // Update notifikasi badge
    const notifRes = await NotifAPI.getAll();
    if (notifRes.success) {
      const unread = notifRes.unread_count;
      document.querySelectorAll('.badge-dot').forEach(b => {
        b.textContent = unread || '';
        b.style.display = unread ? '' : 'none';
      });
    }
  } catch (err) {
    // Token expired
    if (err.status === 401) {
      Storage.clear();
      goTo('login');
    }
    console.warn('[API] Init error:', err.message);
  }
}

/* ── Jalankan saat DOM siap ── */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Hanya init API jika user sudah login (bukan di halaman login/splash)
    setTimeout(initAPI, 1000);
  });
}

/* ── Export global ── */
window.API = {
  Auth: AuthAPI,
  User: UserAPI,
  Category: CategoryAPI,
  Transaction: TransactionAPI,
  Pickup: PickupAPI,
  Reward: RewardAPI,
  Wallet: WalletAPI,
  Notif: NotifAPI,
  Admin: AdminAPI,
  Format,
  Storage,
  Error: APIError,
};

console.log(`🌱 Pilah Pilih API Client v1.0 loaded → ${API_BASE}`);
