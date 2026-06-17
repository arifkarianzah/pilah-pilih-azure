/* =====================================================
   ROUTES – Categories (async sqlite3)
   ===================================================== */
'use strict';
const router = require('express').Router();
const { body } = require('express-validator');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');

router.get('/', async (req, res, next) => {
  try {
    const cats = await db.all('SELECT * FROM waste_categories WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, data: cats });
  } catch (err) { next(err); }
});

router.get('/prices/latest', async (req, res, next) => {
  try {
    const prices = await db.all('SELECT * FROM waste_categories WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, data: prices, updated_at: new Date().toISOString() });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const cat = await db.get('SELECT * FROM waste_categories WHERE id = ?', [req.params.id]);
    if (!cat) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
    const history = await db.all(
      'SELECT ph.*, u.name as changed_by_name FROM price_history ph LEFT JOIN users u ON ph.changed_by = u.id WHERE ph.category_id = ? ORDER BY ph.changed_at DESC LIMIT 20',
      [req.params.id]
    );
    res.json({ success: true, data: { ...cat, price_history: history } });
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('admin'),
  [body('name').notEmpty(), body('icon').notEmpty(), body('price_per_kg').isInt({ min: 100 })],
  validate,
  async (req, res, next) => {
    try {
      const { name, icon, price_per_kg, description } = req.body;
      const result = await db.run('INSERT INTO waste_categories (name, icon, price_per_kg, description) VALUES (?,?,?,?)',
        [name, icon, price_per_kg, description || null]);
      const cat = await db.get('SELECT * FROM waste_categories WHERE id = ?', [result.lastID]);
      res.status(201).json({ success: true, data: cat });
    } catch (err) { next(err); }
  }
);

router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name, icon, price_per_kg, description, is_active } = req.body;
    await db.run(
      `UPDATE waste_categories SET name=COALESCE(?,name), icon=COALESCE(?,icon),
       price_per_kg=COALESCE(?,price_per_kg), description=COALESCE(?,description),
       is_active=COALESCE(?,is_active) WHERE id=?`,
      [name||null, icon||null, price_per_kg||null, description||null,
       is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id]
    );
    const updated = await db.get('SELECT * FROM waste_categories WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
