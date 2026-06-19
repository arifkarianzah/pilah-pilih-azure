/* =====================================================
   ROUTES – Authentication
   ===================================================== */
'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body } = require('express-validator');
const db      = require('../database/db');
const { uuidv4 } = require('../database/db');
const { validate } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}
function safeUser(u) { const { password, ...s } = u; return s; }

/* POST /api/auth/register */
router.post('/register',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Nama minimal 2 karakter'),
    body('email').isEmail().normalizeEmail().withMessage('Email tidak valid'),
    body('password').isLength({ min: 8 }).withMessage('Password minimal 8 karakter'),
    body('role').optional().isIn(['user','petugas','bank_sampah']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone, password, role = 'user', address, city } = req.body;
      const existEmail = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existEmail) return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });

      if (phone) {
        const existPhone = await db.get('SELECT id FROM users WHERE phone = ?', [phone]);
        if (existPhone) return res.status(409).json({ success: false, message: 'Nomor telepon sudah terdaftar.' });
      }

      const hashed = bcrypt.hashSync(password, 12);
      const id = uuidv4();
      await db.run(
        'INSERT INTO users (id, name, email, phone, password, role, address, city) VALUES (?,?,?,?,?,?,?,?)',
        [id, name, email, phone || null, hashed, role, address || null, city || null]
      );
      await db.run('INSERT INTO user_profiles (user_id) VALUES (?)', [id]);
      await db.run(
        'INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,?)',
        [uuidv4(), id, 'Selamat Datang!', `Hai ${name}! Akun berhasil dibuat.`, 'success']
      );

      const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
      const token = makeToken(user);
      res.status(201).json({ success: true, message: 'Registrasi berhasil!', data: { token, user: safeUser(user) } });
    } catch (err) { next(err); }
  }
);

/* POST /api/auth/login */
router.post('/login',
  [
    body('email').notEmpty().withMessage('Email atau No. HP wajib diisi'),
    body('password').notEmpty().withMessage('Password wajib diisi'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      
      // email can be an actual email or a phone number
      const user = await db.get('SELECT * FROM users WHERE email = ? OR phone = ?', [email, email]);
      
      if (!user) return res.status(401).json({ success: false, message: 'Email/No.HP atau password salah.' });
      if (!user.is_active) return res.status(403).json({ success: false, message: 'Akun dinonaktifkan.' });
      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ success: false, message: 'Email/No.HP atau password salah.' });
      }
      const profile = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [user.id]);
      const token = makeToken(user);
      res.json({ success: true, message: 'Login berhasil!', data: { token, user: safeUser(user), profile } });
    } catch (err) { next(err); }
  }
);

const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* POST /api/auth/fake-google (Simulated) */
router.post('/fake-google', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email tidak valid.' });

    // Simulasi data dari "Google"
    const name = email.split('@')[0];
    const picture = `https://ui-avatars.com/api/?name=${name}&background=118EEA&color=fff&rounded=true`;

    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    // Jika belum punya akun, otomatis buat akun (Register with Google Simulasi)
    if (!user) {
      const id = uuidv4();
      const defaultRole = 'user';
      // Kita pakai password acak (karena simulasi bypass sandi asli)
      const randomPwd = bcrypt.hashSync(password || Math.random().toString(36).slice(-8), 12);
      
      await db.run(
        'INSERT INTO users (id, name, email, password, role) VALUES (?,?,?,?,?)',
        [id, name, email, randomPwd, defaultRole]
      );
      await db.run('INSERT INTO user_profiles (user_id, avatar) VALUES (?,?)', [id, picture]);
      
      // Hapus emoji agar database tidak error (jika tabel belum disetel utf8mb4)
      await db.run(
        'INSERT INTO notifications (id, user_id, title, body, type) VALUES (?,?,?,?,?)',
        [uuidv4(), id, 'Selamat Datang!', `Hai ${name}! Akun simulasi berhasil dibuat.`, 'success']
      );
      user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    } else {
      if (!user.is_active) return res.status(403).json({ success: false, message: 'Akun dinonaktifkan.' });
    }

    const profile = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [user.id]);
    const token = makeToken(user);
    res.json({ success: true, message: 'Login Google Simulasi berhasil!', data: { token, user: safeUser(user), profile } });
  } catch (err) {
    console.error('Fake Google Auth Error:', err);
    res.status(401).json({ success: false, message: 'Autentikasi gagal.' });
  }
});

/* KONFIGURASI NODEMAILER */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASS
  }
});

/* POST /api/auth/send-otp */
router.post('/send-otp', async (req, res, next) => {
  try {
    const { identifier, purpose = 'verify' } = req.body;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    
    await db.run('INSERT INTO otp_codes (identifier, code, purpose, expires_at) VALUES (?,?,?,?)',
      [identifier, code, purpose, expiresAt]);
    
    console.log(`[OTP] ${identifier}: ${code}`);
    
    // Jika identifier adalah email dan SMTP sudah diset, kirim email sungguhan
    if (identifier.includes('@') && process.env.SMTP_EMAIL && process.env.SMTP_PASS) {
      try {
        await transporter.sendMail({
          from: `"PilahPilih System" <${process.env.SMTP_EMAIL}>`,
          to: identifier,
          subject: 'Kode Verifikasi OTP Anda',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #00D084; text-align: center;">PilahPilih</h2>
              <p>Halo,</p>
              <p>Berikut adalah kode verifikasi OTP Anda. Kode ini berlaku selama 2 menit.</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111;">${code}</span>
              </div>
              <p style="font-size: 12px; color: #666; text-align: center;">Jangan berikan kode ini kepada siapapun.</p>
            </div>
          `
        });
      } catch (mailErr) {
        console.error('Gagal mengirim email OTP:', mailErr);
        // Tetap lanjutkan meski gagal kirim email, agar tidak crash di frontend
      }
    }

    res.json({ success: true, message: 'OTP berhasil dikirim.',
      ...(process.env.NODE_ENV === 'development' && { _dev_code: code }) });
  } catch (err) { next(err); }
});

/* POST /api/auth/verify-otp */
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { identifier, code, purpose = 'verify' } = req.body;
    const otp = await db.get(
      `SELECT * FROM otp_codes WHERE identifier = ? AND code = ? AND purpose = ? AND is_used = 0 ORDER BY created_at DESC LIMIT 1`,
      [identifier, code, purpose]
    );
    if (!otp) return res.status(400).json({ success: false, message: 'OTP tidak valid.' });
    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP kedaluwarsa.' });
    }
    await db.run('UPDATE otp_codes SET is_used = 1 WHERE id = ?', [otp.id]);
    if (purpose === 'verify') {
      await db.run('UPDATE users SET is_verified = 1 WHERE email = ? OR phone = ?', [identifier, identifier]);
    }
    res.json({ success: true, message: 'OTP berhasil diverifikasi.' });
  } catch (err) { next(err); }
});

/* POST /api/auth/forgot-password */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { identifier } = req.body;
    const user = await db.get('SELECT id FROM users WHERE email = ? OR phone = ?', [identifier, identifier]);
    if (user) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await db.run('INSERT INTO otp_codes (identifier, code, purpose, expires_at) VALUES (?,?,?,?)',
        [identifier, code, 'reset_password', expiresAt]);
      console.log(`[RESET] ${identifier}: ${code}`);
    }
    res.json({ success: true, message: 'Jika akun ditemukan, kode reset telah dikirim.' });
  } catch (err) { next(err); }
});

/* POST /api/auth/reset-password */
router.post('/reset-password',
  [
    body('identifier').notEmpty(),
    body('code').isLength({ min: 6, max: 6 }),
    body('new_password').isLength({ min: 8 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { identifier, code, new_password } = req.body;
      const otp = await db.get(
        `SELECT * FROM otp_codes WHERE identifier = ? AND code = ? AND purpose = 'reset_password' AND is_used = 0 ORDER BY created_at DESC LIMIT 1`,
        [identifier, code]
      );
      if (!otp || new Date(otp.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: 'Kode tidak valid atau kedaluwarsa.' });
      }
      const hashed = bcrypt.hashSync(new_password, 12);
      await db.run('UPDATE users SET password = ? WHERE email = ? OR phone = ?', [hashed, identifier, identifier]);
      await db.run('UPDATE otp_codes SET is_used = 1 WHERE id = ?', [otp.id]);
      res.json({ success: true, message: 'Password berhasil direset.' });
    } catch (err) { next(err); }
  }
);

/* GET /api/auth/me */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user    = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const profile = await db.get('SELECT * FROM user_profiles WHERE user_id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    res.json({ success: true, data: { user: safeUser(user), profile } });
  } catch (err) { next(err); }
});

/* POST /api/auth/logout */
router.post('/logout', authenticate, (req, res) => {
  res.json({ success: true, message: 'Logout berhasil.' });
});

module.exports = router;
