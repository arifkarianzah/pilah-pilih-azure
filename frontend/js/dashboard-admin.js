'use strict';
/* ================================================
   PILAH PILIH – Dashboard Admin Logic v2.0
   ================================================ */

const AdminApp = {
  isDark: true,
  charts: {},
  sidebarOpen: window.innerWidth > 768,
  cache: {}
};

const SECTION_TITLES = {
  dashboard: ['Dashboard', 'Ringkasan performa platform'],
  users: ['Kelola User', 'Manajemen semua pengguna'],
  'petugas-mgmt': ['Kelola Petugas', 'Manajemen petugas pickup'],
  harga: ['Harga Sampah', 'Pengaturan harga per jenis sampah'],
  laporan: ['Laporan & Analitik', 'Laporan kinerja platform'],
  smartcity: ['Smart City', 'Peta sebaran sampah & aktivitas'],
  'reward-mgmt': ['Kelola Reward', 'Manajemen sistem reward'],
  'edukasi-mgmt': ['Konten Edukasi', 'Manajemen artikel edukasi'],
  'notif-mgmt': ['Notifikasi', 'Pusat notifikasi sistem'],
  settings: ['Pengaturan', 'Konfigurasi sistem platform'],
};

// ==================== NAVIGATION ====================
// ==================== NAVIGATION ====================
async function goSection(id) {
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  const navItem = document.getElementById(`nav-${id}`);
  if (navItem) navItem.classList.add('active');

  const titles = SECTION_TITLES[id] || [id, ''];
  const titleEl = document.getElementById('pageTitle');
  const subEl = document.getElementById('pageSubtitle');
  if (titleEl) titleEl.textContent = titles[0];
  if (subEl) subEl.textContent = titles[1];

  if (window.innerWidth <= 768) closeSidebar();

  const mainContent = document.getElementById('adminMainContent');
  mainContent.innerHTML = `<div class="admin-skeleton"><div class="sk-header"></div><div class="sk-grid"><div class="sk-card"></div><div class="sk-card"></div><div class="sk-card"></div></div></div>`;

  try {
    const res = await fetch(`views/admin/${id}.html`);
    if (!res.ok) {
      if (res.status === 404) {
        mainContent.innerHTML = `<div class="admin-placeholder"><h3>${titles[0]}</h3><p>Modul dalam pengembangan.</p></div>`;
      } else {
        throw new Error('Gagal load');
      }
    } else {
      const html = await res.text();
      mainContent.innerHTML = html;
      
      // Hook logic after load
      if (id === 'dashboard') {
        fetchDashboardData();
        setTimeout(initDashboardCharts, 100);
      } else if (id === 'users') {
        fetchUsersData();
      } else if (id === 'petugas-mgmt') {
        fetchPetugasData();
      } else if (id === 'bank-mgmt') {
        fetchBankData();
      } else if (id === 'harga') {
        fetchHargaData();
      } else if (id === 'smartcity') {
        fetchSmartCityData();
      } else if (id === 'reward-mgmt') {
        fetchRewardsData();
      } else if (id === 'edukasi-mgmt') {
        fetchArticlesData();
      } else if (id === 'notif-mgmt') {
        fetchNotifData();
      } else if (id === 'laporan') {
        setTimeout(initLaporanCharts, 100);
      }
    }
  } catch (err) {
    mainContent.innerHTML = `<div class="admin-placeholder"><h3>Error</h3><p>Tidak dapat memuat modul.</p></div>`;
  }
}

// ==================== SIDEBAR ====================
function toggleSidebar() {
  AdminApp.sidebarOpen = !AdminApp.sidebarOpen;
  const sb = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (AdminApp.sidebarOpen) {
    sb?.classList.add('open');
    if (overlay) overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  } else {
    closeSidebar();
  }
}

function closeSidebar() {
  AdminApp.sidebarOpen = false;
  document.getElementById('adminSidebar')?.classList.remove('open');
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

// ==================== THEME ====================
function toggleTheme() {
  AdminApp.isDark = !AdminApp.isDark;
  document.documentElement.setAttribute('data-theme', AdminApp.isDark ? 'dark' : 'light');
  showToast(AdminApp.isDark ? '🌙 Mode Gelap Aktif' : '☀️ Mode Terang Aktif');
  // Re-init charts after theme change
  Object.values(AdminApp.charts).forEach(c => c?.destroy?.());
  AdminApp.charts = {};
  setTimeout(initDashboardCharts, 300);
}

// ==================== USER TABS ====================
function switchUserTab(btn, type) {
  document.querySelectorAll('.t-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  showToast(`👥 Filter: ${type === 'semua' ? 'Semua User' : btn.textContent}`);
}

// ==================== PERIOD ====================
function pickPeriod(btn) {
  document.querySelectorAll('.p-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  showToast(`📅 Periode: ${btn.textContent}`);
  Object.values(AdminApp.charts).forEach(c => c?.destroy?.());
  AdminApp.charts = {};
  setTimeout(initLaporanCharts, 300);
}

// ==================== MAP FILTER ====================
function pickMapFilter(btn) {
  document.querySelectorAll('.scmf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filterType = btn.textContent;
  
  if (window.smartCityMapInstance && window.smartCityMarkers) {
    const map = window.smartCityMapInstance;
    window.smartCityMarkers.forEach(m => {
      // Remove from map first
      map.removeLayer(m);
      
      let shouldShow = false;
      if (filterType === 'Semua') shouldShow = true;
      else if (filterType === 'TPS Overload' && (m._scStatus === 'kritis' || m._scStatus === 'penuh')) shouldShow = true;
      else if (filterType === 'Aktivitas Tinggi' && (m._scStatus === 'petugas' || m._scStatus === 'sedang')) shouldShow = true;
      
      if (shouldShow) {
        m.addTo(map);
      }
    });
  }
}

// ==================== NOTIFICATIONS ====================
function clearAllNotifs() {
  const list = document.getElementById('adminNotifList');
  if (list) {
    list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t4)">✅ Semua notifikasi telah dibersihkan</div>';
  }
  document.querySelectorAll('.badge-dot').forEach(b => { b.textContent = '0'; });
  showToast('✅ Semua notifikasi dihapus');
}

// ==================== DETAIL MODAL ====================
function openDetailModal(type, index) {
  const modal = document.getElementById('detailModal');
  const title = document.getElementById('dmTitle');
  const body = document.getElementById('dmBody');
  if (!modal || !body) return;

  let html = '';
  if (type === 'transaction' && AdminApp.cache.recent_users) {
    const data = AdminApp.cache.recent_users[index];
    title.textContent = 'Detail Transaksi ' + 'TRX-' + data.id.substring(0,4);
    html = `<div style="background:var(--card2); padding:16px; border-radius:12px; margin-bottom:12px;">
      <p style="color:var(--t4); font-size:12px;">User</p><p style="color:var(--t1); font-weight:bold; margin-bottom:10px;">${data.name} (${data.email})</p>
      <p style="color:var(--t4); font-size:12px;">Tanggal</p><p style="color:var(--t1); margin-bottom:10px;">${new Date(data.created_at).toLocaleString()}</p>
      <p style="color:var(--t4); font-size:12px;">Status</p><span class="status-online">Baru Mendaftar</span>
    </div><p style="color:var(--t4); font-size:12px; text-align:center;">Transaksi asli akan termuat setelah user melakukan order pertama.</p>`;
  } else if (type === 'user' && AdminApp.cache.usersData) {
    const data = AdminApp.cache.usersData[index];
    title.textContent = 'Profil User';
    html = `<div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
      <div class="t-av" style="width:50px; height:50px; font-size:18px;">${data.name.substring(0,2).toUpperCase()}</div>
      <div><h3 style="color:var(--t1); margin-bottom:4px;">${data.name}</h3><span class="role-tag green-role">${data.role}</span></div>
    </div>
    <div style="background:var(--card2); padding:16px; border-radius:12px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
      <div><p style="color:var(--t4); font-size:12px;">Email</p><p style="color:var(--t1);">${data.email}</p></div>
      <div><p style="color:var(--t4); font-size:12px;">Telepon</p><p style="color:var(--t1);">${data.phone || '-'}</p></div>
      <div><p style="color:var(--t4); font-size:12px;">Alamat</p><p style="color:var(--t1); grid-column:1/-1;">${data.address || '-'} ${data.city ? ', '+data.city : ''}</p></div>
      <div><p style="color:var(--t4); font-size:12px;">Bergabung Sejak</p><p style="color:var(--t1);">${new Date(data.created_at).toLocaleDateString()}</p></div>
    </div>
    <div style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
      <button class="t-unblock" onclick="changeUserRole('${data.id}', '${data.role === 'petugas' ? 'user' : 'petugas'}')">Jadikan ${data.role === 'petugas' ? 'User' : 'Petugas'}</button>
      <button class="t-block" onclick="showToast('Fitur Suspend / Nonaktifkan User Segera Hadir')">Nonaktifkan</button>
      <button class="t-block" style="background:var(--red); color:white;" onclick="deleteUser('${data.id}', '${data.role}')">Hapus</button>
    </div>`;
  }
  
  body.innerHTML = html || '<p>Data tidak ditemukan</p>';
  modal.classList.add('show');
}

function closeDetailModal() {
  document.getElementById('detailModal')?.classList.remove('show');
}

async function changeUserRole(id, newRole) {
  if (!confirm(`Yakin ingin mengubah user ini menjadi ${newRole.toUpperCase()}?`)) return;
  
  try {
    const res = await fetch(`${window.API_BASE}/admin/users/${id}/role`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${API.Storage.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Role berhasil diubah menjadi ${newRole.toUpperCase()}`);
      closeDetailModal();
      // Refresh both users and petugas tables to reflect changes
      fetchUsersData();
      fetchPetugasData();
    } else {
      showToast('❌ Gagal: ' + (data.error || 'Unknown Error'));
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Terjadi kesalahan jaringan');
  }
}

async function deleteUser(id, role) {
  if (!confirm('AWAS: Anda yakin ingin menghapus user ini? Seluruh data riwayat dan transaksinya akan ikut terhapus secara permanen dari database.')) return;
  
  try {
    const res = await fetch(`${window.API_BASE}/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('🗑️ User berhasil dihapus permanen dari Database');
      closeDetailModal();
      // Refresh the appropriate table
      if (role === 'bank_sampah') fetchBankData();
      else if (role === 'petugas') fetchPetugasData();
      else fetchUsersData();
    } else {
      showToast('❌ Gagal menghapus user: ' + (data.error || 'Unknown Error'));
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Terjadi kesalahan jaringan');
  }
}
// ==================== ADD MODAL ====================
let currentAddType = '';

function openAddModal(type) {
  currentAddType = type;
  const modal = document.getElementById('addModal');
  const title = document.getElementById('amTitle');
  const body = document.getElementById('amBody');
  const submitBtn = document.getElementById('amSubmitBtn');
  if (!modal || !body) return;

  submitBtn.onclick = () => submitAddData(type);

  let html = '';
  if (type === 'user' || type === 'petugas' || type === 'bank') {
    const roleName = type === 'user' ? 'User' : (type === 'petugas' ? 'Petugas' : 'Bank Sampah');
    title.textContent = 'Tambah ' + roleName;
    html = `
      <div class="fg"><label>Nama Lengkap</label><input type="text" id="addName" class="ig-input" placeholder="Masukkan nama" /></div>
      <div class="fg mt12"><label>Email</label><input type="email" id="addEmail" class="ig-input" placeholder="Masukkan email" /></div>
      <div class="fg mt12"><label>Password (Default: 12345678)</label><input type="text" id="addPassword" class="ig-input" placeholder="12345678" /></div>
    `;
  } else if (type === 'kategori') {
    title.textContent = 'Tambah Kategori Sampah';
    html = `
      <div class="fg"><label>Nama Kategori</label><input type="text" id="addCatName" class="ig-input" placeholder="Contoh: Kertas Kardus" /></div>
      <div class="fg mt12"><label>Ikon (Emoji)</label><input type="text" id="addCatIcon" class="ig-input" placeholder="Contoh: 📦" /></div>
      <div class="fg mt12"><label>Harga per Kg (Rp)</label><input type="number" id="addCatPrice" class="ig-input" placeholder="1500" /></div>
      <div class="fg mt12"><label>Deskripsi Kategori</label><input type="text" id="addCatDesc" class="ig-input" placeholder="Kertas dan kardus bekas" /></div>
    `;
  } else if (type === 'reward') {
    title.textContent = 'Tambah Item Reward';
    html = `
      <div class="fg"><label>Nama Reward</label><input type="text" id="addRewName" class="ig-input" placeholder="Contoh: Pulsa 50rb" /></div>
      <div class="fg mt12"><label>Ikon (Emoji)</label><input type="text" id="addRewIcon" class="ig-input" placeholder="Contoh: 📱" /></div>
      <div class="fg mt12"><label>Harga (Poin)</label><input type="number" id="addRewPoints" class="ig-input" placeholder="50000" /></div>
      <div class="fg mt12"><label>Stok Tersedia</label><input type="number" id="addRewStock" class="ig-input" placeholder="100" /></div>
    `;
  }
  
  body.innerHTML = html;
  modal.classList.add('show');
}

function closeAddModal() {
  document.getElementById('addModal')?.classList.remove('show');
}

async function submitAddData(type) {
  let endpoint = '';
  let payload = {};
  const btn = document.getElementById('amSubmitBtn');
  btn.textContent = 'Menyimpan...';
  btn.disabled = true;

  if (type === 'user' || type === 'petugas' || type === 'bank') {
    endpoint = window.API_BASE + '/auth/register';
    const roleValue = type === 'bank' ? 'bank_sampah' : type;
    payload = {
      name: document.getElementById('addName').value,
      email: document.getElementById('addEmail').value,
      password: document.getElementById('addPassword').value || '12345678',
      role: roleValue
    };
  } else if (type === 'kategori') {
    endpoint = window.API_BASE + '/categories';
    payload = {
      name: document.getElementById('addCatName').value,
      icon: document.getElementById('addCatIcon').value || '♻️',
      price_per_kg: parseInt(document.getElementById('addCatPrice').value) || 0,
      description: document.getElementById('addCatDesc').value
    };
  } else if (type === 'reward') {
    endpoint = window.API_BASE + '/admin/rewards';
    payload = {
      name: document.getElementById('addRewName').value,
      icon: document.getElementById('addRewIcon').value || '🎁',
      cost_points: parseInt(document.getElementById('addRewPoints').value) || 0,
      stock: parseInt(document.getElementById('addRewStock').value) || 0
    };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${API.Storage.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Data berhasil ditambahkan!');
      closeAddModal();
      // Refresh Data
      if (type === 'user') fetchUsersData();
      else if (type === 'petugas') fetchPetugasData();
      else if (type === 'bank') fetchBankData();
      else if (type === 'kategori') fetchHargaData();
      else if (type === 'reward') fetchRewardsData();
    } else {
      showToast('❌ Gagal: ' + (data.message || data.error));
    }
  } catch (err) {
    showToast('❌ Terjadi kesalahan jaringan');
  } finally {
    btn.textContent = 'Simpan';
    btn.disabled = false;
  }
}

// ==================== LOGOUT ====================
function logout() {
  if (confirm('Yakin ingin keluar dari admin panel?')) {
    showToast('👋 Sampai jumpa, Administrator!');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
  }
}

// ==================== CHARTS & DATA ====================
async function fetchDashboardData() {
  try {
    const res = await API.Admin.getDashboard();
    if (res && res.success) {
      const stats = res.data.stats || {};
      document.getElementById('dashTotalUser').textContent = stats.users || '0';
      document.getElementById('dashTotalPetugas').textContent = stats.petugas || '0';
      document.getElementById('dashTotalPickup').textContent = stats.transactions || '0';
      
      const elBank = document.getElementById('dashTotalBank');
      if (elBank) elBank.textContent = '3'; // Hardcoded for now based on seed
      
      // Update other stats if element exists
      const statCards = document.querySelectorAll('.asc-v');
      if (statCards.length >= 7) {
        const totalRev = stats.total_revenue || 0;
        let revStr = 'Rp 0';
        if (totalRev >= 1000000) {
            revStr = 'Rp ' + (totalRev / 1000000).toFixed(1) + 'M';
        } else if (totalRev > 0) {
            revStr = 'Rp ' + (totalRev / 1000).toFixed(0) + 'k';
        }
        
        statCards[4].textContent = (stats.total_kg || 0).toLocaleString('id-ID') + ' kg';
        statCards[5].textContent = revStr;
        statCards[6].textContent = (stats.carbon_saved || 0).toLocaleString('id-ID') + ' kg';
      }

      // Populate table recent transactions
      const tbody = document.getElementById('txnTableBody');
      if (tbody && res.data.recent_users) {
        AdminApp.cache.recent_users = res.data.recent_users;
        let html = '';
        res.data.recent_users.forEach((u, i) => {
          html += `<tr><td>TRX-${u.id.substring(0,4)}</td><td>${u.name}</td><td>-</td><td>-</td><td>-</td><td>-</td><td><span class="status-online">Baru</span></td><td>${new Date(u.created_at).toLocaleDateString()}</td><td><button class="t-edit" onclick="openDetailModal('transaction', ${i})">Detail</button></td></tr>`;
        });
        tbody.innerHTML = html;
      }

      // Initialize charts with real data
      setTimeout(() => initDashboardCharts(res.data), 100);
    }
  } catch (err) {
    console.error('Fetch dashboard error', err);
  }
}

async function fetchUsersData() {
  try {
    const res = await fetch(window.API_BASE + '/users', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    const tbody = document.getElementById('userTableBody');
    if (data && data.success && tbody) {
      AdminApp.cache.usersData = data.data;
      let html = '';
      data.data.forEach((u, i) => {
        html += `<tr>
          <td>${i+1}</td>
          <td><div class="t-user"><div class="t-av">${u.name.substring(0,2).toUpperCase()}</div>${u.name}</div></td>
          <td>${u.email}</td>
          <td><span class="role-tag ${u.role === 'petugas' ? 'green-role' : (u.role === 'admin' ? 'purple-role' : 'green-role')}">${u.role}</span></td>
          <td><span class="lvl-tag">Level --</span></td>
          <td>--</td>
          <td><span class="s-dot green"></span>Aktif</td>
          <td>${new Date(u.created_at).toLocaleDateString()}</td>
          <td><div class="t-act-btns"><button class="t-edit" onclick="openDetailModal('user', ${i})">Edit</button></div></td>
        </tr>`;
      });
      tbody.innerHTML = html || '<tr><td colspan="9" style="text-align:center;">Tidak ada data</td></tr>';
      document.getElementById('usersTotal').textContent = data.data.length;
    }
  } catch(err) {
    console.error('Fetch users error', err);
  }
}

function switchUserTab(btn, filterRole) {
  const tabs = btn.parentElement.querySelectorAll('.t-tab');
  tabs.forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  
  const targetRole = filterRole === 'bank' ? 'bank_sampah' : filterRole;
  const tbody = document.getElementById('userTableBody');
  if (!tbody || !AdminApp.cache.usersData) return;
  
  let filteredUsers = AdminApp.cache.usersData;
  if (targetRole !== 'semua') {
    filteredUsers = AdminApp.cache.usersData.filter(u => u.role === targetRole);
  }
  
  let html = '';
  filteredUsers.forEach((u, i) => {
    const originalIndex = AdminApp.cache.usersData.findIndex(user => user.id === u.id);
    html += `<tr>
      <td>${i+1}</td>
      <td><div class="t-user"><div class="t-av">${u.name.substring(0,2).toUpperCase()}</div>${u.name}</div></td>
      <td>${u.email}</td>
      <td><span class="role-tag ${u.role === 'petugas' ? 'green-role' : (u.role === 'admin' ? 'purple-role' : 'green-role')}">${u.role}</span></td>
      <td><span class="lvl-tag">Level --</span></td>
      <td>--</td>
      <td><span class="s-dot green"></span>Aktif</td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td><div class="t-act-btns"><button class="t-edit" onclick="openDetailModal('user', ${originalIndex})">Detail</button></div></td>
    </tr>`;
  });
  tbody.innerHTML = html || '<tr><td colspan="9" style="text-align:center;">Tidak ada data</td></tr>';
  document.getElementById('usersTotal').textContent = filteredUsers.length;
}

function filterPetugas(query) {
  const q = query.toLowerCase();
  const tbody = document.querySelector('.petugas-stats + .admin-table-card tbody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const nameCell = row.querySelector('.t-user');
    if (!nameCell) return;
    const name = nameCell.textContent.toLowerCase();
    if (name.includes(q)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function filterUsersList(query) {
  const q = query.toLowerCase();
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const nameCell = row.querySelector('.t-user');
    if (!nameCell) return;
    const name = nameCell.textContent.toLowerCase();
    if (name.includes(q)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

async function fetchPetugasData() {
  try {
    const res = await fetch(window.API_BASE + '/admin/petugas-stats', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    const tbody = document.querySelector('.petugas-stats + .admin-table-card tbody');
    if (data && data.success && tbody) {
      const petugas = data.data;
      AdminApp.cache.usersData = petugas; // Re-use the user detail modal
      let html = '';
      let totalOnline = 0;
      let totalPickups = 0;
      let sumRating = 0;
      let ratedCount = 0;

      petugas.forEach((u, i) => {
        const isOnline = Math.random() > 0.3; // Mocking online status
        if (isOnline) totalOnline++;
        totalPickups += (u.total_pickups || 0);
        if (u.avg_rating) { sumRating += u.avg_rating; ratedCount++; }

        const statusHtml = isOnline ? '<span class="status-online">🟢 Online</span>' : '<span class="status-offline" style="color:var(--red);">🔴 Offline</span>';
        
        html += `<tr>
          <td><div class="t-user"><div class="t-av">${u.name.substring(0,2).toUpperCase()}</div>${u.name}</div></td>
          <td>${u.city || '-'}</td>
          <td>${statusHtml}</td>
          <td>${u.total_pickups || 0}</td>
          <td>⭐ ${u.avg_rating ? parseFloat(u.avg_rating).toFixed(1) : '0.0'}</td>
          <td>Rp ${((u.total_kg || 0) * 1500).toLocaleString('id-ID')}</td>
          <td><div class="t-act-btns"><button class="t-edit" onclick="openDetailModal('user', ${i})">Detail</button></div></td>
        </tr>`;
      });
      tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;">Tidak ada data petugas</td></tr>';
      
      // Update stats cards
      const statCards = document.querySelectorAll('.petugas-stats .asc-v');
      if (statCards.length >= 4) {
        statCards[0].textContent = totalOnline;
        statCards[1].textContent = petugas.length - totalOnline;
        statCards[2].textContent = ratedCount > 0 ? (sumRating / ratedCount).toFixed(2) : '0.00';
        statCards[3].textContent = totalPickups;
      }
    }
  } catch(err) { console.error(err); }
}

async function fetchBankData() {
  try {
    const res = await fetch(window.API_BASE + '/admin/bank-stats', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    const tbody = document.querySelector('#adminMainContent .data-table tbody');
    if (data && data.success && tbody) {
      const bank = data.data;
      AdminApp.cache.usersData = bank;
      let html = '';
      bank.forEach((u, i) => {
        const totalTon = (u.total_kg || 0) / 1000;
        html += `<tr>
          <td><div class="t-user"><div class="t-av gold-role">${u.name.substring(0,2).toUpperCase()}</div>${u.name}</div></td>
          <td>${u.city || u.address || '-'}</td>
          <td><span class="status-online">Aktif</span></td>
          <td>${totalTon > 0 ? totalTon.toFixed(1) : '0'} Ton</td>
          <td><div class="t-act-btns"><button class="t-edit" onclick="openDetailModal('user', ${i})">Kelola</button></div></td>
        </tr>`;
      });
      tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;">Tidak ada mitra bank sampah</td></tr>';
    }
  } catch(err) { console.error(err); }
}

async function fetchHargaData() {
  try {
    const res = await API.request('/categories');
    const data = await res.json();
    const grid = document.querySelector('.price-grid');
    if (data && data.success && grid) {
      let html = '';
      data.data.forEach(c => {
        html += `<div class="price-card">
          <div class="pc-ico green-bg">${c.icon}</div>
          <div class="pc-info"><p class="pc-name">${c.name}</p><p class="pc-cat">${c.description}</p></div>
          <div class="pc-price"><input class="price-input" id="price-input-${c.id}" value="${c.price_per_kg}" type="number" /><span>/kg</span></div>
          <button class="pc-save" onclick="updatePrice(${c.id}, '${c.name}')">Simpan</button>
        </div>`;
      });
      grid.innerHTML = html;
    }
  } catch(err) { console.error(err); }
}

async function updatePrice(id, name) {
  const input = document.getElementById(`price-input-${id}`);
  if (!input) return;
  const newPrice = parseInt(input.value);
  
  if (!newPrice || newPrice <= 0) {
    showToast('❌ Harga tidak valid');
    return;
  }
  
  try {
    const res = await fetch(`${window.API_BASE}/categories/${id}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${API.Storage.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ price_per_kg: newPrice })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Harga ${name} berhasil diubah menjadi Rp ${newPrice.toLocaleString('id-ID')}`);
    } else {
      showToast(`❌ Gagal update harga: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Terjadi kesalahan jaringan');
  }
}

async function fetchRewardsData() {
  try {
    const res = await fetch(window.API_BASE + '/rewards', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    const tbody = document.querySelector('#adminMainContent .data-table tbody');
    if (data && data.success && tbody) {
      let html = '';
      data.data.forEach(r => {
        html += `<tr>
          <td><div class="t-user"><div class="t-av">${r.icon}</div>${r.name}</div></td>
          <td>${r.cost_points.toLocaleString('id-ID')} Poin</td>
          <td>${r.stock}</td>
          <td><span class="status-online">Aktif</span></td>
          <td><div class="t-act-btns"><button class="t-edit" onclick="showToast('Edit reward sedang dikembangkan')">Edit</button></div></td>
        </tr>`;
      });
      tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;">Tidak ada reward</td></tr>';
    }
  } catch(err) { console.error(err); }
}

async function fetchSmartCityData() {
  try {
    const res = await fetch(window.API_BASE + '/admin/smartcity', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    const map = document.getElementById('realSmartCityMap');
    if (data && data.success && map) {
      // Re-initialize map because DOM element was recreated by innerHTML
      // Re-initialize map because DOM element was recreated by innerHTML
      if (window.smartCityMapInstance) {
        try {
          window.smartCityMapInstance.remove();
        } catch(e) {}
        window.smartCityMapInstance = null;
      }
      
      window.smartCityMapInstance = L.map('realSmartCityMap').setView([0.5071, 101.4478], 12);
      
      // Standard OpenStreetMap for better visibility
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(window.smartCityMapInstance);
      
      // Fix map rendering issues in SPAs
      setTimeout(() => {
        window.smartCityMapInstance.invalidateSize();
      }, 300);
      
      const mapInst = window.smartCityMapInstance;
      
      // Clear existing markers
      if (window.smartCityMarkers) {
        window.smartCityMarkers.forEach(m => mapInst.removeLayer(m));
      }
      window.smartCityMarkers = [];

      data.data.hotspots.forEach(h => {
        // Define color based on status
        let color = '#0A4222'; // aman
        if (h.status === 'kritis') color = '#EF4444';
        else if (h.status === 'penuh') color = '#F97316';
        else if (h.status === 'sedang') color = '#EAB308';
        else if (h.status === 'petugas') color = '#3B82F6';
        
        const text = h.status === 'petugas' ? '🚛' : h.capacity + '%';
        
        // Create custom HTML icon
        const iconHtml = `<div style="background:${color}; color:white; font-weight:bold; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 10px ${color}88; border:2px solid #fff;">${text}</div>`;
        
        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-leaflet-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        
        const marker = L.marker([h.lat, h.lng], { icon: customIcon }).addTo(mapInst);
        marker.bindPopup(`<b>${h.label}</b><br/>Status: ${h.status.toUpperCase()}`);
        marker._scStatus = h.status; // Save status for filtering
        window.smartCityMarkers.push(marker);
      });
      
      document.querySelector('.sc-stats-row').innerHTML = `
        <div class="scs-card"><h4>TPS Kritis</h4><div class="scs-v red-text">${data.data.stats.tps_kritis}</div><small>Perlu evakuasi</small></div>
        <div class="scs-card"><h4>Petugas Aktif</h4><div class="scs-v green-text">${data.data.stats.petugas_aktif}</div><small>Di lapangan</small></div>
        <div class="scs-card"><h4>Volume Hari Ini</h4><div class="scs-v blue-text">${data.data.stats.volume_hari_ini}</div><small>Total sampah</small></div>
      `;
    }
  } catch(err) { console.error(err); }
}

async function fetchArticlesData() {
  try {
    const res = await fetch(window.API_BASE + '/admin/articles', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    const tbody = document.querySelector('#adminMainContent .data-table tbody');
    if (data && data.success && tbody) {
      let html = '';
      data.data.forEach(a => {
        html += `<tr>
          <td>${a.title}</td>
          <td><span class="cat-tag green-tag">${a.category}</span></td>
          <td>${new Date(a.created_at).toLocaleDateString()}</td>
          <td>${a.views}</td>
          <td><span class="status-online">${a.is_published ? 'Published' : 'Draft'}</span></td>
          <td><div class="t-act-btns"><button class="t-edit" onclick="showToast('Edit artikel sedang dikembangkan')">Edit</button></div></td>
        </tr>`;
      });
      tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center;">Belum ada artikel</td></tr>';
    }
  } catch(err) { console.error(err); }
}

async function fetchNotifData() {
  try {
    const res = await fetch(window.API_BASE + '/admin/notifications', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    const list = document.getElementById('adminNotifList');
    if (data && data.success && list) {
      let html = '';
      data.data.forEach(n => {
        const ico = n.type==='alert'?'⚠️':(n.type==='wallet'?'💰':(n.type==='pickup'?'🚛':'✅'));
        const color = n.type==='alert'?'red':(n.type==='wallet'?'yellow':(n.type==='pickup'?'blue':'green'));
        html += `<div class="notif-admin-item ${n.is_read ? '' : 'unread'}">
          <div class="na-ico ${color}-ico">${ico}</div>
          <div class="na-info">
            <p class="na-title">${n.title}</p>
            <p class="na-body">${n.body}</p>
            <p class="na-time">${new Date(n.created_at).toLocaleString()}</p>
          </div>
          ${n.type==='wallet' ? `<div class="na-actions"><button onclick="document.getElementById('topupModal').classList.add('show')">Top Up</button></div>` : ''}
        </div>`;
      });
      list.innerHTML = html || '<p style="padding:20px;text-align:center;">Tidak ada notifikasi sistem</p>';
    }
  } catch(err) { console.error(err); }
}

function getGradient(ctx, color1, color2) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

function initDashboardCharts(apiData) {
  const isDark = AdminApp.isDark;
  Chart.defaults.color = isDark ? 'rgba(255,255,255,0.6)' : '#64748B';
  Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  Chart.defaults.font.family = "'Poppins', sans-serif";
  
  const tooltipOptions = {
    backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)',
    titleColor: isDark ? '#fff' : '#000',
    bodyColor: isDark ? '#ccc' : '#333',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    borderWidth: 1, padding: 12, boxPadding: 6, usePointStyle: true
  };

  const gridOptions = { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderDash: [5, 5] };

  // Parse API Data
  let revLabels = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  let revData = [0,0,0,0,0,0,0,0,0,0,0,0];
  let catLabels = ['Plastik','Kertas/Kardus','Logam','Elektronik','Kaca','Lainnya'];
  let catData = [0,0,0,0,0,0];

  if (apiData) {
    if (apiData.monthly_trend) {
      apiData.monthly_trend.forEach(m => {
        const monthIndex = parseInt(m.month.split('-')[1]) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          revData[monthIndex] = m.total_revenue / 1000000; // in Millions
        }
      });
    }
    if (apiData.top_categories && apiData.top_categories.length > 0) {
      catLabels = []; catData = [];
      apiData.top_categories.forEach(c => {
        catLabels.push(c.name);
        catData.push(c.total_kg);
      });
    }
  }

  // Revenue
  if (!AdminApp.charts['revenueChart']) {
    const el = document.getElementById('revenueChart');
    if (el) {
      const ctx = el.getContext('2d');
      const gradBar = getGradient(ctx, 'rgba(0,208,132,0.8)', 'rgba(0,208,132,0.2)');
      
      AdminApp.charts['revenueChart'] = new Chart(el, {
        type: 'bar',
        data: {
          labels: revLabels,
          datasets: [
            { label: 'Pendapatan (Juta)', data: revData, backgroundColor: gradBar, borderColor: '#0A4222', borderWidth: 1, borderRadius: {topLeft: 6, topRight: 6}, barPercentage: 0.6 },
            { label: 'Target', data: [2,2,3,3,4,5,5,5,6,6,7,8], type: 'line', borderColor: '#3B82F6', borderDash: [5,5], borderWidth: 3, pointBackgroundColor: '#3B82F6', pointBorderColor: '#fff', pointRadius: 4, pointHoverRadius: 6, fill: false, tension: 0.4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 20 } }, tooltip: tooltipOptions },
          scales: { x: { grid: { display: false } }, y: { grid: gridOptions, border: { display: false }, ticks: { callback: v => `Rp ${v}M` } } }
        }
      });
    }
  }

  // Waste Doughnut
  if (!AdminApp.charts['wasteChart']) {
    const el = document.getElementById('wasteChart');
    if (el) {
      AdminApp.charts['wasteChart'] = new Chart(el, {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{ data: catData.length ? catData : [1], backgroundColor: ['#0A4222','#3B82F6','#EAB308','#8B5CF6','#14B8A6','#94A3B8'], borderWidth: 3, borderColor: isDark ? '#111827' : '#ffffff', hoverOffset: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, padding: 15 } }, tooltip: tooltipOptions } }
      });
    }
  }

  // Pickup Growth
  if (!AdminApp.charts['pickupChart']) {
    const el = document.getElementById('pickupChart');
    if (el) {
      const ctx = el.getContext('2d');
      const gradLine = getGradient(ctx, 'rgba(0,208,132,0.4)', 'rgba(0,208,132,0.0)');
      
      AdminApp.charts['pickupChart'] = new Chart(el, {
        type: 'line',
        data: {
          labels: ['Jan','Feb','Mar','Apr','Mei','Jun'],
          datasets: [{ label: 'Pickup', data: [2400,3200,4100,5800,7200,8900], borderColor: '#0A4222', backgroundColor: gradLine, fill: true, tension: 0.4, borderWidth: 3, pointBackgroundColor: '#fff', pointBorderColor: '#0A4222', pointRadius: 4, pointHoverRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: tooltipOptions }, scales: { x: { grid: { display: false } }, y: { grid: gridOptions, border: { display: false }, ticks: { callback: v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v } } } }
      });
    }
  }

  // User Growth
  if (!AdminApp.charts['userChart']) {
    const el = document.getElementById('userChart');
    if (el) {
      const ctx = el.getContext('2d');
      const gradBar = getGradient(ctx, 'rgba(59,130,246,0.8)', 'rgba(59,130,246,0.2)');
      
      AdminApp.charts['userChart'] = new Chart(el, {
        type: 'bar',
        data: {
          labels: ['Jan','Feb','Mar','Apr','Mei','Jun'],
          datasets: [{ label: 'User Baru', data: [820,1240,1580,2100,2840,3200], backgroundColor: gradBar, borderColor: '#3B82F6', borderWidth: 1, borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: tooltipOptions }, scales: { x: { grid: { display: false } }, y: { grid: gridOptions, border: { display: false } } } }
      });
    }
  }
}

function initLaporanCharts() {
  const isDark = AdminApp.isDark;
  
  if (!AdminApp.charts['lapRevChart']) {
    const el = document.getElementById('lapRevChart');
    if (el) {
      AdminApp.charts['lapRevChart'] = new Chart(el, {
        type: 'bar',
        data: {
          labels: ['Jan','Feb','Mar','Apr','Mei','Jun'],
          datasets: [
            { label: 'Pendapatan', data: [1.2,1.8,2.1,2.8,3.4,4.8], backgroundColor: 'rgba(0,208,132,0.7)', borderRadius: 6 },
            { label: 'Target', data: [2,2,3,3,4,5], type: 'line', borderColor: '#EAB308', borderDash: [6,3], borderWidth: 2, pointRadius: 0, fill: false, tension: 0.4 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: v => `Rp ${v}M` } } } }
      });
    }
  }

  if (!AdminApp.charts['lapWasteChart']) {
    const el = document.getElementById('lapWasteChart');
    if (el) {
      AdminApp.charts['lapWasteChart'] = new Chart(el, {
        type: 'pie',
        data: {
          labels: ['Plastik','Kertas','Logam','Elektronik','Kaca'],
          datasets: [{ data: [35,28,18,12,7], backgroundColor: ['#0A4222','#3B82F6','#EAB308','#8B5CF6','#14B8A6'], borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }
}

// ==================== TOAST ====================
function showToast(msg, dur = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}

// ==================== SYSTEM TOP UP ====================
let systemBalance = 15000000;
function openTopUpModal() {
  const modal = document.getElementById('topupModal');
  if (modal) modal.style.display = 'flex';
}

function closeTopUpModal() {
  const modal = document.getElementById('topupModal');
  if (modal) modal.style.display = 'none';
}

function submitTopUp() {
  const bank = document.getElementById('sysTopUpBank')?.value;
  const amtStr = document.getElementById('sysTopUpAmount')?.value;
  const amt = parseInt(amtStr, 10);
  
  if (!amt || amt < 50000) {
    showToast('❌ Nominal minimal Rp 50.000', 3000);
    return;
  }
  
  systemBalance += amt;
  const sysBalEl = document.getElementById('sysBalance');
  if (sysBalEl) {
    sysBalEl.textContent = 'Rp ' + systemBalance.toLocaleString('id-ID');
  }
  
  showToast(`✅ Berhasil top up Rp ${amt.toLocaleString('id-ID')} via ${bank}`, 4000);
  document.getElementById('sysTopUpAmount').value = '';
  closeTopUpModal();
}

// ==================== RESPONSIVE ====================
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.getElementById('adminSidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.style.setProperty('display','none');
    document.body.style.overflow = '';
  }
});

async function initAdminDashboard() {
  if (!window.API || !API.Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  try {
    // 1. Dapatkan Profil Admin
    const meRes = await API.Auth.getMe();
    const user = meRes.data?.user || Storage.getUser();
    if (user && user.role !== 'admin') {
      showToast('❌ Akses ditolak! Anda bukan Admin.');
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
      return;
    }

    if (user) {
      document.querySelectorAll('.auc-av, .apb-av').forEach(el => el.textContent = 'SA');
      document.querySelectorAll('.apb-name').forEach(el => el.textContent = user.name);
      document.querySelectorAll('.apb-email').forEach(el => el.textContent = user.email);
    }

    // 2. Fetch Data Dashboard (Dummy endpoint hit to simulate if endpoint doesn't fully exist)
    const dashRes = await API.Admin.getDashboard().catch(() => null);
    if (dashRes && dashRes.success) {
      // Update UI stat cards
      const vEls = document.querySelectorAll('.asc-v');
      if (vEls.length > 0) {
        vEls[0].textContent = dashRes.data.total_users || '0';
        vEls[1].textContent = dashRes.data.total_petugas || '0';
        vEls[3].textContent = dashRes.data.total_pickups || '0';
      }
    }

    // 3. Fetch Data Users untuk Tabel (jika diperlukan)
    const usersRes = await fetch(window.API_BASE + '/users', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    }).catch(() => null);
    if (usersRes && usersRes.ok && document.getElementById('section-users')) {
      const data = await usersRes.json();
      // Implementasi render tabel dinamis
      const tb = document.querySelector('#section-users tbody');
      if (tb && data.data && data.data.length > 0) {
        let html = '';
        data.data.forEach((u, i) => {
          const roleClass = u.role === 'admin' ? 'gold-role' : (u.role === 'petugas' ? 'green-role' : 'green-role');
          const roleName = u.role === 'admin' ? 'Admin' : (u.role === 'petugas' ? 'Petugas' : 'User');
          const initials = u.name.substring(0, 2).toUpperCase();
          html += `<tr><td>${i+1}</td><td><div class="t-user"><div class="t-av">${initials}</div>${u.name}</div></td><td>${u.email}</td><td><span class="role-tag ${roleClass}">${roleName}</span></td><td>—</td><td>—</td><td><span class="s-dot green"></span>Aktif</td><td>-</td><td><div class="t-act-btns"><button class="t-edit">Edit</button></div></td></tr>`;
        });
        tb.innerHTML = html;
      }
    }

  } catch (err) {
    console.error('Gagal memuat data admin', err);
  }
}

// ==================== RECENT TRANSACTIONS ====================
async function fetchRecentTransactions() {
  try {
    const res = await fetch(window.API_BASE + '/transactions?limit=15', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const data = await res.json();
    const tbody = document.getElementById('txnTableBody');
    if (data && data.success && tbody) {
      let html = '';
      data.data.forEach(t => {
        let actBtn = '';
        if (t.status === 'pending') {
          actBtn = `<button class="btn-primary-sm" style="font-size:11px; padding:4px 8px;" onclick="updateTxnStatus('${t.id}', 'confirmed')">Terima Order</button>`;
        } else if (t.status === 'arrived' || t.status === 'weighing' || t.status === 'on_way' || t.status === 'confirmed') {
          actBtn = `<button class="btn-primary-sm" style="font-size:11px; padding:4px 8px; background:var(--primary);" onclick="updateTxnStatus('${t.id}', 'completed')">Selesai & Bayar</button>`;
        } else if (t.status === 'completed') {
          actBtn = `<span style="font-size:12px; color:var(--primary); font-weight:bold;">Lunas ✅</span>`;
        } else if (t.status === 'cancelled') {
          actBtn = `<span style="font-size:12px; color:var(--error); font-weight:bold;">Batal ❌</span>`;
        }

        html += `<tr>
          <td style="font-family:monospace; color:var(--t4);">${t.id.substring(0,8).toUpperCase()}</td>
          <td style="font-weight:600; color:var(--t1);">${t.user_name}</td>
          <td>${t.petugas_name || '<span style="color:var(--t4)">Belum ada</span>'}</td>
          <td>${t.category_icon} ${t.category_name}</td>
          <td style="font-weight:600;">${t.weight_kg} Kg</td>
          <td style="color:var(--primary); font-weight:600;">Rp ${t.total_price.toLocaleString('id-ID')}</td>
          <td><span class="status-pill ${t.status === 'completed' ? 'active' : ''}">${t.status}</span></td>
          <td style="color:var(--t4); font-size:12px;">${new Date(t.created_at).toLocaleDateString()}</td>
          <td>${actBtn}</td>
        </tr>`;
      });
      tbody.innerHTML = html || '<tr><td colspan="9" style="text-align:center; padding:32px;">Belum ada transaksi jual sampah dari User</td></tr>';
    }
  } catch(err) { console.error(err); }
}

async function updateTxnStatus(id, status) {
  try {
    const res = await fetch(`${window.API_BASE}/transactions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API.Storage.getToken()}` },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if(data.success) {
      if(status === 'completed') showToast('✅ Transaksi Selesai! Saldo dikirim ke User.');
      else showToast(`✅ Status diupdate ke ${status}`);
      fetchRecentTransactions();
      fetchDashboardData();
    } else {
      showToast('❌ Gagal: ' + data.message);
    }
  } catch(e) {
    showToast('❌ Terjadi kesalahan saat update transaksi');
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initDashboardCharts, 500);
  initAdminDashboard();
  fetchDashboardData();
  fetchRecentTransactions();

  // Set sidebar state based on screen size
  const sb = document.getElementById('adminSidebar');
  if (window.innerWidth <= 768 && sb) {
    sb.classList.remove('open');
  }

  console.log('⚙️ PilahPilih Admin Panel v2.0 Loaded');
});
