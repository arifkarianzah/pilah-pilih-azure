'use strict';

document.addEventListener('DOMContentLoaded', () => {
  if (!API.Storage.getToken()) {
    window.location.href = 'login.html';
    return;
  }
  
  goPage('home');
});

async function goPage(id) {
  try {
    if (id === 'profile') id = 'home'; // Fallback
    
    // Map IDs to actual filenames
    const map = {
      'home': 'pengepul-home',
      'dompet': 'pengepul-dompet',
      'stok': 'pengepul-stok',
      'jadwal': 'pengepul-jadwal',
      'konfirmasi': 'pengepul-konfirmasi',
      'laporan': 'pengepul-laporan',
      'riwayat': 'pengepul-riwayat',
      'notifikasi': 'notifikasi',
      'profil': 'edit-profil'
    };
    
    const fetchId = map[id] || id;
    const basePath = (fetchId === 'edit-profil' || fetchId === 'notifikasi') ? 'views' : 'views/pengepul';
    
    const res = await fetch(`${basePath}/${fetchId}.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Not found');
    
    const html = await res.text();
    document.getElementById('app-root').innerHTML = html;
    window.scrollTo(0, 0);
    
    // Update Active Nav
    document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
    document.getElementById(`nav-${id}`)?.classList.add('active');

    // Run Initialization based on page
    if (id === 'home') {
      const user = API.Storage.getUser();
      if (user) {
        const uName = document.getElementById('userName');
        const uAv = document.getElementById('userAv');
        if (uName) uName.textContent = user.name;
        if (uAv) uAv.textContent = user.name.charAt(0).toUpperCase();
      }
      loadWalletData();
      if(typeof loadHomeHistory === 'function') loadHomeHistory();
    } else if (id === 'stok') {
      loadStockData();
    } else if (id === 'dompet') {
      loadWalletData();
      if(typeof loadWalletHistory === 'function') loadWalletHistory();
    } else if (id === 'jadwal' || id === 'konfirmasi' || id === 'laporan' || id === 'riwayat') {
      loadTransactions();
    } else if (id === 'profil') {
      if (typeof loadProfileData === 'function') loadProfileData();
    }

  } catch (err) {
    showToast(`⚠️ Halaman "${id}" gagal dimuat`);
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

async function loadWalletData() {
  try {
    const res = await API.Wallet.getBalance();
    if(res.success) {
      const elTersedia = document.getElementById('valTersedia') || document.getElementById('dompetTersedia');
      const elDitahan = document.getElementById('valDitahan') || document.getElementById('dompetDitahan');
      if (elTersedia) elTersedia.textContent = `Rp ${res.data.balance.toLocaleString('id-ID')}`;
      if (elDitahan) elDitahan.textContent = `Rp ${res.data.escrow_balance.toLocaleString('id-ID')}`;
    }
  } catch (e) {
    console.error('Wallet error', e);
  }
}

async function loadStockData() {
  try {
    const res = await fetch('http://localhost:5000/api/categories');
    const data = await res.json();
    if(data.success) {
      const grid = document.getElementById('stockGrid') || document.getElementById('stokPageGrid');
      if(grid) {
        // Professional styling applied directly or via classes
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.gap = '12px';
        grid.innerHTML = data.data.map(c => {
          const stock = c.stock_kg || 0;
          return `
          <div class="prof-stock-item" style="display:flex; justify-content:space-between; align-items:center; padding:16px; background:var(--card2); border:1px solid var(--border); border-radius:12px; cursor:pointer;" onclick="openBuyModal('${c.id}', '${c.name}', ${stock}, ${c.price_per_kg})">
            <div>
              <h4 style="margin:0 0 4px 0; color:var(--t1); font-size:15px; font-weight:600;">${c.name}</h4>
              <p style="margin:0; color:var(--t4); font-size:13px;">Rp ${c.price_per_kg.toLocaleString('id-ID')} / kg</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:0; color:var(--t4); font-size:12px;">Stok Tersedia</p>
              <p style="margin:0; color:var(--primary); font-size:16px; font-weight:700;">${stock} <span style="font-size:12px; font-weight:normal;">kg</span></p>
            </div>
          </div>
        `}).join('');
      }
    }
  } catch(e) {
    console.error('Stock error', e);
  }
}

// ==================== TOP UP ====================
function showTopupModal() {
  document.getElementById('topupStep1').style.display = 'block';
  document.getElementById('topupStep2').style.display = 'none';
  document.getElementById('topupAmount').value = '';
  document.getElementById('topupBank').value = 'BCA';
  showModal('modalTopup');
}

function nextTopupStep() {
  const amt = parseInt(document.getElementById('topupAmount').value);
  if(!amt || amt < 50000) return showToast('Minimal top up Rp 50.000');
  
  const bank = document.getElementById('topupBank').value;
  let vaName = bank + " VIRTUAL ACCOUNT";
  if (bank === 'BRI') vaName = "BRI BRIVA";
  
  // Generate random VA number for simulation
  const vaNumber = "8077 " + Math.floor(1000 + Math.random() * 9000) + " " + Math.floor(1000 + Math.random() * 9000);
  
  document.getElementById('lblTopupBank').textContent = vaName;
  document.getElementById('lblTopupVA').textContent = vaNumber;
  document.getElementById('lblTopupAmount').textContent = `Rp ${amt.toLocaleString('id-ID')}`;
  
  document.getElementById('topupStep1').style.display = 'none';
  document.getElementById('topupStep2').style.display = 'block';
}

async function simulatePayment() {
  const btn = document.getElementById('btnSimulatePay');
  btn.textContent = 'Memverifikasi...';
  btn.disabled = true;
  
  const amt = parseInt(document.getElementById('topupAmount').value);
  
  // Simulate delay
  await new Promise(r => setTimeout(r, 1500));
  
  try {
    const res = await fetch('http://localhost:5000/api/wallet/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.Storage.getToken()}` },
      body: JSON.stringify({ amount: amt })
    });
    const data = await res.json();
    
    btn.textContent = 'Saya Sudah Bayar';
    btn.disabled = false;
    
    if(data.success) {
      showToast('✅ Pembayaran Berhasil Diterima!');
      closeModal('modalTopup');
      
      // Update UI Instantly to feel real
      const elTersedia = document.getElementById('valTersedia') || document.getElementById('dompetTersedia');
      if (elTersedia) {
        let currentText = elTersedia.textContent.replace(/[^0-9]/g, '');
        let currentBalance = parseInt(currentText) || 0;
        let newBalance = currentBalance + amt;
        elTersedia.textContent = `Rp ${newBalance.toLocaleString('id-ID')}`;
      }
      
      loadWalletData();
      if(typeof loadWalletHistory === 'function') loadWalletHistory();
    } else {
      showToast('Gagal: ' + data.message);
    }
  } catch (e) {
    btn.textContent = 'Saya Sudah Bayar';
    btn.disabled = false;
    showToast('Terjadi kesalahan jaringan');
  }
}

// ==================== BELI SAMPAH ====================
let currentStock = 0;

async function loadHomeHistory() {
  const container = document.getElementById('homeRecentTrx');
  if(!container) return;
  
  try {
    const res = await API.Wallet.getHistory({ limit: 3 });
    if(res.success && res.data.length > 0) {
      container.innerHTML = res.data.map(trx => {
        const isCredit = trx.type === 'credit';
        const color = isCredit ? 'var(--primary)' : 'var(--t1)';
        const sign = isCredit ? '+' : '-';
        return `
          <div style="background: var(--card2); border: 1px solid var(--border); padding: 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="font-size: 14px; font-weight: 600; color: var(--t1); margin: 0 0 4px 0;">${trx.description}</p>
              <p style="font-size: 12px; color: var(--t4); margin: 0;">${API.Format.datetime(trx.created_at)}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 15px; font-weight: 700; color: ${color}; margin: 0;">${sign}Rp ${trx.amount.toLocaleString('id-ID')}</p>
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div style="background: var(--card2); border: 1px solid var(--border); padding: 16px; border-radius: 12px; text-align: center; color: var(--t4); font-size: 13px;">
          Belum ada transaksi.
        </div>
      `;
    }
  } catch (e) {
    console.error('Failed to load home history', e);
  }
}

async function loadWalletHistory() {
  const container = document.getElementById('topupHistory');
  if(!container) return;
  
  try {
    const res = await API.Wallet.getHistory({ limit: 10 });
    if(res.success && res.data.length > 0) {
      container.innerHTML = res.data.map(trx => {
        const isCredit = trx.type === 'credit';
        const color = isCredit ? 'var(--primary)' : 'var(--t1)';
        const sign = isCredit ? '+' : '-';
        return `
          <div style="background: var(--card2); border: 1px solid var(--border); padding: 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="font-size: 14px; font-weight: 600; color: var(--t1); margin: 0 0 4px 0;">${trx.description}</p>
              <p style="font-size: 12px; color: var(--t4); margin: 0;">${API.Format.datetime(trx.created_at)}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 15px; font-weight: 700; color: ${color}; margin: 0;">${sign}Rp ${trx.amount.toLocaleString('id-ID')}</p>
              <p style="font-size: 11px; color: var(--primary); margin: 4px 0 0 0; background: rgba(0,208,132,0.1); padding: 2px 8px; border-radius: 99px; display: inline-block;">Berhasil</p>
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div style="background: var(--card2); border: 1px solid var(--border); padding: 16px; border-radius: 12px; text-align: center; color: var(--t4); font-size: 13px;">
          Riwayat top up belum tersedia.
        </div>
      `;
    }
  } catch (e) {
    console.error('Failed to load wallet history', e);
  }
}

function openBuyModal(id, name, stock, price) {
  if (stock <= 0) return showToast('Stok kosong!');
  document.getElementById('buyCategoryId').value = id;
  document.getElementById('buyTitle').textContent = `Beli ${name}`;
  document.getElementById('buyMaxStock').textContent = stock;
  document.getElementById('buyWeight').value = '';
  document.getElementById('buyPrice').value = price;
  document.getElementById('buyTotal').textContent = 'Rp 0';
  currentStock = stock;
  showModal('modalBuy');
}

function calcBuyTotal() {
  const w = parseFloat(document.getElementById('buyWeight').value) || 0;
  const p = parseInt(document.getElementById('buyPrice').value) || 0;
  document.getElementById('buyTotal').textContent = `Rp ${(w*p).toLocaleString('id-ID')}`;
}

async function submitBuy(isDraft) {
  const cid = document.getElementById('buyCategoryId').value;
  const weight = parseFloat(document.getElementById('buyWeight').value);
  const price = parseInt(document.getElementById('buyPrice').value);
  
  if(!weight || weight <= 0 || weight > currentStock) return showToast('Berat tidak valid');
  if(!price || price <= 0) return showToast('Harga tidak valid');

  try {
    const res = await fetch('http://localhost:5000/api/pengepul/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.Storage.getToken()}` },
      body: JSON.stringify({
        category_id: cid,
        estimated_weight: weight,
        price_per_kg: price,
        is_draft: isDraft
      })
    });
    const data = await res.json();
    if(data.success) {
      showToast(isDraft ? 'Draft disimpan' : 'Pengajuan berhasil!');
      closeModal('modalBuy');
      loadWalletData();
      loadStockData();
    } else {
      showToast(data.message); // E.g., Saldo tidak mencukupi
    }
  } catch (e) {
    showToast('Terjadi kesalahan');
  }
}

// ==================== TRANSACTIONS ====================
async function loadTransactions() {
  try {
    const res = await fetch('http://localhost:5000/api/pengepul/transactions', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    if(data.success) {
      const listRiwayat = document.getElementById('trxList');
      const listJadwal = document.getElementById('jadwalList');
      const listKonfirmasi = document.getElementById('konfirmasiList');
      const lapTotalBeli = document.getElementById('lapTotalBeli');
      
      // Calculate Laporan
      if (lapTotalBeli) {
        let totalKg = 0;
        let totalRp = 0;
        data.data.forEach(t => {
          if (t.status === 'DIBAYAR' || t.status === 'DIVERIFIKASI') {
            totalKg += (t.actual_weight || t.estimated_weight || 0);
            totalRp += (t.total_price || 0);
          }
        });
        lapTotalBeli.textContent = `${totalKg} Kg`;
        document.getElementById('lapTotalPengeluaran').textContent = `Rp ${totalRp.toLocaleString('id-ID')}`;
        return;
      }
      
      let targetList = listRiwayat || listJadwal || listKonfirmasi;
      if (!targetList) return;
      
      let filteredData = data.data;
      if (listJadwal) {
        filteredData = data.data.filter(t => ['PERSETUJUAN', 'DIJADWALKAN'].includes(t.status));
      } else if (listKonfirmasi) {
        filteredData = data.data.filter(t => ['DALAM_PERJALANAN', 'DITERIMA', 'DIVERIFIKASI'].includes(t.status));
      }
      
      if(filteredData.length === 0) {
        let emptyText = "Belum ada riwayat transaksi.";
        let emptyDesc = "Transaksi Anda akan muncul di sini.";
        let actionBtn = "";
        
        if (listJadwal) {
          emptyText = "Tidak ada jadwal pickup.";
          emptyDesc = "Anda belum memiliki pembelian yang disetujui. Silakan beli stok sampah terlebih dahulu.";
          actionBtn = `<button class="btn-primary" style="margin-top:16px;" onclick="goPage('stok')">Lihat Stok Gudang</button>`;
        } else if (listKonfirmasi) {
          emptyText = "Belum ada barang untuk dikonfirmasi.";
          emptyDesc = "Barang yang sedang dalam perjalanan akan muncul di sini.";
        }

        targetList.innerHTML = `
          <div style="text-align:center; padding:48px 24px; background:var(--card2); border:1px solid var(--border); border-radius:16px;">
            <div style="width:64px; height:64px; border-radius:50%; background:rgba(59, 130, 246, 0.1); color:var(--primary); display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
            </div>
            <h4 style="color:var(--t1); margin:0 0 8px; font-size:16px;">${emptyText}</h4>
            <p style="color:var(--t4); margin:0; font-size:14px; line-height:1.5;">${emptyDesc}</p>
            ${actionBtn}
          </div>
        `;
        return;
      }
      
      targetList.innerHTML = filteredData.map(t => `
        <div class="history-card-p ${t.status === 'DIBAYAR' ? 'done' : ''}" style="margin-bottom: 12px;">
          <div class="hcp-hdr">
            <span>ID: ${t.id.substring(0,8).toUpperCase()}</span>
            <div class="status-pill ${t.status === 'DIBAYAR' ? 'active' : ''}" style="font-size: 10px; padding: 2px 8px;">${t.status}</div>
          </div>
          <div class="hcp-body">
            <p style="font-size: 14px; font-weight: 700; color: white;">${t.category_icon} ${t.category_name} - ${t.estimated_weight}kg</p>
            <p>Harga Penawaran: Rp${t.price_per_kg}/kg</p>
            <p>Total: <strong style="color:var(--primary);">Rp${t.total_price.toLocaleString('id-ID')}</strong></p>
          </div>
          
          ${getTimelineHtml(t.status)}
          
          <div style="margin-top: 12px;">
            ${getActionButtons(t)}
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Fetch trx error', e);
  }
}

const FLOW = ['DRAFT','PENGAJUAN','PERSETUJUAN','DIJADWALKAN','DIVERIFIKASI','DIBAYAR'];
function getTimelineHtml(status) {
  const idx = FLOW.indexOf(status);
  let html = `<div class="small-steps" style="overflow-x: auto; padding-bottom: 8px;">`;
  FLOW.forEach((step, i) => {
    let state = '';
    if (i < idx) state = 'done';
    else if (i === idx) state = 'active';
    
    html += `
      <div class="ss-item ${state}">
        <span>${i + 1}</span>
        <p>${step.substring(0,6)}..</p>
      </div>
    `;
    if (i < FLOW.length - 1) {
      html += `<div class="ss-line ${i < idx ? 'done' : ''}"></div>`;
    }
  });
  html += `</div>`;
  return html;
}

function getActionButtons(t) {
  let html = `<div style="display:flex; gap:8px;">`;
  
  if (t.status === 'DRAFT') {
    html += `<button class="btn-primary" style="flex:1; padding:8px; font-size:12px;" onclick="updateStatus('${t.id}', 'PENGAJUAN')">Kirim Pengajuan</button>`;
  } else if (t.status === 'PERSETUJUAN') {
    html += `<button class="btn-primary" style="flex:1; padding:8px; font-size:12px;" onclick="openScheduleModal('${t.id}')">Jadwalkan Pickup</button>`;
  } else if (t.status === 'DITERIMA') {
    html += `<button class="btn-primary" style="flex:1; padding:8px; font-size:12px;" onclick="openVerifyModal('${t.id}')">Verifikasi Berat</button>`;
  } else if (t.status === 'DIVERIFIKASI') {
    html += `<button class="btn-primary" style="flex:1; padding:8px; font-size:12px;" onclick="payTransaction('${t.id}')">Konfirmasi & Bayar</button>`;
  } else if (t.status === 'DIJADWALKAN') {
    html += `<button class="btn-primary" style="flex:1; padding:8px; font-size:12px;" onclick="updateStatus('${t.id}', 'DALAM_PERJALANAN')">Mulai Perjalanan</button>`;
  } else if (t.status === 'DALAM_PERJALANAN') {
    html += `<button class="btn-primary" style="flex:1; padding:8px; font-size:12px;" onclick="updateStatus('${t.id}', 'DITERIMA')">Sampah Diterima</button>`;
  } else {
    html += `<div style="flex:1; text-align:center; padding:8px; font-size:12px; color:var(--text-secondary);">Menunggu aksi...</div>`;
  }
  
  html += `</div>`;
  return html;
}

async function updateStatus(id, newStatus) {
  try {
    const res = await fetch(`http://localhost:5000/api/pengepul/transactions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.Storage.getToken()}` },
      body: JSON.stringify({ status: newStatus })
    });
    if((await res.json()).success) {
      showToast('Status diperbarui');
      loadTransactions();
      loadWalletData();
    }
  } catch (e) {}
}

function openScheduleModal(id) {
  document.getElementById('scheduleTrxId').value = id;
  showModal('modalSchedule');
}

async function submitSchedule() {
  const id = document.getElementById('scheduleTrxId').value;
  const body = {
    pickup_date: document.getElementById('schDate').value,
    pickup_time: document.getElementById('schTime').value,
    driver_name: document.getElementById('schDriver').value,
    vehicle_plate: document.getElementById('schPlate').value
  };
  
  try {
    const res = await fetch(`http://localhost:5000/api/pengepul/transactions/${id}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.Storage.getToken()}` },
      body: JSON.stringify(body)
    });
    if((await res.json()).success) {
      showToast('Jadwal diatur');
      closeModal('modalSchedule');
      loadTransactions();
    }
  } catch (e) {}
}

function openVerifyModal(id) {
  document.getElementById('verifyTrxId').value = id;
  document.getElementById('vrfActualWeight').value = '';
  document.getElementById('vrfNotes').value = '';
  showModal('modalVerify');
}

async function submitVerify() {
  const id = document.getElementById('verifyTrxId').value;
  const actual_weight = parseFloat(document.getElementById('vrfActualWeight').value);
  const notes = document.getElementById('vrfNotes').value;

  if(!actual_weight || actual_weight <= 0) return showToast('Berat aktual tidak valid');

  try {
    const res = await fetch(`http://localhost:5000/api/pengepul/transactions/${id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.Storage.getToken()}` },
      body: JSON.stringify({ actual_weight, verification_notes: notes })
    });
    if((await res.json()).success) {
      showToast('Verifikasi disimpan');
      closeModal('modalVerify');
      loadTransactions();
    }
  } catch (e) {}
}

async function payTransaction(id) {
  // Hanya bisa dipanggil kalau status DIVERIFIKASI
  // Akan memanggil endpoint /pay (yg seharusnya butuh admin token) 
  // WAIT, untuk demo Pengepul yang trigger bayar? Atau Admin?
  // Di spesifikasi: Pengepul -> Bayar User -> Status = DIBAYAR.
  // Jadi kita ubah auth route /pay bisa bank_sampah.
  try {
    const res = await fetch(`http://localhost:5000/api/pengepul/transactions/${id}/pay`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    if(data.success) {
      showToast('Pembayaran berhasil!');
      loadTransactions();
      loadWalletData();
      loadStockData();
    } else {
      showToast('Gagal: ' + data.message);
    }
  } catch (e) {}
}
