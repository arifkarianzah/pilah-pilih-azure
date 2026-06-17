/* =====================================================
   MIDDLEWARE – Auth JWT
   ===================================================== */
'use strict';

const jwt = require('jsonwebtoken');
const db  = require('../database/db');

/**
 * Verifikasi JWT Token dari header Authorization
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan. Silakan login.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.get('SELECT id, role, is_active FROM users WHERE id = ?', [decoded.id]);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Akun tidak aktif atau tidak ditemukan.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kedaluwarsa.' });
  }
}

/**
 * Cek role tertentu
 * Contoh: authorize('admin') atau authorize('admin','petugas')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Hanya untuk: ${roles.join(', ')}`
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
