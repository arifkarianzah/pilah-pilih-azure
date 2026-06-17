const db = require('./backend/database/db');
const bcrypt = require('bcryptjs');

async function patchDb() {
  console.log('Patching DB...');
  
  // 1. Update categories prices for Pekanbaru
  await db.run("UPDATE waste_categories SET price_per_kg = 2500, description = 'Botol plastik, botol air mineral (Pekanbaru)' WHERE name = 'Plastik PET'");
  await db.run("UPDATE waste_categories SET price_per_kg = 1200, description = 'Kertas bekas kantor, koran' WHERE name = 'Kertas / HVS'");
  await db.run("UPDATE waste_categories SET price_per_kg = 1800, description = 'Kardus tebal, karton kemasan' WHERE name = 'Kardus'");
  await db.run("UPDATE waste_categories SET price_per_kg = 2000, description = 'Kaleng susu, sarden' WHERE name = 'Kaleng Besi'");
  await db.run("UPDATE waste_categories SET price_per_kg = 5000, description = 'Besi tua, tembaga, kuningan (Harga Tinggi)' WHERE name = 'Besi / Logam'");
  await db.run("UPDATE waste_categories SET price_per_kg = 300 WHERE name = 'Botol Kaca'");
  await db.run("UPDATE waste_categories SET price_per_kg = 35000 WHERE name = 'Elektronik'");
  await db.run("UPDATE waste_categories SET price_per_kg = 4000 WHERE name = 'Minyak Jelantah'");
  await db.run("UPDATE waste_categories SET price_per_kg = 1500 WHERE name = 'Baterai Bekas'");
  console.log('Categories updated.');

  // 2. Add bank_sampah users if not exists
  const hash = bcrypt.hashSync('password123', 10);
  try {
      await db.run("UPDATE users SET name = 'Bank Sampah Maju', address = 'Pekanbaru Kota', city = 'Pekanbaru' WHERE id = 'usr-003'");
      await db.run("UPDATE users SET address = 'Kantor Pusat Pilah Pilih', city = 'Pekanbaru' WHERE id = 'usr-004'");
      await db.run("UPDATE users SET name = 'Bank Sampah Rumbai', email = 'rumbai@example.com', role = 'bank_sampah', address = 'Rumbai', city = 'Pekanbaru' WHERE id = 'usr-005'");
  } catch(e) {
      console.log('Users already patched', e.message);
  }

  // 3. Insert articles
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
    console.log('Articles inserted.');
  }

  console.log('Patch completed!');
}

patchDb().then(() => setTimeout(() => process.exit(0), 500)).catch(console.error);
