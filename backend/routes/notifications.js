/* =====================================================
   ROUTES – Notifications (async sqlite3)
   ===================================================== */
'use strict';
const router = require('express').Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const notifs = await db.all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, Number(limit), Number(offset)]
    );
    const unread = (await db.get('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id])).c;
    res.json({ success: true, data: notifs, unread_count: unread });
  } catch (err) { next(err); }
});

router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: 'Semua notifikasi dibaca.' });
  } catch (err) { next(err); }
});

router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Notifikasi dibaca.' });
  } catch (err) { next(err); }
});

module.exports = router;
