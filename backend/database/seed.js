/* =====================================================
   SEED DATA – async sqlite3
   ===================================================== */
'use strict';


const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import db module
const db = require('./db');

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function seed() {
  console.log('🌱 Mulai seeding database Pilah Pilih...\n');

  // Tunggu schema selesai
  await new Promise(r => setTimeout(r, 1000));

  /* ── 1. Waste Categories ── */
  const catCount = await db.get('SELECT COUNT(*) as c FROM waste_categories');
  if (catCount.c === 0) {
    const categories = [
      ['Plastik PET',    '♻️',  2500, 'Botol plastik, botol air mineral (Pekanbaru)'],
      ['Kertas / HVS',   '📄',  1200, 'Kertas bekas kantor, koran'],
      ['Kardus Bekas',   '📦',  1800, 'Kardus tebal, karton kemasan'],
      ['Kaleng Besi',    '🥫',  2000, 'Kaleng susu, sarden'],
      ['Besi / Logam',   '🔩',  5000, 'Besi tua, tembaga, kuningan (Harga Tinggi)'],
      ['Botol Kaca',     '🍶',   300, 'Botol sirup, kecap'],
      ['Elektronik',     '💻', 35000, 'Papan sirkuit, CPU bekas'],
      ['Minyak Jelantah','🫙',  4000, 'Minyak jelantah jernih/kotor per liter'],
      ['Baterai Bekas',  '🔋',  1500, 'Baterai rumah tangga'],
    ];
    for (const [name, icon, price, desc] of categories) {
      await db.run('INSERT INTO waste_categories (name, icon, price_per_kg, description) VALUES (?,?,?,?)',
        [name, icon, price, desc]);
    }
    console.log('  ✅ Waste categories inserted:', categories.length);
  }

  /* ── 2. Users ── */
  const hasUsr = await db.get("SELECT id FROM users WHERE id = 'usr-001'");
  if (!hasUsr) {
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const users = [
      ['usr-001', 'Rizki Dinata',       'rizki@example.com',   '081234567890', hash('password123'), 'user',        1, 'Jl. Sudirman No.45',     'Jakarta'],
      ['usr-002', 'Budi Wahyono',       'budi@example.com',    '081234567891', hash('password123'), 'petugas',     1, 'Jl. Merdeka No.12',      'Jakarta'],
      ['usr-003', 'Bank Sampah Maju', 'bank@example.com',    '081234567892', hash('password123'), 'bank_sampah', 1, 'Pekanbaru Kota',      'Pekanbaru'],
      ['usr-004', 'Admin System',       'admin@pilahpilih.id', '081234567893', hash('admin2025'),   'admin',       1, 'Kantor Pusat Pilah Pilih','Pekanbaru'],
      ['usr-005', 'Bank Sampah Rumbai','rumbai@example.com', '081234567894', hash('password123'), 'bank_sampah', 1, 'Rumbai',      'Pekanbaru'],
    ];
    for (const u of users) {
      await db.run(
        'INSERT INTO users (id,name,email,phone,password,role,is_verified,address,city) VALUES (?,?,?,?,?,?,?,?,?)', u);
    }

    const profiles = [
      ['usr-001', 'gold',     680, 2450, 124.0, 847000,    28, 62.4, 847500],
      ['usr-002', 'silver',   320, 1200,     0,      0,     0,    0,      0],
      ['usr-003', 'gold',     500, 3000, 500.0, 2500000,    0,  250, 2500000],
      ['usr-004', 'platinum', 999, 9999,9999.0,99000000,    0, 9999,       0],
      ['usr-005', 'bronze',   120,  450,  25.0,  150000,    5, 12.5, 150000],
    ];
    for (const [user_id, level, xp, points, kg, income, pickups, carbon, wallet] of profiles) {
      await db.run(
        'INSERT INTO user_profiles (user_id,level,xp,points,total_sold_kg,total_income,total_pickups,carbon_saved,wallet_balance) VALUES (?,?,?,?,?,?,?,?,?)',
        [user_id, level, xp, points, kg, income, pickups, carbon, wallet]
      );
    }
    console.log('  ✅ Users inserted: 5');
  }

  /* ── 3. Rewards ── */
  const rewardCount = await db.get('SELECT COUNT(*) as c FROM rewards');
  if (rewardCount.c === 0) {
    const rewards = [
      ['Pulsa 10K',     '📱', 'pulsa',       500, 200, 'Pulsa Telkomsel/Indosat/XL 10.000'],
      ['Pulsa 25K',     '📱', 'pulsa',      1200, 150, 'Pulsa semua operator 25.000'],
      ['DANA 20K',      '💳', 'ewallet',     800, 100, 'Saldo DANA 20.000'],
      ['OVO 15K',       '💜', 'ewallet',     700, 100, 'Saldo OVO 15.000'],
      ['GoPay 25K',     '💚', 'ewallet',    1000, 100, 'Saldo GoPay 25.000'],
      ['ShopeePay 20K', '🧡', 'ewallet',     850, 100, 'Saldo ShopeePay 20.000'],
      ['Voucher 50K',   '🎟', 'voucher',    2000,  50, 'Voucher belanja partner 50.000'],
      ['Tote Bag Eco',  '👜', 'merchandise', 500, 100, 'Tas ramah lingkungan Pilah Pilih'],
      ['Tanam Pohon',   '🌱', 'donation',    300,9999, 'Donasi tanam 1 pohon bersama mitra'],
    ];
    for (const [name, icon, cat, pts, stock, desc] of rewards) {
      await db.run('INSERT INTO rewards (name,icon,category,cost_points,stock,description) VALUES (?,?,?,?,?,?)',
        [name, icon, cat, pts, stock, desc]);
    }
    console.log('  ✅ Rewards inserted:', rewards.length);
  }

  /* ── 4. Sample Transactions ── */
  const trxCount = await db.get('SELECT COUNT(*) as c FROM transactions');
  if (trxCount.c === 0) {
    const trxs = [
      ['trx-001','usr-001','usr-002',1,'Plastik PET', 2.5, 2000,  5000, 25,'bersih',  'Jl. Sudirman No.45','completed'],
      ['trx-002','usr-001','usr-002',3,'Kardus',       5.0, 1500,  7500, 50,'bersih',  'Jl. Sudirman No.45','completed'],
      ['trx-003','usr-001','usr-002',8,'Laptop Bekas', 3.2,30000, 96000,320,'campuran','Jl. Sudirman No.45','on_way'],
      ['trx-004','usr-005',null,     1,'Botol Plastik',1.0, 2000,  2000, 20,'bersih',  'Jl. Kenanga No.22', 'pending'],
    ];
    for (const [id,uid,pid,cid,wname,wkg,ppkg,total,pts,cond,addr,status] of trxs) {
      await db.run(
        'INSERT INTO transactions (id,user_id,petugas_id,category_id,waste_name,weight_kg,price_per_kg,total_price,points_earned,`condition`,address,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [id,uid,pid,cid,wname,wkg,ppkg,total,pts,cond,addr,status]
      );
    }

    const pickups = [
      ['pkp-001','trx-001','usr-002','usr-001','ORD-20250608-001','Jl. Sudirman No.45','completed'],
      ['pkp-002','trx-002','usr-002','usr-001','ORD-20250606-002','Jl. Sudirman No.45','completed'],
      ['pkp-003','trx-003','usr-002','usr-001','ORD-20250602-003','Jl. Sudirman No.45','on_way'],
      ['pkp-004','trx-004',null,     'usr-005','ORD-20250609-004','Jl. Kenanga No.22', 'waiting'],
    ];
    for (const [id,tid,pid,uid,onum,addr,status] of pickups) {
      await db.run(
        'INSERT INTO pickups (id,transaction_id,petugas_id,user_id,order_number,address,status) VALUES (?,?,?,?,?,?,?)',
        [id,tid,pid,uid,onum,addr,status]
      );
    }
    console.log('  ✅ Sample transactions & pickups inserted');
  }

  /* ── 5. Notifications ── */
  const notifCount = await db.get('SELECT COUNT(*) as c FROM notifications');
  if (notifCount.c === 0) {
    const notifs = [
      [uuidv4(),'usr-001','🚛 Petugas Dalam Perjalanan','Budi Wahyono sedang menuju lokasi Anda. ETA: 8 menit','pickup', 0],
      [uuidv4(),'usr-001','💰 Pembayaran Diterima','Rp 5.000 dari penjualan Plastik PET telah masuk','wallet', 0],
      [uuidv4(),'usr-001','⭐ Bonus Poin 2x!','Jual elektronik minggu ini dan dapat 2x poin!','reward', 0],
      [uuidv4(),'usr-001','✅ Pesanan Selesai','Penjualan kardus 5kg berhasil. +Rp 7.500, +50 pts','success',1],
    ];
    for (const [id,uid,title,body,type,read] of notifs) {
      await db.run('INSERT INTO notifications (id,user_id,title,body,type,is_read) VALUES (?,?,?,?,?,?)',
        [id,uid,title,body,type,read]);
    }
    console.log('  ✅ Notifications inserted');
  }

  /* ── 6. Articles ── */
  const articleCount = await db.get('SELECT COUNT(*) as c FROM articles');
  if (articleCount.c === 0) {
    const articles = [
      ['Cara Mengolah Sampah Organik di Rumah', 'Sampah organik seperti sisa sayur dapat diubah menjadi pupuk kompos...', 'https://picsum.photos/seed/a1/300/200', 'Tips & Trik', 'usr-004', 1200, 1],
      ['Dampak Buruk Sampah Plastik di Lautan', 'Plastik yang dibuang sembarangan bisa berakhir di lautan dan merusak ekosistem...', 'https://picsum.photos/seed/a2/300/200', 'Lingkungan', 'usr-004', 850, 1],
    ];
    for (const [title, content, thumb, cat, auth, views, pub] of articles) {
      await db.run('INSERT INTO articles (title,content,thumbnail,category,author_id,views,is_published) VALUES (?,?,?,?,?,?,?)',
        [title, content, thumb, cat, auth, views, pub]);
    }
    console.log('  ✅ Articles inserted');
  }

  console.log('\n🎉 Database seeding selesai!\n');
  console.log('📌 Akun test:');
  console.log('   User:        rizki@example.com   / password123');
  console.log('   Petugas:     budi@example.com    / password123');
  console.log('   Bank Sampah: bank@example.com    / password123');
  console.log('   Admin:       admin@pilahpilih.id / admin2025\n');
}

seed()
  .then(() => setTimeout(() => process.exit(0), 500))
  .catch(err => { console.error('❌ Seeding gagal:', err); process.exit(1); });
