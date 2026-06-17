/* =====================================================
   MIDDLEWARE – Error Handler
   ===================================================== */
'use strict';

const { validationResult } = require('express-validator');

/**
 * Validasi express-validator
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validasi gagal',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.error(err);

  // SQLite constraint error
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ success: false, message: 'Data sudah terdaftar (duplikat).' });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Token tidak valid.' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan server.'
  });
}

/**
 * 404 handler
 */
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} tidak ditemukan.` });
}

module.exports = { validate, errorHandler, notFound };
