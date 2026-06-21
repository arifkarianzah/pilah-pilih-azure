'use strict';
/* ================================================
   PILAH PILIH – Dashboard Petugas Logic v2.0
   ================================================ */

const PetugasApp = {
  isDark: true,
  wVal2: 2.8,
  hargaPerKg: 2000,
};

let mapInstance = null;

function initMap() {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  mapInstance = L.map('map').setView([0.5071, 101.4451], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(mapInstance);
  const petugasIcon = L.divIcon({ html: '🚛', className: 'map-marker', iconSize: [30, 30] });
  L.marker([0.5071, 101.4451], { icon: petugasIcon }).addTo(mapInstance)
    .bindPopup('Posisi Anda').openPopup();
  const userIcon = L.divIcon({ html: '🏠', className: 'map-marker', iconSize: [30, 30] });
  L.marker([0.4980, 101.4480], { icon: userIcon }).addTo(mapInstance)
    .bindPopup('Lokasi Penjemputan');
  setTimeout(() => mapInstance.invalidateSize(), 300);
}

async function goPage(id) {
  try {
    const fetchId = id === 'home' ? 'petugas-home' : (id === 'profil' ? 'petugas-profil' : (id === 'riwayat' ? 'riwayat-pickup' : id));
    const sharedViews = ['notifikasi', 'tracking', 'chat', 'edit-profil'];
    const basePath = sharedViews.includes(fetchId) ? 'views' : 'views/petugas';
    const res = await fetch(`${basePath}/${fetchId}.html?v=` + new Date().getTime());
    if (!res.ok) throw new Error('Not found');
    const html = await res.text();
    document.getElementById('app-root').innerHTML = html;
    window.scrollTo(0, 0);
    updateNavActive(id);
    if (id === 'tracking') setTimeout(initMap, 100);
    if (id === 'pickup-masuk') setTimeout(loadPickups, 100);
    if (id === 'pickup-berjalan') setTimeout(loadPickupBerjalan, 100);
    if (id === 'penimbangan') setTimeout(initPenimbangan, 100);
    if (id === 'profil') setTimeout(initPetugasProfil, 100);
    if (id === 'riwayat') setTimeout(loadRiwayatPickup, 100);
    if (id === 'chat') setTimeout(loadChat, 100);
    if (id === 'home' || id === 'petugas-home') {
      setTimeout(() => {
        initPetugasHome();
        if(typeof checkSubscription === 'function') checkSubscription();
      }, 100);
    }
    const ci = document.getElementById('chatInput');
    if (ci) ci.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', function () {
        const parent = this.closest('.filter-scroll');
        parent?.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
      });
    });
  } catch (err) {
    showToast(`⚠️ Halaman "${id}" gagal dimuat`);
  }
}

function updateNavActive(id) {
  const map = {
    home: 'nav-home',
    'pickup-masuk': 'nav-masuk',
    'pickup-berjalan': 'nav-home',
    penimbangan: 'nav-timbang',
    profil: 'nav-profil',
    tracking: 'nav-home',
    chat: 'nav-home',
    riwayat: 'nav-profil'
  };
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  if (map[id]) document.getElementById(map[id])?.classList.add('active');
}

// ==================== SET DATE ====================
function setDate() {
  const el = document.getElementById('todayDate');
  if (!el) return;
  const now = new Date();
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  el.textContent = now.toLocaleDateString('id-ID', opts);
}

// ==================== STATUS TOGGLE ====================
function toggleStatus(el) {
  el.classList.toggle('active');
  const isOnline = el.classList.contains('active');
  el.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
  showToast(isOnline ? '🟢 Status: Online - Siap Menerima Pickup' : '🔴 Status: Offline');
}

// ==================== ACCEPT PICKUP ====================
async function acceptPickup(id, btn) {
  const card = btn ? btn.closest('.pm-pickup-card, .wait-pickup-item') : null;
  if (btn) { btn.textContent = '⏳...'; btn.disabled = true; }
  try {
    const res = await API.Pickup.accept(id);
    if (res.success) {
      showToast('✅ Pickup diterima! Segera berangkat.');
      if (card) { card.style.opacity = '0.5'; card.style.pointerEvents = 'none'; }
      setTimeout(() => initPetugasHome(), 1000);
    } else {
      throw new Error(res.message || 'Gagal');
    }
  } catch (err) {
    showToast('❌ Gagal menerima pickup: ' + err.message);
    if (btn) { btn.textContent = '✓ Terima'; btn.disabled = false; }
  }
}

async function rejectPickup(id, btn) {
  const card = btn ? btn.closest('.pm-pickup-card, .wait-pickup-item') : null;
  if (btn) { btn.textContent = '⏳...'; btn.disabled = true; }
  try {
    const res = await API.Pickup.reject(id);
    if (res.success) {
      showToast('✅ Pesanan dilewati. User sudah diberi tahu.');
      if (card) card.remove();
    } else {
      throw new Error(res.message || 'Gagal');
    }
  } catch (err) {
    showToast('❌ ' + err.message);
    if (btn) { btn.textContent = '✗ Tolak'; btn.disabled = false; }
  }
}

// ==================== HOME ====================
let homePollingInterval = null;

async function initPetugasHome() {
  // Clear existing polling
  if (homePollingInterval) { clearInterval(homePollingInterval); homePollingInterval = null; }

  const user = API.Storage.getUser();
  if (user) {
    const nameEl = document.getElementById('petugasName');
    const initEl = document.getElementById('petugasInitials');
    if (nameEl) nameEl.textContent = user.name;
    if (initEl) {
      const savedAv = localStorage.getItem('petugas_avatar');
      if (savedAv) {
        initEl.textContent = '';
        initEl.style.setProperty('background-image', `url("${savedAv}")`, 'important');
        initEl.style.backgroundSize = 'cover';
        initEl.style.backgroundPosition = 'center';
      } else {
        initEl.textContent = user.name.substring(0, 2).toUpperCase();
        initEl.style.backgroundImage = 'none';
      }
    }
  }
  setDate();

  // 1. Fetch stats (masuk & selesai) dari endpoint khusus
  try {
    const statsRes = await API.Pickup.stats();
    if (statsRes && statsRes.success) {
      const { waiting, completed } = statsRes.data;
      const elMasuk = document.getElementById('statMasuk');
      const elSelesai = document.getElementById('statSelesai');
      const elBadgeMasuk = document.getElementById('badgeMasuk');
      if (elMasuk) elMasuk.textContent = waiting;
      if (elSelesai) elSelesai.textContent = completed;
      if (elBadgeMasuk) {
        elBadgeMasuk.textContent = waiting;
        elBadgeMasuk.style.display = waiting > 0 ? 'block' : 'none';
      }
    }
    
    // Fetch profile to get rating
    const profileRes = await fetch(window.API_BASE + '/users/profile', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const profileData = await profileRes.json();
    if (profileData.success && profileData.data) {
      const elRating = document.getElementById('statRating');
      if (elRating) elRating.textContent = profileData.data.profile?.rating || '0.0';
      const elWallet = document.getElementById('petugasWalletBalance');
      if (elWallet) elWallet.textContent = 'Rp ' + (profileData.data.profile?.wallet_balance || 0).toLocaleString('id-ID');
    }
  } catch (e) {
    console.error('Failed to load stats', e);
  }

  // 2. Fetch pickups untuk active-pickup card, badge jalan, dan waiting list
  try {
    const pickupRes = await API.Pickup.getAll();
    if (pickupRes && pickupRes.success) {
      const berjalan = pickupRes.data.filter(p => ['confirmed', 'on_way', 'arrived', 'weighing'].includes(p.status));
      const waiting  = pickupRes.data.filter(p => p.status === 'waiting');
      const elBadgeJalan = document.getElementById('badgeJalan');
      const elLiveBadge = document.getElementById('liveBadge');
      const elAPC = document.getElementById('activePickupContainer');
      const elWait = document.getElementById('waitPickupContainer');

      // Active pickup card
      if (berjalan.length > 0) {
        if (elBadgeJalan) { elBadgeJalan.textContent = berjalan.length; elBadgeJalan.style.display = 'block'; }
        if (elLiveBadge) elLiveBadge.style.display = 'inline-block';
        if (elAPC) {
          const p = berjalan[0];
          elAPC.innerHTML = `
            <div class="active-pickup-card" style="background:var(--card); border:1px solid var(--border); border-radius:16px; padding:16px; box-shadow:var(--sh-md); margin-bottom:16px; cursor:pointer;" onclick="window.currentPickupId='${p.id}'; goPage('${p.status === 'weighing' ? 'penimbangan' : 'pickup-berjalan'}')">
              <div class="apc-hdr" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed var(--border); padding-bottom: 12px; margin-bottom: 12px;">
                <span style="font-weight:700; color:var(--t1); font-size:12px; display:flex; align-items:center; gap:6px;"><img src="https://img.icons8.com/fluency-systems-regular/48/0A4222/box.png" width="14"> ORD-${p.id.substring(0,6).toUpperCase()}</span>
                <span class="tag-onway" style="background:rgba(17,142,234,0.1); color:var(--primary); padding:4px 8px; border-radius:99px; font-size:9px; font-weight:800;">${p.status.toUpperCase()}</span>
              </div>
              <div class="apc-user" style="display:flex; gap:12px; align-items:center;">
                <div class="apc-av" style="width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg, var(--primary-light), var(--surface)); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:var(--primary); flex-shrink:0; border:1px solid var(--border);">${p.user_name?.substring(0,2).toUpperCase()||'U'}</div>
                <div class="apc-info" style="flex:1;">
                  <p style="font-size:14px; font-weight:700; color:var(--t1); margin:0 0 4px;">${p.user_name || 'User'}</p>
                  <p style="font-size:11px; color:var(--t3); margin:0; display:flex; gap:4px; align-items:center;">
                    <img src="https://img.icons8.com/fluency-systems-regular/48/0A4222/map-pin.png" width="12"> 
                    <span style="display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis;">${p.address || '-'}</span>
                  </p>
                </div>
                <div class="apc-actions"><button class="btn-ghost" style="padding:8px; border:1px solid var(--border); border-radius:12px; display:flex; align-items:center; justify-content:center;" onclick="event.stopPropagation();goPage('chat')"><img src="https://img.icons8.com/fluency-systems-regular/48/0A4222/chat.png" width="18"></button></div>
              </div>
            </div>
          `;
        }
      }

      // Waiting pickups (max 3 untuk preview di home)
      if (elWait) {
        if (waiting.length === 0) {
          elWait.innerHTML = '<p style="text-align:center;color:var(--t4);padding:20px;">Tidak ada pickup baru</p>';
        } else {
          elWait.innerHTML = waiting.slice(0, 3).map(p => `
            <div class="wait-pickup-item">
              <div class="wpi-header">
                <div class="wpi-av">${p.user_name?.substring(0,2).toUpperCase()||'U'}</div>
                <div class="wpi-info">
                  <p class="wpi-name"><strong>${p.user_name || 'User'}</strong></p>
                  <p class="wpi-addr">📍 ${p.address || '-'} &bull; ~${p.weight_kg||'?'} kg</p>
                </div>
              </div>
              <div style="display:flex;gap:6px;width:100%;">
                <button class="btn-ghost" style="flex:1;padding:8px 10px;font-size:13px;border:1px solid var(--border);" onclick="rejectPickup('${p.id}', this)">Tolak</button>
                <button class="btn-primary" style="flex:1;padding:8px 10px;font-size:13px;" onclick="acceptPickup('${p.id}', this)">Terima</button>
              </div>
            </div>
          `).join('');
        }
      }
    }
  } catch (e) {
    console.error('Failed to load active pickups', e);
  }

  // Auto-refresh home tiap 10 detik
  if (document.getElementById('waitPickupContainer')) {
    homePollingInterval = setInterval(() => {
      if (document.getElementById('waitPickupContainer')) {
        // Hanya refresh waiting container & stats
        API.Pickup.stats().then(r => {
          if (r && r.success) {
            const elMasuk  = document.getElementById('statMasuk');
            const elSelesai = document.getElementById('statSelesai');
            const elBadgeMasuk = document.getElementById('badgeMasuk');
            if (elMasuk)  elMasuk.textContent  = r.data.waiting;
            if (elSelesai) elSelesai.textContent = r.data.completed;
            if (elBadgeMasuk) { elBadgeMasuk.textContent = r.data.waiting; elBadgeMasuk.style.display = r.data.waiting > 0 ? 'block' : 'none'; }
          }
        }).catch(() => {});
        API.Pickup.getAll().then(r => {
          if (r && r.success) {
            const elWait2 = document.getElementById('waitPickupContainer');
            const waiting2 = r.data.filter(p => p.status === 'waiting');
            if (elWait2 && waiting2.length === 0) {
              elWait2.innerHTML = '<p style="text-align:center;color:var(--t4);padding:20px;">Tidak ada pickup baru</p>';
            } else if (elWait2) {
              elWait2.innerHTML = waiting2.slice(0,3).map(p =>
                `<div class="wait-pickup-item">
                  <div class="wpi-header">
                    <div class="wpi-av">${p.user_name?.substring(0,2).toUpperCase()||'U'}</div>
                    <div class="wpi-info">
                      <p class="wpi-name"><strong>${p.user_name||'User'}</strong></p>
                      <p class="wpi-addr">📍 ${p.address||'-'} &bull; ~${p.weight_kg||'?'} kg</p>
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;width:100%;">
                    <button class="btn-ghost" style="flex:1;padding:8px 10px;font-size:13px;border:1px solid var(--border);" onclick="rejectPickup('${p.id}', this)">Tolak</button>
                    <button class="btn-primary" style="flex:1;padding:8px 10px;font-size:13px;" onclick="acceptPickup('${p.id}', this)">Terima</button>
                  </div>
                </div>`
              ).join('');
            }
          }
        }).catch(() => {});
      } else {
        clearInterval(homePollingInterval);
      }
    }, 10000);
  }
}

// ==================== PROFIL ====================
async function initPetugasProfil() {
  const user = API.Storage.getUser();
  if (user) {
    const nameEl = document.getElementById('profName');
    const avEl = document.getElementById('profAv');
    if (nameEl) nameEl.textContent = user.name;
    if (avEl) {
      const savedAv = localStorage.getItem('petugas_avatar');
      if (savedAv) {
        avEl.textContent = '';
        avEl.style.setProperty('background-image', `url("${savedAv}")`, 'important');
        avEl.style.backgroundSize = 'cover';
        avEl.style.backgroundPosition = 'center';
      } else {
        avEl.textContent = user.name.substring(0, 2).toUpperCase();
        avEl.style.backgroundImage = 'none';
      }
    }
  }
  try {
    const res = await fetch(window.API_BASE + '/users/profile', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    if (data.success && data.data) {
      const elPickup = document.getElementById('profPickup');
      const elRating = document.getElementById('profRating');
      if (elPickup) elPickup.textContent = data.data.profile?.total_pickups || 0;
      if (elRating) elRating.textContent = `⭐ ${data.data.profile?.rating || '4.9'}`;
      
      const elWallet = document.getElementById('profWalletBalance');
      if (elWallet) elWallet.textContent = 'Rp ' + (data.data.profile?.wallet_balance || 0).toLocaleString('id-ID');
    }
  } catch(err) {
    console.error('Gagal memuat profil', err);
  }
}

// ==================== TOP UP ====================
window.showTopUpModal = function() {
  let modal = document.getElementById('topUpModal');
  if (!modal) {
    const html = `
      <div id="topUpModal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:9999; justify-content:center; align-items:flex-end;">
        <div style="background:var(--bg); width:100%; max-width:480px; border-radius:24px 24px 0 0; padding:24px; animation: slideUp 0.3s ease;">
          <h3 style="margin-top:0; color:var(--t1);">Isi Saldo Dompet</h3>
          <p style="color:var(--t3); font-size:13px; margin-bottom:16px;">Pilih metode pembayaran resmi (Simulasi)</p>
          
          <label style="font-size:12px; font-weight:600; color:var(--t2);">Nominal Top Up</label>
          <div style="display:flex; align-items:center; background:var(--card); border:1.5px solid var(--border); border-radius:12px; padding:12px; margin-bottom:16px; margin-top:8px;">
            <span style="font-weight:700; color:var(--t2); margin-right:8px;">Rp</span>
            <input type="number" id="topupAmount" placeholder="50000" style="background:transparent; border:none; width:100%; font-size:16px; font-weight:700; color:var(--t1); outline:none;">
          </div>

          <label style="font-size:12px; font-weight:600; color:var(--t2);">Pilih Metode Pembayaran</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; margin-bottom:24px;">
            <div class="tu-method active" onclick="selMethod(this)" style="padding:12px; border:2px solid var(--primary); border-radius:12px; text-align:center; font-weight:600; color:var(--primary); cursor:pointer; background:rgba(0, 208, 132, 0.1);">BCA Virtual Account</div>
            <div class="tu-method" onclick="selMethod(this)" style="padding:12px; border:1px solid var(--border); border-radius:12px; text-align:center; font-weight:500; color:var(--t2); cursor:pointer;">Mandiri VA</div>
            <div class="tu-method" onclick="selMethod(this)" style="padding:12px; border:1px solid var(--border); border-radius:12px; text-align:center; font-weight:500; color:var(--t2); cursor:pointer;">GoPay</div>
            <div class="tu-method" onclick="selMethod(this)" style="padding:12px; border:1px solid var(--border); border-radius:12px; text-align:center; font-weight:500; color:var(--t2); cursor:pointer;">QRIS</div>
          </div>

          <div style="display:flex; gap:12px;">
            <button class="btn-ghost" style="flex:1; border:1px solid var(--border); padding:14px; border-radius:12px; font-weight:600; color:var(--t2);" onclick="document.getElementById('topUpModal').style.display='none'">Batal</button>
            <button class="btn-primary" id="btnProcessTopUp" style="flex:1; padding:14px; border-radius:12px; font-weight:700; background:var(--primary); color:white; border:none;" onclick="processTopUp()">Top Up Sekarang</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    window.selMethod = function(el) {
      document.querySelectorAll('.tu-method').forEach(m => {
        m.style.border = '1px solid var(--border)';
        m.style.fontWeight = '500';
        m.style.color = 'var(--t2)';
        m.style.background = 'transparent';
        m.classList.remove('active');
      });
      el.style.border = '2px solid var(--primary)';
      el.style.fontWeight = '600';
      el.style.color = 'var(--primary)';
      el.style.background = 'rgba(0, 208, 132, 0.1)';
      el.classList.add('active');
    }
  }
  document.getElementById('topupAmount').value = '';
  document.getElementById('topUpModal').style.display = 'flex';
}

window.processTopUp = async function() {
  const nominal = document.getElementById('topupAmount').value;
  const num = parseInt(nominal, 10);
  if (isNaN(num) || num < 10000) {
    showToast('Minimal Top Up Rp 10.000');
    return;
  }
  
  const btn = document.getElementById('btnProcessTopUp');
  const method = document.querySelector('.tu-method.active').innerText;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div> Memproses...';
  btn.disabled = true;

  try {
    const res = await fetch(window.API_BASE + '/users/topup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API.Storage.getToken()}`
      },
      body: JSON.stringify({ amount: num })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('topUpModal').style.display = 'none';
      showToast(`Pembayaran via ${method} Berhasil: Rp ${num.toLocaleString('id-ID')}`);
      if (document.getElementById('page-petugas-home') || document.getElementById('page-home')) {
        initPetugasHome();
      } 
      if (document.getElementById('page-petugas-profil') || document.getElementById('page-profil')) {
        initPetugasProfil();
      }
    } else {
      throw new Error(data.message);
    }
  } catch(err) {
    showToast('Gagal Top Up: ' + err.message);
  } finally {
    btn.innerHTML = 'Top Up Sekarang';
    btn.disabled = false;
  }
}

// ==================== RIWAYAT ====================
async function loadRiwayatPickup() {
  const container = document.getElementById('riwayatPickupList');
  if (!container) return;
  try {
    const res = await API.Pickup.getAll();
    if (res && res.success) {
      const history = res.data.filter(p => ['completed', 'cancelled'].includes(p.status));
      if (history.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--t4)">Belum ada riwayat pickup.</p>';
        return;
      }
      container.innerHTML = history.map(p => `
        <div class="history-card">
          <div class="hc-hdr">
            <span>ORD-${p.id.substring(0,6).toUpperCase()}</span>
            <span class="${p.status === 'completed' ? 'hc-status-done' : 'hc-status-cancel'}">${p.status === 'completed' ? 'Selesai' : 'Batal'}</span>
          </div>
          <div class="hc-body">
            <p><strong>${p.waste_name || 'Sampah'}</strong> · ~${p.weight_kg || '?'} kg</p>
            <p style="color:var(--t4);font-size:12px;margin-top:4px;">${p.user_name || 'User'} - ${p.address || '-'}</p>
          </div>
          <div class="hc-ftr">
            <span class="hc-date">${new Date(p.created_at).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}</span>
            <span class="hc-price">Rp ${p.total_price ? p.total_price.toLocaleString('id-ID') : '0'}</span>
          </div>
        </div>
      `).join('');
    }
  } catch(err) {
    container.innerHTML = '<p style="text-align:center;color:red;">Gagal memuat riwayat.</p>';
  }
}

// ==================== LOAD PICKUP MASUK ====================
async function loadPickups() {
  const container = document.getElementById('pickupMasukList');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--t4)">Memuat data...</p>';
  try {
    const res = await API.Pickup.getAll();
    if (res && res.success) {
      const pending = res.data.filter(p => p.status === 'waiting');
      if (pending.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:30px;color:var(--t4)">Tidak ada pickup baru saat ini.</p>';
        return;
      }
      container.innerHTML = pending.map(p => {
        const time = new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const price = p.total_price ? `Rp ${p.total_price.toLocaleString('id-ID')}` : '-';
        const pts   = p.points_earned ? `+${p.points_earned} pts` : '';
        return `
          <div class="pm-pickup-card" id="card-${p.id}">
            <div class="pmpc-hdr">
              <span>ORD-${p.id.substring(0,6).toUpperCase()} · ${p.waste_name || 'Sampah'}</span>
              <span class="time-tag">${time}</span>
            </div>
            <div class="pmpc-user">
              <div class="pmpc-av">${p.user_name?.substring(0,2).toUpperCase()||'U'}</div>
              <div>
                <p><strong>${p.user_name || 'User'}</strong></p>
                <p class="pmpc-addr">${p.address || '-'}</p>
              </div>
              <div style="text-align:right">
                <p class="pmpc-weight">~${p.weight_kg || '?'} kg</p>
                <p style="font-size:11px;color:var(--green)">${price}</p>
              </div>
            </div>
            ${pts ? `<div style="text-align:right;font-size:11px;color:var(--gold);margin-top:4px;">${pts} Poin</div>` : ''}
            <div class="pmpc-btns" style="margin-top:10px">
              <button class="btn-ghost half" onclick="rejectPickup('${p.id}', this)">Tolak</button>
              <button class="btn-primary half" onclick="acceptPickup('${p.id}', this)">Terima</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch(err) {
    container.innerHTML = '<p style="text-align:center;color:red;">Gagal memuat data.</p>';
  }
}

// ==================== PICKUP BERJALAN ====================
async function loadPickupBerjalan() {
  const container = document.getElementById('pickupBerjalanContainer');
  if (!container) return;
  try {
    const res = await API.Pickup.getAll();
    if (res && res.success) {
      const active = res.data.filter(p => ['confirmed', 'on_way', 'arrived', 'weighing'].includes(p.status));
      if (active.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--t4)">Tidak ada pickup yang sedang berjalan.</p>';
        return;
      }
      container.innerHTML = active.map(p => `
        <div class="active-pickup-card large" style="background:var(--card); border:1px solid var(--border); border-radius:16px; padding:20px; box-shadow:var(--sh-md); margin-bottom:16px;">
          <div class="apc-hdr" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed var(--border); padding-bottom: 12px; margin-bottom: 16px;">
            <span style="font-weight:700; color:var(--t1); font-size:13px; display:flex; align-items:center; gap:6px;"><img src="https://img.icons8.com/fluency-systems-regular/48/0A4222/box.png" width="16"> ORD-${p.id.substring(0,6).toUpperCase()}</span>
            <span class="tag-onway" style="background:rgba(17,142,234,0.1); color:var(--primary); padding:4px 10px; border-radius:99px; font-size:10px; font-weight:800;">${p.status.toUpperCase()}</span>
          </div>
          <div class="apc-user" style="display:flex; gap:16px; align-items:flex-start; margin-bottom: 20px;">
            <div class="apc-av" style="width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg, var(--primary-light), var(--surface)); display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800; color:var(--primary); flex-shrink:0; border:1px solid var(--border);">${p.user_name?.substring(0,2).toUpperCase()||'U'}</div>
            <div class="apc-info" style="flex:1;">
              <p style="font-size:15px; font-weight:700; color:var(--t1); margin:0 0 6px;">${p.user_name || 'User'}</p>
              <p style="font-size:12px; color:var(--t3); margin:0 0 4px; display:flex; gap:6px; align-items:flex-start;">
                <img src="https://img.icons8.com/fluency-systems-regular/48/0A4222/map-pin.png" width="14" style="margin-top:2px;"> 
                <span style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; line-height:1.4;">${p.address || '-'}</span>
              </p>
              <p style="font-size:12px; color:var(--t3); margin:0; display:flex; gap:6px; align-items:center;">
                <img src="https://img.icons8.com/fluency-systems-regular/48/0A4222/phone.png" width="14"> 
                ${p.user_phone || '-'}
              </p>
            </div>
          </div>
          <div class="small-steps" style="margin-bottom: 20px; padding: 16px; background: rgba(17,142,234,0.03); border-radius: 12px; border: 1px solid rgba(17,142,234,0.1);">
            <div class="ss-item done"><span></span><p>Diterima</p></div>
            <div class="ss-line done"></div>
            <div class="ss-item ${['on_way','arrived','weighing'].includes(p.status) ? 'done' : 'active'}"><span></span><p>Menuju</p></div>
            <div class="ss-line ${['on_way','arrived','weighing'].includes(p.status) ? 'done' : ''}"></div>
            <div class="ss-item ${['arrived','weighing'].includes(p.status) ? 'done' : (p.status==='on_way' ? 'active' : '')}"><span></span><p>Tiba</p></div>
            <div class="ss-line ${['arrived','weighing'].includes(p.status) ? 'done' : ''}"></div>
            <div class="ss-item ${p.status==='weighing' ? 'active' : ''}"><span></span><p>Timbang</p></div>
          </div>
          <div class="waste-detail" style="margin-bottom: 20px; background: var(--card2); padding: 12px 16px; border-radius: 12px; border: 1px dashed var(--border);">
            <h4 style="font-size:12px; color:var(--t3); margin:0 0 8px 0; text-transform:uppercase; letter-spacing:0.05em;">Detail Sampah</h4>
            <div class="wd-row" style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:13px; color:var(--t2);">Kategori</span><strong style="font-size:13px; color:var(--t1);">${p.category_name || '-'}</strong></div>
            <div class="wd-row" style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:13px; color:var(--t2);">Est. Berat</span><strong style="font-size:13px; color:var(--t1);">~${p.weight_kg || '?'} kg</strong></div>
            <div class="wd-row" style="display:flex; justify-content:space-between; padding-top:4px; margin-top:4px; border-top:1px solid var(--border);"><span style="font-size:13px; color:var(--t2);">Total Est.</span><strong style="font-size:14px; color:var(--primary);">Rp ${p.total_price ? p.total_price.toLocaleString('id-ID') : '0'}</strong></div>
          </div>
          <div class="apc-btns" style="display:flex; flex-wrap:wrap; gap:8px;">
            ${p.status === 'confirmed' ? `<button class="btn-primary w-full" style="padding:12px; font-size:14px;" onclick="updatePickupStatus('${p.id}', 'on_way')">🚀 Mulai Menuju Lokasi</button>` : ''}
            ${p.status === 'on_way' ? `<button class="btn-primary w-full" style="padding:12px; font-size:14px;" onclick="updatePickupStatus('${p.id}', 'arrived')">📍 Konfirmasi Tiba</button>` : ''}
            ${p.status === 'arrived' ? `<button class="btn-primary w-full" style="padding:12px; font-size:14px;" onclick="updatePickupStatus('${p.id}', 'weighing', true)">⚖️ Mulai Penimbangan</button>` : ''}
            ${p.status === 'weighing' ? `<button class="btn-primary w-full" style="padding:12px; font-size:14px;" onclick="window.currentPickupId='${p.id}'; goPage('penimbangan')">⚖️ Lanjutkan Penimbangan</button>` : ''}
            <div style="display:flex; gap:8px; width:100%; margin-top:4px;">
                <button class="btn-ghost" style="flex:1; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; gap:6px; padding:10px;" onclick="window.currentPickupId='${p.id}'; goPage('chat')">
                  <img src="https://img.icons8.com/fluency-systems-regular/48/0A4222/chat.png" width="18"> Chat
                </button>
                <button class="btn-ghost" style="flex:1; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; gap:6px; padding:10px;" onclick="goPage('tracking')">
                  <img src="https://img.icons8.com/fluency-systems-regular/48/0A4222/map.png" width="18"> Peta
                </button>
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch(err) {
    container.innerHTML = '<p style="text-align:center;color:red;">Gagal memuat data.</p>';
  }
}

async function updatePickupStatus(id, status, goToPenimbangan = false) {
  try {
    const res = await API.Pickup.updateStatus(id, { status });
    if (res.success) {
      showToast(`Status diperbarui: ${status}`);
      if (goToPenimbangan) {
        window.currentPickupId = id;
        goPage('penimbangan');
      } else {
        loadPickupBerjalan();
      }
    } else {
      throw new Error(res.message);
    }
  } catch(err) {
    showToast('Gagal update status: ' + err.message);
  }
}

// ==================== THEME ====================
function toggleTheme() {
  PetugasApp.isDark = !PetugasApp.isDark;
  document.documentElement.setAttribute('data-theme', PetugasApp.isDark ? 'dark' : 'light');
  showToast(PetugasApp.isDark ? 'Mode Gelap Aktif' : 'Mode Terang Aktif');
}

// ==================== WEIGHT ====================
function chgW2(d) {
  PetugasApp.wVal2 = Math.max(0.1, Math.round((PetugasApp.wVal2 + d) * 10) / 10);
  const el = document.getElementById('w2Val');
  if (el) el.textContent = PetugasApp.wVal2.toFixed(1);
  const total = PetugasApp.wVal2 * PetugasApp.hargaPerKg;
  const th = document.getElementById('totalHarga');
  if (th) th.textContent = 'Rp ' + total.toLocaleString('id-ID');
  const tf = document.getElementById('totalFormula');
  if (tf) tf.textContent = `${PetugasApp.wVal2.toFixed(1)} kg × Rp ${PetugasApp.hargaPerKg.toLocaleString('id-ID')}`;
}

async function initPenimbangan() {
  initSig();
  if (!window.currentPickupId) {
    showToast('Tidak ada pickup yang dipilih.');
    return;
  }
  try {
    const res = await API.Pickup.getById(window.currentPickupId);
    if (res && res.success) {
      const p = res.data;
      const elOrder = document.getElementById('timbangOrderId');
      const elUser = document.getElementById('timbangUser');
      const elKat = document.getElementById('timbangKategori');
      const elPay = document.getElementById('timbangPaymentMethod');
      if (elOrder) elOrder.textContent = `ORD-${p.id.substring(0,6).toUpperCase()}`;
      if (elUser) elUser.textContent = p.user_name || 'User';
      if (elKat) elKat.textContent = p.category_name || '-';
      if (elPay) {
        if (p.payment_method === 'cash') {
          elPay.innerHTML = '<span style="color:var(--orange)">Tunai (Cash)</span>';
        } else {
          elPay.innerHTML = '<span style="color:var(--primary)">Saldo (Wallet)</span>';
        }
      }
      
      const btnTimbang = document.getElementById('btnKonfirmasiTimbang');
      if (btnTimbang) {
        if (p.payment_method === 'cash') {
          btnTimbang.textContent = '✅ Selesai & Terima Tunai';
          btnTimbang.style.background = 'var(--orange)';
        } else {
          btnTimbang.textContent = '✅ Selesai & Bayar via Saldo';
          btnTimbang.style.background = 'var(--primary)';
        }
      }

      PetugasApp.wVal2 = p.weight_kg || 1;
      PetugasApp.hargaPerKg = p.price_per_kg || Math.round(p.total_price / p.weight_kg) || 2000;
      const hargaKgEl = document.getElementById('hargaKg');
      if (hargaKgEl) hargaKgEl.value = 'Rp ' + PetugasApp.hargaPerKg.toLocaleString('id-ID');
      chgW2(0);
    }
  } catch(err) {
    showToast('❌ Gagal memuat data penimbangan');
  }
}

// ==================== CONFIRM WEIGHING ====================
async function konfirmasiTimbang() {
  if (!window.currentPickupId) return;
  const btn = document.getElementById('btnKonfirmasiTimbang');
  if (btn) { btn.textContent = '⏳ Memproses...'; btn.disabled = true; }
  try {
    const res = await fetch(`${window.API_BASE}/pickups/${window.currentPickupId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API.Storage.getToken()}`
      },
      body: JSON.stringify({ weight_kg: PetugasApp.wVal2 })
    });
    const data = await res.json();
    if (data.success) {
      let modal = document.getElementById('successModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'successModal';
        modal.onclick = () => closeModal('successModal');
        document.body.appendChild(modal);
      }
      modal.innerHTML = `
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-success-anim">✅</div>
          <h3>Penimbangan Selesai! 🎉</h3>
          <p>Transaksi berhasil dikonfirmasi</p>
          <div class="modal-stats">
            <div><p class="ms-l">Berat Aktual</p><p class="ms-v">${data.data.weight_kg} kg</p></div>
            <div><p class="ms-l">Total Harga</p><p class="ms-v green-text">Rp ${data.data.actual_price.toLocaleString('id-ID')}</p></div>
          </div>
          <button class="btn-primary w-full" onclick="document.getElementById('successModal').style.display = ''; closeModal('successModal'); window.currentPickupId = null; goPage('home')">Oke, Kembali ke Beranda</button>
        </div>
      `;
      showModal('successModal');
      showToast('✅ Berhasil diselesaikan!');
    } else {
      throw new Error(data.message);
    }
  } catch(err) {
    showToast('❌ Gagal: ' + err.message);
    if (btn) { btn.textContent = '✅ Konfirmasi Penimbangan'; btn.disabled = false; }
  }
}

// ==================== SIGNATURE PAD ====================
let isDrawing = false, lastX = 0, lastY = 0;
function initSig() {
  const canvas = document.getElementById('sigCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const start = (x, y) => { isDrawing = true; [lastX, lastY] = [x, y]; document.getElementById('sigPH')?.style.setProperty('display', 'none'); };
  const draw = (x, y) => { if (!isDrawing) return; ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke(); [lastX, lastY] = [x, y]; };
  const stop = () => { isDrawing = false; };
  canvas.addEventListener('mousedown', e => { const r = canvas.getBoundingClientRect(); start(e.clientX - r.left, e.clientY - r.top); });
  canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); draw(e.clientX - r.left, e.clientY - r.top); });
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); const t = e.touches[0]; start(t.clientX - r.left, t.clientY - r.top); }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); const t = e.touches[0]; draw(t.clientX - r.left, t.clientY - r.top); }, { passive: false });
  canvas.addEventListener('touchend', stop);
}

function clearSig() {
  const canvas = document.getElementById('sigCanvas');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  const ph = document.getElementById('sigPH');
  if (ph) ph.style.removeProperty('display');
}

// ==================== QR MODAL ====================
function showQRModal() { showModal('qrModal'); }

// ==================== NOTIFICATIONS ====================
function clearNotifs() {
  document.querySelectorAll('.ni-unread').forEach(d => d.remove());
  document.querySelectorAll('.notif-item.unread').forEach(i => i.classList.remove('unread'));
  document.querySelectorAll('.badge-dot').forEach(b => { b.textContent = '0'; b.style.display = 'none'; });
  showToast('✅ Notifikasi dibersihkan');
}

// ==================== LOGOUT ====================
function logout() {
  if (confirm('Yakin ingin keluar dari akun petugas?')) {
    showToast('👋 Sampai jumpa!');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
  }
}

// ==================== MODALS ====================
function showModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

// ==================== CHAT ====================
let chatPollInterval = null;

async function loadChat() {
  if (!window.currentPickupId) {
    showToast('⚠️ Pilih pickup terlebih dahulu');
    goPage('pickup-berjalan');
    return;
  }

  // Update chat header with correct name
  try {
    const pickupRes = await API.Pickup.getById(window.currentPickupId);
    if (pickupRes.success) {
      const p = pickupRes.data;
      const me = API.Storage.getUser();
      // If petugas is logged in, chat partner is user
      const partnerName = p.user_name || 'User';
      
      const nameEl = document.querySelector('.ch-name');
      const avEl = document.querySelector('.ch-av');
      const statEl = document.querySelector('.ch-status');
      const savedUserAv = p.user_avatar || localStorage.getItem('user_avatar');
      
      if (nameEl) nameEl.textContent = partnerName;
      if (avEl) {
        avEl.innerHTML = savedUserAv 
          ? `<img src="${savedUserAv}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
          : `<img src="https://ui-avatars.com/api/?name=${partnerName}&background=0A4222&color=fff&rounded=true" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        avEl.style.background = 'transparent';
      }
      if (statEl) statEl.innerHTML = `● ORD-${p.id.substring(0,6).toUpperCase()} · ${p.status.toUpperCase()}`;
    }
  } catch(e) { console.error('Gagal memuat header chat', e); }

  if (chatPollInterval) clearInterval(chatPollInterval);
  await fetchChat();
  chatPollInterval = setInterval(fetchChat, 3000);
}

async function fetchChat() {
  const msgsContainer = document.getElementById('chatMsgs');
  if (!msgsContainer || !window.currentPickupId) return;
  try {
    const res = await API.Pickup.getChat(window.currentPickupId);
    if (res.success) {
      const user = API.Storage.getUser();
      // Only update if message count changes to prevent keyboard dismissal on mobile
      const newCount = res.data.length;
      if (msgsContainer.dataset.msgCount == newCount) return;
      msgsContainer.dataset.msgCount = newCount;
      
      msgsContainer.innerHTML = res.data.map(m => {
        const isMe = m.sender_id === user.id;
        const time = new Date(m.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
        
        let avatarHtml = '';
        if (isMe) {
          const myAv = user.avatar || localStorage.getItem('petugas_avatar');
          avatarHtml = myAv 
            ? `<div class="cm-av" style="background:transparent;"><img src="${myAv}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>`
            : `<div class="cm-av" style="background:transparent;"><img src="https://ui-avatars.com/api/?name=Petugas&background=0A4222&color=fff&rounded=true" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>`;
        } else {
          const senderAv = m.sender_avatar || localStorage.getItem('user_avatar');
          avatarHtml = senderAv
            ? `<div class="cm-av" style="background:transparent;"><img src="${senderAv}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>`
            : `<div class="cm-av" style="background:transparent;"><img src="https://ui-avatars.com/api/?name=${m.sender_name||'U'}&background=0A4222&color=fff&rounded=true" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>`;
        }

        return `
          <div class="chat-msg ${isMe ? 'sent' : 'recv'}">
            ${avatarHtml}
            <div class="cm-bubble ${isMe ? 'sent-b-blue' : 'recv-b'}">
              <p>${m.message}</p><span>${time}</span>
            </div>
          </div>
        `;
      }).join('');
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
    }
  } catch(err) { console.error('Chat error', err); }
}

async function sendMsg() {
  const inp = document.getElementById('chatInput');
  if (!inp || !inp.value.trim() || !window.currentPickupId) return;
  const msg = inp.value.trim();
  inp.value = '';
  try {
    const res = await API.Pickup.sendMessage(window.currentPickupId, msg);
    if (res.success) await fetchChat();
  } catch(err) { showToast('❌ Gagal mengirim pesan'); }
}

function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// ==================== TOAST ====================
function showToast(msg, dur = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}

// ==================== AVATAR UPLOAD ====================
function handleAvatarUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Str = e.target.result;
      localStorage.setItem('petugas_avatar', base64Str);
      showToast('📷 Foto profil berhasil diperbarui!');
      
      // Update element on current page
      const profAv = document.getElementById('profAv');
      if (profAv) {
        profAv.textContent = '';
        profAv.style.setProperty('background-image', `url("${base64Str}")`, 'important');
        profAv.style.backgroundSize = 'cover';
        profAv.style.backgroundPosition = 'center';
      }
      
      const editProfAv = document.getElementById('editProfAv');
      if (editProfAv) {
        editProfAv.textContent = '';
        editProfAv.style.setProperty('background-image', `url("${base64Str}")`, 'important');
        editProfAv.style.backgroundSize = 'cover';
        editProfAv.style.backgroundPosition = 'center';
      }
      
      const homeAv = document.getElementById('petugasInitials');
      if (homeAv) {
        homeAv.textContent = '';
        homeAv.style.setProperty('background-image', `url("${base64Str}")`, 'important');
        homeAv.style.backgroundSize = 'cover';
        homeAv.style.backgroundPosition = 'center';
      }
    }
    reader.readAsDataURL(input.files[0]);
  }
}

// ==================== EDIT PROFIL ====================
window.showEditProfilModal = function() {
  const modal = document.getElementById('editProfilModal');
  if (!modal) return;
  
  const user = API.Storage.getUser();
  if (user) {
    document.getElementById('editProfName').value = user.name || '';
    document.getElementById('editProfPhone').value = user.phone || '';
    
    const editProfAv = document.getElementById('editProfAv');
    const savedAv = localStorage.getItem('petugas_avatar');
    if (savedAv) {
      editProfAv.textContent = '';
      editProfAv.style.setProperty('background-image', `url("${savedAv}")`, 'important');
      editProfAv.style.backgroundSize = 'cover';
      editProfAv.style.backgroundPosition = 'center';
    } else {
      editProfAv.textContent = user.name ? user.name.substring(0, 2).toUpperCase() : '--';
      editProfAv.style.backgroundImage = 'none';
    }
  }
  
  modal.style.display = 'flex';
}

window.savePetugasProfil = function() {
  const user = API.Storage.getUser() || {};
  const newName = document.getElementById('editProfName').value.trim();
  const newPhone = document.getElementById('editProfPhone').value.trim();
  
  if (!newName) {
    showToast('Nama tidak boleh kosong');
    return;
  }
  
  user.name = newName;
  user.phone = newPhone;
  API.Storage.setUser(user);
  
  showToast('✅ Profil berhasil diperbarui');
  document.getElementById('editProfilModal').style.display = 'none';
  
  // Refresh views
  if (document.getElementById('page-petugas-profil')) {
    initPetugasProfil();
  }
  if (document.getElementById('page-petugas-home')) {
    initPetugasHome();
  }
}

// ==================== SUBSCRIPTION LOGIC ====================
let isSubPaid = localStorage.getItem('petugas_sub_paid') === 'true';

window.checkSubscription = function() {
  if (!isSubPaid) {
    const lock = document.getElementById('subLockOverlay');
    if (lock) lock.style.display = 'flex';
    
    const notifBadge = document.getElementById('notifBadge');
    if (notifBadge) {
      notifBadge.style.display = 'block';
      notifBadge.textContent = '1';
    }
  }
}

window.openMockPayment = function() {
  const payModal = document.getElementById('payModal');
  if (payModal) payModal.style.display = 'flex';
}

window.showPaymentInstruction = function() {
  const isQris = document.getElementById('payQris')?.checked;
  document.getElementById('qrisContent').style.display = isQris ? 'block' : 'none';
  document.getElementById('vaContent').style.display = isQris ? 'none' : 'block';
  
  const payModal = document.getElementById('payModal');
  if (payModal) payModal.style.display = 'none';
  
  const qrisModal = document.getElementById('qrisModal');
  if (qrisModal) qrisModal.style.display = 'flex';
}

window.processFinalPayment = function() {
  showToast('⏳ Memverifikasi pembayaran Anda...', 2500);
  
  setTimeout(() => {
    isSubPaid = true;
    localStorage.setItem('petugas_sub_paid', 'true');
    const qrisModal = document.getElementById('qrisModal');
    if (qrisModal) qrisModal.style.display = 'none';
    
    // Sembunyikan layar kunci
    const lock = document.getElementById('subLockOverlay');
    if (lock) lock.style.display = 'none';
    
    // Sembunyikan notifikasi merah
    const notifBadge = document.getElementById('notifBadge');
    if (notifBadge) notifBadge.style.display = 'none';
    
    // --- INTEGRASI PENDAPATAN ADMIN (DATABASE REAL) ---
    const user = API.Storage.getUser() || { name: 'Petugas' };
    const methodStr = document.getElementById('payQris')?.checked ? 'QRIS' : 'Transfer Bank (VA)';
    
    API.Admin.addIncome({
      amount: 200000,
      description: `Kemitraan: ${user.name}`,
      method: methodStr
    }).catch(err => console.error("Gagal catat income:", err));
    // --------------------------------------------------
    
    showToast('✅ Pembayaran Berhasil! Dana telah masuk ke Admin.');
  }, 2000);
}

// ==================== KEYBOARD ====================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  }
});

// ==================== INIT DASHBOARD ====================
async function initPetugasDashboard() {
  if (!window.API || !API.Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const meRes = await API.Auth.getMe();
    const user = meRes.data?.user || API.Storage.getUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    // Role guard - hanya petugas dan admin yang boleh akses
    if (user.role !== 'petugas' && user.role !== 'admin') {
      window.location.href = 'dashboard-user.html';
      return;
    }
    document.querySelectorAll('.hdr-name, .phb-name').forEach(el => el.textContent = user.name);
    const parts = user.name.split(' ');
    const initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    document.querySelectorAll('.hdr-av, .phb-av').forEach(el => el.textContent = initials);
  } catch (err) {
    console.error('Gagal memuat data petugas', err);
  } finally {
    checkSubscription();
  }
}

// ==================== MAIN ====================
document.addEventListener('DOMContentLoaded', () => {
  setDate();
  initPetugasDashboard();
  goPage('home');
  console.log('🚛 PilahPilih Dashboard Petugas v2.0 Loaded (Modular)');
});
