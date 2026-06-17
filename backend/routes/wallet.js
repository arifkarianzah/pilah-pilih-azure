/* =====================================================
   ROUTES – Wallet (async sqlite3)
   ===================================================== */
'use strict';
const router = require('express').Router();
const { body } = require('express-validator');
const db = require('../database/db');
const { uuidv4 } = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');

router.get('/balance', authenticate, async (req, res, next) => {
  try {
    const profile  = await db.get('SELECT wallet_balance, escrow_balance, total_income FROM user_profiles WHERE user_id = ?', [req.user.id]);
    const totalOut = await db.get(`SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE user_id = ? AND type = 'debit' AND status = 'completed'`, [req.user.id]);
    const totalIn  = await db.get(`SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions WHERE user_id = ? AND type = 'credit' AND status = 'completed' AND description LIKE '%Top Up%'`, [req.user.id]);
    res.json({ success: true, data: { balance: profile?.wallet_balance||0, escrow_balance: profile?.escrow_balance||0, total_income: profile?.total_income||0, total_out: totalOut.total, total_topup: totalIn.total } });
  } catch (err) { next(err); }
});

router.get('/history', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM wallet_transactions WHERE user_id = ?';
    const params = [req.user.id];
    if (type) { query += ' AND type = ?'; params.push(type); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const history = await db.all(query, params);
    const total   = (await db.get('SELECT COUNT(*) as c FROM wallet_transactions WHERE user_id = ?', [req.user.id])).c;
    res.json({ success: true, data: history, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total/limit) } });
  } catch (err) { next(err); }
});

router.post('/withdraw', authenticate, authorize('user'),
  [
    body('amount').isInt({ min: 50000 }).withMessage('Minimal penarikan Rp 50.000'),
    body('method').isIn(['dana','ovo','gopay','shopeepay','bank_transfer']),
    body('account_number').trim().notEmpty(),
    body('account_name').trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { amount, method, account_number } = req.body;
      const profile = await db.get('SELECT wallet_balance FROM user_profiles WHERE user_id = ?', [req.user.id]);
      if (!profile || profile.wallet_balance < amount) {
        return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi.' });
      }

      await db.run('UPDATE user_profiles SET wallet_balance = wallet_balance - ? WHERE user_id = ?', [amount, req.user.id]);
      const wtId = uuidv4();
      await db.run(
        'INSERT INTO wallet_transactions (id,user_id,type,amount,description,method,status) VALUES (?,?,?,?,?,?,?)',
        [wtId, req.user.id, 'debit', amount, `Penarikan ke ${method.toUpperCase()} (${account_number})`, method, 'pending']
      );
      await db.run('INSERT INTO notifications (id,user_id,title,body,type) VALUES (?,?,?,?,?)',
        [uuidv4(), req.user.id, '⬆️ Penarikan Diproses',
         `Rp ${amount.toLocaleString('id-ID')} sedang diproses ke ${method.toUpperCase()} ${account_number}`, 'wallet']);

      const updatedBalance = await db.get('SELECT wallet_balance FROM user_profiles WHERE user_id = ?', [req.user.id]);
      res.json({ success: true, message: 'Penarikan sedang diproses.', data: { remaining_balance: updatedBalance.wallet_balance } });
    } catch (err) { next(err); }
  }
);

router.post('/topup', authenticate, authorize('bank_sampah', 'admin'),
  [
    body('amount').isInt({ min: 50000 }).withMessage('Minimal top up Rp 50.000')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { amount } = req.body;
      const result = await db.run('UPDATE user_profiles SET wallet_balance = COALESCE(wallet_balance, 0) + ? WHERE user_id = ?', [amount, req.user.id]);
      
      const row = await db.get('SELECT wallet_balance FROM user_profiles WHERE user_id = ?', [req.user.id]);
      console.log('TOPUP BALANCE AFTER:', row);
      await db.run(
        'INSERT INTO wallet_transactions (id,user_id,type,amount,description,status) VALUES (?,?,?,?,?,?)',
        [uuidv4(), req.user.id, 'credit', amount, `Top Up Saldo Pengepul`, 'completed']
      );
      res.json({ success: true, message: 'Top Up berhasil' });
    } catch (err) { 
      console.error('TOPUP ERR:', err);
      next(err); 
    }
  }
);

router.get('/transactions', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const data = await db.all(
      `SELECT wt.*, u.name as user_name, u.email FROM wallet_transactions wt JOIN users u ON wt.user_id = u.id ORDER BY wt.created_at DESC LIMIT 200`
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
