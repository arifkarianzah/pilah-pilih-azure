# 🌱 Pilah Pilih – Smart Waste Management

Platform digital pengelolaan sampah terpadu. Jual sampah, pickup, reward, dan lebih banyak lagi.

---

## 📁 Struktur Proyek

```
sampah/
├── 📄 index.html          ← Frontend utama (UI mobile)
├── 🎨 styles.css          ← Styling premium dark mode
├── ⚙️  app.js             ← Logic frontend & navigasi
├── 🔌 api.js              ← Client API (hubungkan ke backend)
├── 📦 package.json        ← Frontend dev server
│
└── backend/               ← 🔧 BACKEND (Express + SQLite)
    ├── server.js          ← Entry point server
    ├── .env               ← Konfigurasi (port, JWT, dll)
    ├── package.json       ← Dependencies backend
    │
    ├── database/
    │   ├── db.js          ← Schema SQLite (semua tabel)
    │   └── seed.js        ← Data awal untuk testing
    │
    ├── middleware/
    │   ├── auth.js        ← JWT authentication
    │   └── errorHandler.js← Error & validasi handler
    │
    ├── routes/
    │   ├── auth.js        ← Register, Login, OTP
    │   ├── users.js       ← Profil, statistik, leaderboard
    │   ├── transactions.js← Jual sampah, riwayat, status
    │   ├── pickups.js     ← Order pickup, tracking, rating
    │   ├── categories.js  ← Kategori sampah & harga
    │   ├── rewards.js     ← Katalog & tukar poin
    │   ├── wallet.js      ← Saldo, riwayat, tarik dana
    │   ├── notifications.js← Notifikasi user
    │   └── admin.js       ← Dashboard & laporan admin
    │
    └── uploads/           ← Folder foto yang diupload
```

---

## 🚀 Cara Menjalankan

### 1. Jalankan Backend (Terminal 1)

```bash
cd backend
npm install
npm run seed        # Isi data awal (sekali saja)
npm run dev         # Development mode (auto-restart)
# atau
npm start           # Production mode
```

Backend berjalan di: **http://localhost:5000**

### 2. Jalankan Frontend (Terminal 2)

```bash
# Di folder root (sampah/)
npm run dev
```

Frontend berjalan di: **http://localhost:3000**

---

## 🗄️ Database SQLite

Database dibuat otomatis di `backend/database/pilahpilih.db`

### Tabel-Tabel:

| Tabel | Deskripsi |
|-------|-----------|
| `users` | Data pengguna (user, petugas, bank sampah, admin) |
| `user_profiles` | Level, poin, statistik user |
| `waste_categories` | Jenis sampah & harga per kg |
| `transactions` | Transaksi jual sampah |
| `pickups` | Order pickup & tracking |
| `rewards` | Katalog hadiah reward |
| `reward_redemptions` | Riwayat tukar poin |
| `wallet_transactions` | Riwayat saldo wallet |
| `notifications` | Notifikasi user |
| `price_history` | Riwayat perubahan harga |
| `articles` | Artikel edukasi |
| `chat_messages` | Pesan live chat |
| `otp_codes` | Kode OTP untuk verifikasi |

---

## 🔌 REST API Endpoints

**Base URL:** `http://localhost:5000/api`

**Auth:** `Authorization: Bearer <token>` (untuk endpoint yang butuh login)

### Authentication
```
POST   /auth/register          Daftar akun baru
POST   /auth/login             Login → dapat token
POST   /auth/send-otp          Kirim OTP (register/reset)
POST   /auth/verify-otp        Verifikasi OTP
POST   /auth/forgot-password   Minta reset password
POST   /auth/reset-password    Reset password dengan kode
GET    /auth/me                [Auth] Info akun sendiri
POST   /auth/logout            [Auth] Logout
```

### Users
```
GET    /users/profile          [Auth] Profil user
PUT    /users/profile          [Auth] Update profil
PUT    /users/change-password  [Auth] Ganti password
GET    /users/stats            [Auth] Statistik user
GET    /users/leaderboard      [Auth] Papan peringkat
GET    /users                  [Admin] Semua user
PATCH  /users/:id/status       [Admin] Aktif/nonaktif user
```

### Kategori Sampah & Harga
```
GET    /categories             Semua kategori + harga
GET    /categories/:id         Detail + riwayat harga
GET    /categories/prices/latest  Harga terkini semua kategori
POST   /categories             [Admin] Tambah kategori
PUT    /categories/:id         [Admin] Update kategori/harga
```

### Transaksi (Jual Sampah)
```
POST   /transactions           [User] Buat order pickup baru
GET    /transactions           [Auth] Riwayat transaksi
GET    /transactions/:id       [Auth] Detail transaksi
PATCH  /transactions/:id/status [Petugas] Update status
DELETE /transactions/:id       [User] Batalkan order
```

### Pickup & Tracking
```
GET    /pickups                [Auth] Daftar pickup
GET    /pickups/:id            [Auth] Detail + timeline status
PATCH  /pickups/:id/accept     [Petugas] Terima order
PATCH  /pickups/:id/status     [Petugas] Update status
POST   /pickups/:id/rate       [User] Rating petugas (1-5)
GET    /pickups/:id/location   [User] Lokasi petugas real-time
```

### Reward
```
GET    /rewards                [Auth] Katalog reward
POST   /rewards/:id/redeem     [User] Tukar poin
GET    /rewards/redemptions/me [User] Riwayat tukar poin
GET    /rewards/redemptions    [Admin] Semua redemption
PATCH  /rewards/redemptions/:id [Admin] Update status
```

### Wallet
```
GET    /wallet/balance         [Auth] Saldo & info wallet
GET    /wallet/history         [Auth] Riwayat transaksi wallet
POST   /wallet/withdraw        [User] Tarik dana
GET    /wallet/transactions    [Admin] Semua transaksi wallet
```

### Notifikasi
```
GET    /notifications          [Auth] Daftar notifikasi
PATCH  /notifications/:id/read [Auth] Tandai dibaca
PATCH  /notifications/read-all [Auth] Tandai semua dibaca
```

### Admin
```
GET    /admin/dashboard        [Admin] Statistik utama
GET    /admin/reports          [Admin] Laporan (transaksi/revenue/user)
GET    /admin/petugas-stats    [Admin] Statistik petugas
```

---

## 👥 Akun Test (Setelah Seed)

| Role | Email | Password |
|------|-------|----------|
| User | rizki@example.com | password123 |
| Petugas | budi@example.com | password123 |
| Bank Sampah | bank@example.com | password123 |
| Admin | admin@pilahpilih.id | admin2025 |

---

## 🔌 Frontend API Client (api.js)

File `api.js` sudah tersedia di folder root. Gunakan seperti ini di konsol browser:

```javascript
// Login
const result = await API.Auth.login('rizki@example.com', 'password123');

// Lihat kategori sampah
const cats = await API.Category.getAll();

// Buat order pickup
const order = await API.Transaction.create({
  waste_name: 'Botol Plastik',
  category_id: 1,
  weight_kg: 2.5,
  address: 'Jl. Sudirman No. 45',
  condition: 'bersih'
});

// Lihat saldo wallet
const wallet = await API.Wallet.getBalance();

// Format rupiah
API.Format.currency(50000); // → "Rp 50.000"
```

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML5, Vanilla CSS, Vanilla JS |
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jsonwebtoken) |
| Security | bcryptjs, express-rate-limit, express-validator |
| File Upload | multer |

---

## ✅ Fitur Lengkap

- 🔐 Auth JWT (Register, Login, OTP, Forgot Password)
- 👥 Multi-role (User, Petugas, Bank Sampah, Admin)
- ♻️ Jual sampah dengan estimasi harga otomatis
- 🚛 Order & tracking pickup real-time
- ⭐ Sistem reward & tukar poin
- 💳 Dompet digital + tarik dana ke e-wallet
- 🔔 Notifikasi real-time
- 📊 Dashboard admin & laporan
- 🤖 AI Scan (frontend mock, siap dikoneksikan ke API)
- 🌙 Dark/Light mode
- 📱 Mobile-first design
