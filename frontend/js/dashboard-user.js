'use strict';
/* ================================================
   PILAH PILIH – Dashboard User Logic v2.0
   ================================================ */

const UserApp = {
  isDark: true,
  wVal: 5.0,
  charts: {},
  currentPage: 'home',
  currentCatId: 1,
  currentCatPrice: 2500,
};

// ==================== PAGE NAVIGATION ====================
async function goPage(id) {
  try {
    const res = await fetch(`views/${id}.html?v=` + new Date().getTime());
    if (!res.ok) throw new Error('Not found');
    const html = await res.text();
    document.getElementById('app-root').innerHTML = html;
    
    window.scrollTo(0, 0);
    UserApp.currentPage = id;
    updateNavActive(id);
    
    // Re-initialize scripts for specific pages
    if (id === 'home') {
      setGreeting();
      setTimeout(initMiniChart, 300);
      initDashboard();
    } else if (id === 'profile') {
      initDashboard();
    } else if (id === 'riwayat-pickup' || id === 'riwayat-penjualan') {
      loadUserTransactions();
    } else if (id === 'reward') {
      loadRewards();
    } else if (id === 'dompet') {
      loadWallet();
    } else if (id === 'tracking' || id === 'tracking-user' || id === 'pickup-berjalan') {
      setTimeout(() => initTrackingMap(), 300);
    } else if (id === 'jual-sampah') {
      setTimeout(loadJualSampah, 100);
    } else if (id === 'chat') {
      setTimeout(loadChat, 100);
    } else if (id === 'edit-profil') {
      setTimeout(loadEditProfile, 100);
    }
    
    // Re-attach listeners for dynamic elements
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
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  const map = { home: 'nav-home', 'riwayat-pickup': 'nav-pickup', reward: 'nav-reward', profile: 'nav-profile' };
  if (map[id]) document.getElementById(map[id])?.classList.add('active');
}

// ==================== GREETING ====================
function setGreeting() {
  const hour = new Date().getHours();
  let greet = 'Selamat Pagi ☀️';
  if (hour >= 11 && hour < 15) greet = 'Selamat Siang 🌤';
  else if (hour >= 15 && hour < 18) greet = 'Selamat Sore 🌅';
  else if (hour >= 18) greet = 'Selamat Malam 🌙';
  const el = document.getElementById('greetText');
  if (el) el.textContent = greet;
}

// ==================== THEME ====================
function toggleTheme() {
  UserApp.isDark = !UserApp.isDark;
  document.documentElement.setAttribute('data-theme', UserApp.isDark ? 'dark' : 'light');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = UserApp.isDark ? '🌙' : '☀️';
  const tog = document.getElementById('profileToggle');
  if (tog) tog.classList.toggle('active', UserApp.isDark);
  showToast(UserApp.isDark ? '🌙 Mode Gelap Aktif' : '☀️ Mode Terang Aktif');
  Object.values(UserApp.charts).forEach(c => c?.destroy?.());
  UserApp.charts = {};
  if (UserApp.currentPage === 'home') setTimeout(initMiniChart, 300);
}

// ==================== LOGOUT ====================
function logout() {
  if (confirm('Yakin ingin keluar dari akun?')) {
    showToast('👋 Sampai jumpa!');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
  }
}

// ==================== WEIGHT CONTROL ====================
function updatePriceDisplay() {
  const price = UserApp.currentCatPrice || 2500;
  const total = UserApp.wVal * price;
  const el = document.getElementById('wVal');
  const pe = document.getElementById('priceEst');
  const psSB = document.getElementById('psSummBerat');
  const psT = document.getElementById('psTotal');
  const psB = document.getElementById('psBonus');
  const psHargaKg = document.getElementById('psHargaKg');
  if (el) el.textContent = UserApp.wVal.toFixed(1);
  if (pe) pe.textContent = 'Rp ' + total.toLocaleString('id-ID');
  if (psSB) psSB.textContent = UserApp.wVal.toFixed(1) + ' kg';
  if (psT) psT.textContent = 'Rp ' + total.toLocaleString('id-ID');
  if (psB) psB.textContent = '+' + Math.floor(UserApp.wVal * 10) + ' pts ⭐';
  if (psHargaKg) psHargaKg.textContent = 'Rp ' + price.toLocaleString('id-ID');
}

function chgWeight(d) {
  UserApp.wVal = Math.max(4.0, Math.round((UserApp.wVal + d) * 10) / 10);
  updatePriceDisplay();
}

// ==================== CATEGORY ====================
function pickCat(el) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  UserApp.currentCatPrice = parseInt(el.dataset.price) || 2500;
  UserApp.currentCatId = parseInt(el.dataset.id) || 1;
  updatePriceDisplay();
  
  // Auto-fill nama sampah
  const wasteNameInput = document.getElementById('wasteNameInput');
  if (wasteNameInput) {
    wasteNameInput.value = el.innerText.trim();
  }
}

function pickCond(el) {
  const p = el.closest('.cond-wrap');
  p.querySelectorAll('.cond-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function pickPayment(el) {
  const p = el.closest('#paymentMethodWrap');
  p.querySelectorAll('.cond-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ==================== WALLET ====================
function pickWallet(el, name) {
  document.querySelectorAll('.ew-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const t = document.getElementById('walletTitle');
  const bsg = document.getElementById('bankSelectGroup');
  const wi = document.getElementById('walletIcon');
  const wt = document.getElementById('walletTarget');
  
  if (t) t.textContent = `Tarik ke ${name}`;
  
  if (name === 'Transfer Bank') {
    if (bsg) bsg.style.display = 'block';
    if (wi) wi.textContent = '🏦';
    if (wt) wt.placeholder = 'Nomor Rekening';
  } else {
    if (bsg) bsg.style.display = 'none';
    if (wi) wi.textContent = '📱';
    if (wt) wt.placeholder = `Nomor ${name}`;
  }
}

function setAmount(val) {
  const inp = document.getElementById('withdrawAmount');
  if (inp) inp.value = val;
  showToast(`💰 Set nominal Rp ${val.toLocaleString('id-ID')}`);
}

async function processWithdrawal() {
  const amountStr = document.getElementById('withdrawAmount')?.value;
  const dest = document.getElementById('walletTarget')?.value;
  const activeEw = document.querySelector('.ew-card.active p')?.textContent;
  let method = activeEw || 'DANA';
  let bankName = '';
  
  if (method === 'Bank') {
    bankName = document.getElementById('bankName')?.value || 'BCA';
  }

  if (!amountStr || !dest) {
    showToast('⚠️ Lengkapi nomor tujuan dan nominal!');
    return;
  }
  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount < 50000) {
    showToast('⚠️ Minimal penarikan Rp 50.000!');
    return;
  }

  // Format method for backend validation
  let apiMethod = method.toLowerCase();
  if (apiMethod === 'shopee') apiMethod = 'shopeepay';
  if (apiMethod === 'bank') apiMethod = 'bank_transfer';
  
  // For bank transfer, we can prefix the account number with bank name
  const finalDest = apiMethod === 'bank_transfer' ? `${bankName} - ${dest}` : dest;

  try {
    const res = await API.Wallet.withdraw({ 
      amount: amount, 
      method: apiMethod, 
      account_number: finalDest,
      account_name: 'Pemilik Rekening' // backend validation requires this
    });
    
    if (res.success) {
      showToast('✅ ' + res.message);
      document.getElementById('withdrawAmount').value = '';
      document.getElementById('walletTarget').value = '';
      if(typeof loadWallet === 'function') loadWallet();
    } else {
      showToast('❌ ' + (res.message || 'Gagal ditarik'));
    }
  } catch (err) {
    showToast('❌ Gagal menarik dana: ' + err.message);
  }
}

// ==================== PREVIEW PHOTO ====================
function previewPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const uploadBox = input.closest('.fg').querySelector('.upload-box');
      uploadBox.style.backgroundImage = `url(${e.target.result})`;
      uploadBox.style.backgroundSize = 'cover';
      uploadBox.style.backgroundPosition = 'center';
      uploadBox.style.border = 'none';
      const inner = uploadBox.querySelector('.ub-inner');
      if (inner) inner.style.display = 'none';
      showToast('📷 Foto siap diupload!');
    }
    reader.readAsDataURL(input.files[0]);
  }
}

// ==================== SUBMIT PICKUP ====================
async function submitPickup() {
  const wasteName = document.getElementById('wasteNameInput')?.value?.trim();
  if (!wasteName) { showToast('⚠️ Masukkan nama sampah terlebih dahulu'); return; }
  const location = document.getElementById('locationInput')?.value?.trim();
  if (!location) { showToast('⚠️ Masukkan lokasi penjemputan'); return; }

  let condition = 'bersih';
  const activeCond = document.querySelector('.cond-chip.active')?.textContent?.toLowerCase() || '';
  if (activeCond.includes('kotor')) condition = 'kotor';
  if (activeCond.includes('campuran')) condition = 'campuran';

  const payload = {
    waste_name: wasteName,
    category_id: UserApp.currentCatId || 1,
    weight_kg: UserApp.wVal,
    address: location,
    condition: condition,
    payment_method: document.querySelector('#paymentMethodWrap .cond-chip.active')?.getAttribute('data-val') || 'wallet',
    notes: document.querySelector('textarea')?.value || '',
  };

  const btn = document.querySelector('.btn-primary[onclick="submitPickup()"]');
  if (btn) { btn.textContent = '⏳ Mengirim...'; btn.disabled = true; }
  try {
    showToast('⏳ Mengirim request...');
    await API.Transaction.create(payload);
    showModal('successModal');
  } catch (err) {
    showToast('❌ Gagal: ' + err.message);
  } finally {
    if (btn) { btn.textContent = '🚀 Ajukan Pickup Sekarang'; btn.disabled = false; }
  }
}

function handleUpload() {
  showToast('📷 Foto berhasil diupload!');
}

function handleUserAvatarUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      localStorage.setItem('user_avatar', dataUrl); // fallback
      API.User.updateProfile({ avatar: dataUrl }).then(res => {
        if(res.success) API.Storage.setUser(res.data);
      }).catch(err => console.log('Gagal simpan avatar ke server'));
      
      document.querySelectorAll('.ph-av, .hdr-av').forEach(el => {
        el.textContent = '';
        el.style.setProperty('background-image', `url("${dataUrl}")`, 'important');
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      });
      showToast('✅ Foto profil berhasil diperbarui!');
    };
    reader.readAsDataURL(file);
  }
}

// ==================== LOAD JUAL SAMPAH ====================
async function loadJualSampah() {
  // Fetch kategori dari database
  try {
    const cats = [
      { id: 1, name: 'Besi', price_per_kg: 5000 },
      { id: 2, name: 'Kertas/Buku', price_per_kg: 1500 },
      { id: 3, name: 'Kardus', price_per_kg: 2500 },
      { id: 4, name: 'Botol Plastik', price_per_kg: 3000 },
      { id: 5, name: 'Kresek', price_per_kg: 500 }
    ];
    const catWrap = document.querySelector('.cat-wrap');
      if (catWrap) {
        catWrap.innerHTML = cats.map((cat, idx) =>
          `<div class="cat-chip ${idx === 0 ? 'active' : ''}" onclick="pickCat(this)" data-id="${cat.id}" data-price="${cat.price_per_kg}">${cat.name}</div>`
        ).join('');
        // Set harga kategori pertama
        UserApp.currentCatId = cats[0].id;
        UserApp.currentCatPrice = cats[0].price_per_kg;
        updatePriceDisplay();
      }
  } catch (err) {
    console.error('Gagal load kategori', err);
  }

  // Pre-fill alamat dari profil user jika ada
  try {
    const user = API.Storage.getUser();
    const locationInput = document.getElementById('locationInput');
    if (locationInput && user) {
      // Kosongkan default hardcoded, biarkan user isi
      if (locationInput.value === 'Jl. Sudirman No. 45, Pekanbaru') {
        locationInput.value = '';
      }
    }
  } catch (e) {}
}

// ==================== AI SCAN ====================
function simulateScan() {
  showToast('🤖 AI Menganalisa...');
  setTimeout(() => {
    document.getElementById('aiResult')?.classList.add('show');
  }, 1500);
}

// ==================== REWARD ====================
function switchTab(btn, contentId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(contentId)?.classList.add('active');
}

function showRewardModal(name, cost, ico) {
  const title = document.getElementById('rewardModalTitle');
  const costEl = document.getElementById('rewardCost');
  const icoEl = document.getElementById('rewardIco');
  if (title) title.textContent = name;
  if (costEl) costEl.textContent = `-${parseInt(cost).toLocaleString('id-ID')} pts`;
  if (icoEl) {
    if (ico && ico.includes('http')) {
      icoEl.innerHTML = `<img src="${ico}" style="width:64px;height:64px;object-fit:contain;" />`;
      icoEl.style.background = 'transparent';
    } else {
      icoEl.innerHTML = ico || '🎁';
      icoEl.style.background = '';
    }
  }
  showModal('rewardModal');
}

// ==================== NOTIFICATIONS ====================
function clearNotifs() {
  document.querySelectorAll('.ni-unread').forEach(d => d.remove());
  document.querySelectorAll('.notif-item.unread').forEach(i => i.classList.remove('unread'));
  document.querySelectorAll('.badge-dot').forEach(b => { b.textContent = '0'; b.style.display = 'none'; });
  showToast('✅ Notifikasi dibersihkan');
}

// ==================== MODALS ====================
function showModal(id) {
  document.getElementById(id)?.classList.add('show');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('show');
}

// ==================== CHAT ====================
let chatPollInterval = null;
let homeChatInterval = null;

async function checkUnreadChatBadge() {
  const badgeEl = document.getElementById('homeChatBadge');
  if (!badgeEl) return;
  try {
    const res = await API.Pickup.getAll();
    if (res.success && res.data.length > 0) {
      const latest = res.data[0];
      if (latest.status === 'completed' || latest.status === 'cancelled') {
        badgeEl.style.display = 'none';
        return;
      }
      const chatRes = await API.Pickup.getChat(latest.id);
      if (chatRes.success) {
        const msgs = chatRes.data;
        const me = API.Storage.getUser();
        const lastRead = parseInt(localStorage.getItem('last_read_chat_' + latest.id) || '0');
        let petugasCount = 0;
        msgs.forEach(m => { if (m.sender_id !== me.id) petugasCount++; });
        let unread = petugasCount - lastRead;
        if (unread > 0) {
          badgeEl.textContent = unread;
          badgeEl.style.display = 'flex';
        } else {
          badgeEl.style.display = 'none';
        }
      }
    } else { badgeEl.style.display = 'none'; }
  } catch(e) { badgeEl.style.display = 'none'; }
}

async function loadChat() {
  if (!window.currentPickupId) {
    try {
      const res = await API.Pickup.getAll();
      if (res.success && res.data.length > 0) {
        const latestPickup = res.data[0];
        if (latestPickup.status === 'completed' || latestPickup.status === 'cancelled') {
          showToast('⚠️ Barang sudah diambil, chat dinonaktifkan.');
          goPage('home');
          return;
        }
        window.currentPickupId = latestPickup.id;
      } else {
        showToast('⚠️ Belum ada pesanan aktif.');
        goPage('home');
        return;
      }
    } catch(e) {
      goPage('home');
      return;
    }
  }
  
  // Update chat header with correct name
  try {
    const pickupRes = await API.Pickup.getById(window.currentPickupId);
    if (pickupRes.success) {
      const p = pickupRes.data;
      if (p.status === 'completed' || p.status === 'cancelled') {
        showToast('⚠️ Barang sudah diambil, chat dinonaktifkan.');
        goPage('home');
        return;
      }
      const me = API.Storage.getUser();
      // If user is logged in, chat partner is petugas
      const partnerName = p.petugas_name || 'Petugas PilahPilih';
      
      const nameEl = document.querySelector('.ch-name');
      const avEl = document.querySelector('.ch-av');
      const statEl = document.querySelector('.ch-status');
      const savedPetugasAv = p.petugas_avatar || localStorage.getItem('petugas_avatar');
      
      if (nameEl) nameEl.textContent = partnerName;
      if (avEl) {
        avEl.innerHTML = savedPetugasAv 
          ? `<img src="${savedPetugasAv}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
          : `<img src="https://ui-avatars.com/api/?name=${partnerName}&background=0A4222&color=fff&rounded=true" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        avEl.style.background = 'transparent';
      }
      if (statEl) statEl.innerHTML = `● ORD-${p.id.substring(0,6).toUpperCase()} · ${p.status.toUpperCase()}`;
      
      checkUnreadChatBadge();
      if (!homeChatInterval) homeChatInterval = setInterval(checkUnreadChatBadge, 5000);
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
      const msgs = res.data;
      const me = API.Storage.getUser();
      let petugasCount = 0;

      msgsContainer.innerHTML = '<div class="chat-date">Hari ini</div>';
      msgs.forEach(m => {
        const isMe = (m.sender_id === me.id);
        if (!isMe) petugasCount++;
        const time = new Date(m.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
        
        let avatarHtml = '';
        if (isMe) {
          const myAv = user.avatar || localStorage.getItem('user_avatar');
          avatarHtml = myAv 
            ? `<div class="cm-av" style="background:transparent;"><img src="${myAv}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>`
            : `<div class="cm-av" style="background:transparent;"><img src="https://ui-avatars.com/api/?name=${user.name||'U'}&background=0A4222&color=fff&rounded=true" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>`;
        } else {
          const senderAv = m.sender_avatar || localStorage.getItem('petugas_avatar');
          avatarHtml = senderAv
            ? `<div class="cm-av" style="background:transparent;"><img src="${senderAv}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>`
            : `<div class="cm-av" style="background:transparent;"><img src="https://ui-avatars.com/api/?name=Petugas&background=0A4222&color=fff&rounded=true" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>`;
        }

        msgsContainer.innerHTML += `
          <div class="chat-msg ${isMe ? 'sent' : 'recv'}">
            ${avatarHtml}
            <div class="cm-bubble ${isMe ? 'sent-b-blue' : 'recv-b'}">
              <p>${m.message}</p><span>${time}</span>
            </div>
          </div>
        `;
      });
      localStorage.setItem('last_read_chat_' + window.currentPickupId, petugasCount);
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

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

window.callPetugas = function() {
  if (window.currentPetugasPhone) {
    window.location.href = 'tel:' + window.currentPetugasPhone;
  } else {
    showToast('⚠️ Nomor telepon petugas belum tersedia');
  }
};

// ==================== MINI CHART ====================
async function initMiniChart() {
  const el = document.getElementById('miniChart');
  if (!el) return;
  if (UserApp.charts['miniChart']) {
    UserApp.charts['miniChart'].destroy();
  }

  const isDark = UserApp.isDark;
  Chart.defaults.color = isDark ? 'rgba(255,255,255,0.4)' : '#64748B';
  Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  let chartData = [0, 0, 0, 0, 0, 0];
  try {
    const res = await API.Transaction.getAll();
    if (res.success && res.data) {
      // Aggregate by month for the last 6 months
      const now = new Date();
      res.data.forEach(t => {
        if (t.status === 'completed') {
          const d = new Date(t.created_at);
          const monthDiff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
          if (monthDiff >= 0 && monthDiff < 6) {
            chartData[5 - monthDiff] += t.total_price || 0;
          }
        }
      });
    }
  } catch (err) {
    console.error('Failed to load chart data', err);
  }

  // Generate labels for last 6 months
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const labels = [];
  const currMonth = new Date().getMonth();
  for (let i = 5; i >= 0; i--) {
    labels.push(months[(currMonth - i + 12) % 12]);
  }

  UserApp.charts['miniChart'] = new Chart(el, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Pendapatan',
        data: chartData,
        borderColor: '#0A4222',
        backgroundColor: 'rgba(0,208,132,0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#0A4222',
        pointRadius: 4,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: v => `Rp ${v.raw.toLocaleString('id-ID')}` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => `${(v/1000).toFixed(0)}K` } }
      }
    }
  });
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

// ==================== KEYBOARD ====================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  }
});

async function initDashboard() {
  if (!window.API || !API.Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const meRes = await API.Auth.getMe();
    const user = meRes.data?.user || API.Storage.getUser();
    if (user) {
      document.querySelectorAll('.ph-name').forEach(el => el.textContent = user.name);
      document.querySelectorAll('.ph-email').forEach(el => el.textContent = user.email);
      const parts = user.name.split(' ');
      const initials = parts[0][0] + (parts[1] ? parts[1][0] : '');
      
      const savedAv = localStorage.getItem('user_avatar');
      document.querySelectorAll('.ph-av, .hdr-av').forEach(el => {
        if (savedAv) {
          el.textContent = '';
          el.style.setProperty('background-image', `url("${savedAv}")`, 'important');
          el.style.backgroundSize = 'cover';
          el.style.backgroundPosition = 'center';
        } else {
          el.textContent = initials.toUpperCase();
          el.style.removeProperty('background-image');
        }
      });
    }

    const balRes = await API.Wallet.getBalance();
    if (balRes.success) {
      const balEl = document.querySelector('.wc-balance');
      if (balEl) balEl.textContent = API.Format.currency(balRes.data.balance);
      const statEarning = document.getElementById('statEarning');
      if (statEarning) statEarning.textContent = API.Format.currency(balRes.data.balance);
    }
    
    const statsRes = await API.User.getStats();
    if (statsRes.success && statsRes.data.profile) {
      const p = statsRes.data.profile;
      const statPoints = document.getElementById('statPoints');
      const statLevel = document.getElementById('statLevel');
      if (statPoints) statPoints.innerHTML = `${p.points} pts ⭐`;
      if (statLevel) statLevel.innerHTML = `${p.level} 🥇`;
    }
    
    const txnsRes = await API.Transaction.getAll({ limit: 2 });
    if (txnsRes.success) {
      const container = document.getElementById('homeRecentTxns');
      if (container) {
        if (txnsRes.data.length === 0) {
          container.innerHTML = '<p style="text-align:center;color:var(--t4);font-size:12px;padding:10px;">Belum ada transaksi</p>';
        } else {
          container.innerHTML = txnsRes.data.map(t => `
            <div class="history-card" onclick="goPage('riwayat-pickup')">
              <div class="hc-hdr"><span>${t.id.substring(0,12).toUpperCase()}</span><span class="tag-${t.status==='completed'?'done':'process'}">${t.status}</span></div>
              <div class="hc-body">
                <div class="hc-row">Jual <b>${t.waste_name} (${t.weight_kg||0} kg)</b></div>
                <div class="hc-row"><span class="green">+ Rp ${t.total_price?t.total_price.toLocaleString('id-ID'):0}</span></div>
              </div>
            </div>
          `).join('');
        }
      }
    }
    
    // Check for unrated pickups
    checkUnratedPickups();
    
    checkUnreadChatBadge();
    if (!homeChatInterval) homeChatInterval = setInterval(checkUnreadChatBadge, 5000);

    // NEW LAYOUT FETCHES
    if(typeof loadHomePrices === 'function') loadHomePrices();
    if(typeof loadHomeInfo === 'function') loadHomeInfo();
  } catch (err) {
    console.error('Gagal memuat data dashboard', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Load initial page
  goPage('home');

  console.log('🌱 PilahPilih Dashboard User v2.0 Loaded (Modular)');
});

// ==================== DATA LOADERS ====================
async function loadUserTransactions() {
  const container = document.getElementById('riwayatList');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--t4);">Memuat data...</p>';
  try {
    const pRes = await API.User.getProfile();
    if (pRes.success && pRes.data && pRes.data.profile) {
      const p = pRes.data.profile;
      const statKg = document.getElementById('statTotalKg');
      const statRp = document.getElementById('statTotalRp');
      const statPts = document.getElementById('statTotalPts');
      if(statKg) statKg.textContent = `${p.total_sold_kg || 0} kg`;
      if(statRp) statRp.textContent = `Rp ${p.total_income ? p.total_income.toLocaleString('id-ID') : 0}`;
      if(statPts) statPts.textContent = `${p.points ? p.points.toLocaleString('id-ID') : 0} pts`;
    }

    const res = await API.Transaction.getAll();
    if (res.success && res.data.length > 0) {
      container.innerHTML = res.data.map(t => `
        <div class="history-card ${t.status==='cancelled'?'cancelled':''}">
          <div class="hc-hdr">
            <span>${t.id.substring(0,12).toUpperCase()}</span>
            <span class="tag-${t.status==='completed'?'done':(t.status==='pending'?'process':(t.status==='on_way'?'onway':'cancel'))}">
              ${t.status.toUpperCase()}
            </span>
          </div>
          <div class="hc-body">
            <div class="hc-row">Jual <b>${t.waste_name} (${t.weight_kg||0} kg)</b></div>
            <div class="hc-row"><span class="green">+ Rp ${t.total_price?t.total_price.toLocaleString('id-ID'):0}</span></div>
            <div class="hc-row" style="font-size:11px;color:var(--t4);">${API.Format.datetime(t.created_at)}</div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--t4);">Belum ada riwayat transaksi</p>';
    }
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--red);">Gagal memuat data</p>';
  }
}

async function loadRewards() {
  const container = document.getElementById('rewardContainer');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--t4);grid-column: span 2;">Memuat hadiah...</p>';
  try {
    const res = await API.Reward.getAll();
    if (res.success && res.data.length > 0) {
      container.innerHTML = res.data.map(r => {
        let iconUrl = '';
        const nameL = r.name.toLowerCase();
        if (nameL.includes('pulsa') || nameL.includes('data')) iconUrl = 'https://img.icons8.com/color/96/000000/smartphone-tablet.png';
        else if (nameL.includes('pohon') || nameL.includes('bibit')) iconUrl = 'https://img.icons8.com/color/96/000000/plant-under-sun.png';
        else if (nameL.includes('tote') || nameL.includes('bag')) iconUrl = 'https://img.icons8.com/color/96/000000/shopping-bag.png';
        else if (nameL.includes('ovo') || nameL.includes('dana') || nameL.includes('gopay')) iconUrl = 'https://img.icons8.com/color/96/000000/wallet--v1.png';
        else iconUrl = 'https://img.icons8.com/color/96/000000/gift--v1.png';

        return `
        <div class="rw-card" onclick="showRewardModal('${r.name}', ${r.cost_points}, '${iconUrl}', '${r.id}')">
          <div class="rw-ico"><img src="${iconUrl}" alt="${r.name}" /></div>
          <p class="rw-name">${r.name}</p>
          <p class="rw-pts">${r.cost_points} pts</p>
          <button class="rw-btn">Tukar Poin</button>
        </div>
        `;
      }).join('');
    } else {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--t4);grid-column: span 2;">Belum ada hadiah tersedia</p>';
    }
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--red);grid-column: span 2;">Gagal memuat hadiah</p>';
  }
}

async function confirmRedeemReward(id) {
  try {
    const res = await API.Reward.redeem(id);
    closeModal('rewardModal');
    if (res.success) {
      showToast('🎉 Berhasil tukar poin!');
      initDashboard(); // Refresh points
    }
  } catch (err) {
    showToast('❌ Gagal tukar: ' + err.message);
  }
}

async function loadWallet() {
  const container = document.getElementById('walletHistory');
  const dompetBal = document.getElementById('dompetBalance');
  if (dompetBal) {
    const balRes = await API.Wallet.getBalance();
    if (balRes.success) dompetBal.textContent = API.Format.currency(balRes.data.balance);
  }
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--t4);">Memuat mutasi...</p>';
  try {
    const res = await API.Wallet.getHistory();
    if (res.success && res.data) {
      let totalMasuk = 0;
      let totalKeluar = 0;
      res.data.forEach(t => {
        if (t.status === 'completed') {
          if (t.type === 'credit') totalMasuk += t.amount;
          else if (t.type === 'debit') totalKeluar += t.amount;
        }
      });
      
      const elMasuk = document.getElementById('dompetTotalMasuk');
      const elKeluar = document.getElementById('dompetTotalKeluar');
      if(elMasuk) elMasuk.textContent = API.Format.currency(totalMasuk);
      if(elKeluar) elKeluar.textContent = API.Format.currency(totalKeluar);

      if (res.data.length > 0) {
        container.innerHTML = res.data.map(t => `
        <div class="history-card">
          <div class="hc-hdr">
            <span>${t.type==='credit'?'Pemasukan':'Penarikan'}</span>
            <span class="tag-${t.status==='completed'?'done':(t.status==='pending'?'process':'cancel')}">${t.status}</span>
          </div>
          <div class="hc-body">
            <div class="hc-row">${t.description || '-'}</div>
            <div class="hc-row"><span class="${t.type==='credit'?'green':'red-text'}">${t.type==='credit'?'+':'-'} Rp ${t.amount?t.amount.toLocaleString('id-ID'):0}</span></div>
            <div class="hc-row" style="font-size:11px;color:var(--t4);">${API.Format.datetime(t.created_at)}</div>
          </div>
        </div>
      `).join('');
      } else {
        container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--t4);">Belum ada riwayat dompet</p>';
      }
    } else {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--red);">Gagal memuat mutasi</p>';
    }
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--red);">Gagal memuat dompet</p>';
  }
}

// ==================== MAP INITIALIZATION ====================
async function initTrackingMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  
  if (UserApp.mapInstance) {
    UserApp.mapInstance.remove();
  }

  // Set window.currentPickupId by finding active pickup
  try {
    const res = await API.Pickup.getAll();
    if (res.success && res.data) {
      const active = res.data.find(p => ['waiting', 'pending', 'confirmed', 'on_way', 'arrived', 'weighing'].includes(p.status));
      if (active) {
        window.currentPickupId = active.id;
        window.currentPetugasPhone = active.petugas_phone;
      }
    }
  } catch(e) { console.error(e); }

  // Create map
  UserApp.mapInstance = L.map('map', { zoomControl: false }).setView([0.5071, 101.4451], 15);
  
  // Add standard tile layer (CartoDB Positron for light theme look, but we can just use OSM)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(UserApp.mapInstance);

  // Add a marker for the pickup location
  L.marker([0.5071, 101.4451]).addTo(UserApp.mapInstance)
    .bindPopup('<b>Lokasi Anda</b><br>Menunggu Penjemputan')
    .openPopup();
}

function openMapSelection(inputId = 'locationInput') {
  UserApp.currentMapInputTarget = inputId;
  showModal('mapModal');
  setTimeout(() => {
    if (!UserApp.selectionMap) {
      UserApp.selectionMap = L.map('selectionMap', { zoomControl: false }).setView([0.5071, 101.4451], 15);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(UserApp.selectionMap);
      
      UserApp.selectionMarker = L.marker([0.5071, 101.4451], { draggable: true }).addTo(UserApp.selectionMap);
    } else {
      UserApp.selectionMap.invalidateSize();
    }
  }, 300);
}

async function confirmMapSelection() {
  if (UserApp.selectionMarker) {
    const targetId = UserApp.currentMapInputTarget || 'locationInput';
    const inp = document.getElementById(targetId);
    if (inp) {
      const lat = UserApp.selectionMarker.getLatLng().lat;
      const lng = UserApp.selectionMarker.getLatLng().lng;
      showToast('⏳ Mendapatkan alamat...');
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name) {
          inp.value = data.display_name;
          showToast('📍 Lokasi berhasil dipilih!');
        } else {
          inp.value = 'Titik Peta: ' + lat.toFixed(4) + ', ' + lng.toFixed(4);
          showToast('📍 Lokasi berhasil dipilih (Alamat tidak ditemukan)');
        }
      } catch (err) {
        inp.value = 'Titik Peta: ' + lat.toFixed(4) + ', ' + lng.toFixed(4);
        showToast('📍 Lokasi berhasil dipilih (Gagal memuat alamat)');
      }
    }
  }
  closeModal('mapModal');
}

async function searchLocation() {
  const query = document.getElementById('mapSearchInput')?.value;
  if (!query) return;
  showToast('Mencari lokasi...');
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      const { lat, lon, display_name } = data[0];
      const newLatLng = new L.LatLng(lat, lon);
      UserApp.selectionMap.setView(newLatLng, 15);
      UserApp.selectionMarker.setLatLng(newLatLng);
      showToast('✅ Lokasi ditemukan!');
    } else {
      showToast('❌ Lokasi tidak ditemukan');
    }
  } catch (err) {
    showToast('❌ Gagal mencari lokasi');
  }
}

// ==================== MANDATORY RATING ====================
async function checkUnratedPickups() {
  try {
    const res = await API.Transaction.getAll(); // Wait, in the user API, it's actually API.Pickup.getAll() or similar. We should check if we can get pickups. Actually let's fetch /api/pickups directly.
    const pickupRes = await fetch(window.API_BASE + '/pickups', {
      headers: { 'Authorization': `Bearer ${API.Storage.getToken()}` }
    });
    const pickups = await pickupRes.json();
    if (pickups.success && pickups.data) {
      const unrated = pickups.data.find(p => p.status === 'completed' && !p.rating);
      if (unrated) {
        document.getElementById('mandatoryPickupId').value = unrated.id;
        document.getElementById('mandatoryRatingModal').style.display = 'flex';
      }
    }
  } catch (err) {
    console.error('Gagal mengecek pickup belum dirating', err);
  }
}

function selectStar(num) {
  document.getElementById('mandatoryRatingValue').value = num;
  const stars = document.querySelectorAll('#starRatingContainer .star');
  stars.forEach((s, idx) => {
    if (idx < num) {
      s.style.color = '#FFD700'; // gold
    } else {
      s.style.color = 'var(--t4)';
    }
  });
  document.getElementById('btnSubmitRating').disabled = false;
}

async function submitRating() {
  const pickupId = document.getElementById('mandatoryPickupId').value;
  const rating = parseInt(document.getElementById('mandatoryRatingValue').value);
  if (!pickupId || !rating) return;
  
  const btn = document.getElementById('btnSubmitRating');
  btn.textContent = '⏳ Mengirim...';
  btn.disabled = true;
  
  try {
    const res = await fetch(`${window.API_BASE}/pickups/${pickupId}/rate`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${API.Storage.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rating, review: '' })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast('✅ Terima kasih atas penilaian Anda!');
      document.getElementById('mandatoryRatingModal').style.display = 'none';
      checkUnratedPickups(); // check if there are others
    } else {
      showToast('❌ Gagal: ' + data.message);
    }
  } catch (err) {
    showToast('❌ Gagal mengirim penilaian');
  } finally {
    btn.textContent = 'Kirim Penilaian';
    btn.disabled = false;
  }
}

// ==================== EDIT PROFILE ====================
async function loadEditProfile() {
  try {
    const res = await API.User.getProfile();
    if (res.success && res.data) {
      const p = res.data;
      document.getElementById('editName').value = p.name || '';
      document.getElementById('editEmail').value = p.email || '';
      document.getElementById('editPhone').value = p.phone || '';
      document.getElementById('editAddress').value = p.address || '';
      
      const avEl = document.querySelector('.ph-av');
      if (avEl) {
        if (p.avatar) {
          avEl.innerHTML = `<img src="${p.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
          avEl.style.background = 'transparent';
        } else {
          avEl.textContent = p.name ? p.name.substring(0, 2).toUpperCase() : 'U';
        }
      }
    }
  } catch(e) {
    console.error('Error load profile:', e);
  }
}

async function saveProfileChanges() {
  const name = document.getElementById('editName').value;
  const email = document.getElementById('editEmail').value;
  const phone = document.getElementById('editPhone').value;
  const address = document.getElementById('editAddress').value;
  
  const avImg = document.querySelector('.ph-av img');
  const avatar = avImg ? avImg.src : null;

  try {
    const res = await API.User.updateProfile({ name, email, phone, address, avatar });
    if (res.success) {
      showToast('✅ Profil berhasil diperbarui!');
      goPage('profile');
    } else {
      showToast('❌ Gagal: ' + (res.message || 'Error'));
    }
  } catch(e) {
    console.error('Error save profile:', e);
    showToast('❌ Terjadi kesalahan jaringan');
  }
}

// ==================== NEW LAYOUT DATA LOADERS ====================
async function loadHomePrices() {
  const container = document.getElementById('homePriceList');
  if (!container) return;
  try {
    const res = await apiCall('/api/categories/prices/latest');
    if (res.success && res.data.length > 0) {
      container.innerHTML = res.data.slice(0, 4).map(c => `
        <div class="price-item">
          <div class="pi-left">
            <img src="${c.icon || 'https://img.icons8.com/fluency/48/box.png'}" width="28">
            <p>${c.name}</p>
          </div>
          <div class="pi-right">Rp ${c.price_per_kg.toLocaleString('id-ID')} / Kg</div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="text-align:center;color:var(--t4);font-size:12px;padding:20px;">Harga belum tersedia</p>';
    }
  } catch(err) {
    console.error('Failed to load prices', err);
    container.innerHTML = '<p style="text-align:center;color:var(--t4);font-size:12px;padding:20px;">Gagal memuat harga</p>';
  }
}

async function loadHomeInfo() {
  const container = document.getElementById('homeInfoList');
  if (!container) return;
  try {
    const res = await API.Notification.getAll({ limit: 3 });
    if (res.success && res.data.length > 0) {
      container.innerHTML = res.data.slice(0, 3).map(n => `
        <div class="info-item">
          <div class="info-ico"><img src="https://img.icons8.com/fluency-systems-filled/48/10B981/info.png" width="20"></div>
          <div class="info-text">
            <h4>${n.title}</h4>
            <p>${n.body}</p>
          </div>
        </div>
      `).join('');
    } else {
      // Fallback dummy info matching the mockup if no real notifications exist
      container.innerHTML = `
        <div class="info-item">
          <div class="info-ico"><img src="https://img.icons8.com/fluency-systems-filled/48/10B981/bullish.png" width="20"></div>
          <div class="info-text">
            <h4>Harga plastik naik 5%</h4>
            <p>Mulai hari ini</p>
          </div>
        </div>
        <div class="info-item">
          <div class="info-ico"><img src="https://img.icons8.com/fluency-systems-filled/48/10B981/star.png" width="20"></div>
          <div class="info-text">
            <h4>Reward baru tersedia</h4>
            <p>Tukar poinmu sekarang</p>
          </div>
        </div>
        <div class="info-item">
          <div class="info-ico"><img src="https://img.icons8.com/fluency-systems-filled/48/10B981/truck.png" width="20"></div>
          <div class="info-text">
            <h4>Pickup tersedia 24 jam</h4>
            <p>Kami siap menjemput</p>
          </div>
        </div>
      `;
    }
  } catch(err) {
    console.error('Failed to load info', err);
    container.innerHTML = '<p style="text-align:center;color:var(--t4);font-size:12px;padding:20px;">Gagal memuat informasi</p>';
  }
}
