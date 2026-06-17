'use strict';
/* ================================================
   PILAH PILIH – App Logic v3.0
   Premium Redesign · Self-contained
   ================================================ */

const App = {
  currentRole: 'user',
  isDark: true,
  obSlide: 0,
  wVal: 2.5,
  wVal2: 2.8,
  otpInterval: null,
  charts: {},
};

// ==================== NAVIGATION ====================
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${id}`);
  if (!target) { console.warn('Screen not found:', id); return; }
  target.classList.add('active');
  window.scrollTo(0, 0);

  // Post-nav hooks
  if (id === 'verify-otp') startOTP();
  if (id === 'dashboard-admin') setTimeout(initAdminCharts, 300);
  if (id === 'admin-laporan') setTimeout(initLaporan, 300);
  if (id === 'ai-scan') document.getElementById('aiResult')?.classList.remove('show');
}

// ==================== SPLASH ====================
function initSplash() {
  const bar = document.getElementById('splashFill');
  const txt = document.querySelector('.splash-loading-text');
  const msgs = ['Memuat sistem...','Menghubungkan server...','Menyiapkan data...','Siap!'];
  let pct = 0, idx = 0;
  const iv = setInterval(() => {
    pct += Math.random() * 22 + 5;
    if (pct >= 100) { pct = 100; clearInterval(iv); setTimeout(() => goTo('onboarding'), 500); }
    if (bar) bar.style.width = pct + '%';
    if (txt && idx < msgs.length) { txt.textContent = msgs[Math.floor(pct / 30)] || msgs[3]; }
  }, 300);
}

// ==================== ONBOARDING ====================
function setSlide(i) {
  const slides = document.querySelectorAll('.ob-slide');
  const dots = document.querySelectorAll('.ob-dot');
  const btn = document.getElementById('obBtn');
  slides.forEach(s => s.classList.remove('active'));
  dots.forEach(d => d.classList.remove('active'));
  slides[i]?.classList.add('active');
  dots[i]?.classList.add('active');
  App.obSlide = i;
  if (btn) btn.textContent = i === 2 ? 'Mulai Sekarang 🚀' : 'Selanjutnya →';
}

function onboardingNext() {
  if (App.obSlide < 2) setSlide(App.obSlide + 1);
  else goTo('login');
}

// ==================== AUTH ====================
function switchAuthTab(tab) {
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  if (tab === 'login') {
    document.getElementById('tabLogin')?.classList.add('active');
    document.getElementById('formLogin')?.classList.add('active');
  } else {
    document.getElementById('tabReg')?.classList.add('active');
    document.getElementById('formRegister')?.classList.add('active');
  }
}

function pickRole(el, role) {
  document.querySelectorAll('.role-c').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  App.currentRole = role;
}

function doLogin() {
  const emailInput = document.querySelector('#formLogin .ig-input[type="email"]');
  const pwdInput   = document.getElementById('loginPwd');
  const email      = emailInput?.value?.trim();
  const password   = pwdInput?.value?.trim();

  // Jika API tersedia, gunakan API
  if (window.API && email && password) {
    showToast('⏳ Sedang login...');
    window.API.Auth.login(email, password)
      .then(res => {
        const role = res.data?.user?.role || 'user';
        App.currentRole = role;
        const dashMap = {
          user: 'dashboard-user.html', petugas: 'dashboard-petugas.html',
          bank_sampah: 'dashboard-pengepul.html', admin: 'dashboard-admin.html'
        };
        goTo(dashMap[role] || 'dashboard-user.html');
        const names = { user:'User', petugas:'Petugas', bank_sampah:'Bank Sampah', admin:'Administrator' };
        showToast(`✅ Login berhasil sebagai ${names[role]}!`);
        const fb = document.querySelector('.float-switcher');
        if (fb) fb.style.display = 'inline-flex';
      })
      .catch(err => {
        showToast(`❌ ${err.message}`);
      });
    return;
  }

  // DEMO mode (tanpa server)
  const destinations = {
    user: 'dashboard-user', petugas: 'dashboard-petugas',
    bank: 'dashboard-bank-sampah', admin: 'dashboard-admin',
  };
  goTo(destinations[App.currentRole] || 'dashboard-user');
  const names = { user:'User', petugas:'Petugas', bank:'Bank Sampah', admin:'Administrator' };
  showToast(`✅ Login berhasil sebagai ${names[App.currentRole]}! (Demo Mode)`);
  const fb = document.querySelector('.float-switcher');
  if (fb) fb.style.display = 'inline-flex';
}

function togglePwd(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

// ==================== OTP ====================
function startOTP() {
  if (App.otpInterval) clearInterval(App.otpInterval);
  let s = 120;
  const el = document.getElementById('otpTimer');
  App.otpInterval = setInterval(() => {
    s--;
    if (el) {
      const m = String(Math.floor(s/60)).padStart(2,'0');
      const sec = String(s%60).padStart(2,'0');
      el.textContent = `${m}:${sec}`;
    }
    if (s <= 0) clearInterval(App.otpInterval);
  }, 1000);
}

function otpNext(inp, idx) {
  const boxes = document.querySelectorAll('.otp-box');
  if (inp.value.length === 1 && idx < boxes.length - 1) boxes[idx+1]?.focus();
  const allFilled = Array.from(boxes).every(b => b.value.length === 1);
  if (allFilled) { showToast('✅ OTP Terverifikasi!'); setTimeout(() => doLogin(), 500); }
}

// ==================== THEME ====================
function toggleTheme() {
  App.isDark = !App.isDark;
  document.documentElement.setAttribute('data-theme', App.isDark ? 'dark' : 'light');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = App.isDark ? '🌙' : '☀️';
  const tog = document.getElementById('profileToggle');
  if (tog) tog.classList.toggle('active', App.isDark);
  showToast(App.isDark ? '🌙 Mode Gelap Aktif' : '☀️ Mode Terang Aktif');
  // Destroy and reinit charts if visible
  Object.values(App.charts).forEach(c => c?.destroy?.());
  App.charts = {};
}

// ==================== WEIGHT ====================
function chgW(d) {
  App.wVal = Math.max(0.5, Math.round((App.wVal + d) * 10) / 10);
  const el = document.getElementById('wVal');
  if (el) el.textContent = App.wVal;
  const pe = document.getElementById('priceEst');
  if (pe) pe.textContent = 'Rp ' + (App.wVal * 2000).toLocaleString('id-ID');
}

function chgW2(d) {
  App.wVal2 = Math.max(0.1, Math.round((App.wVal2 + d) * 10) / 10);
  const el = document.getElementById('w2Val');
  if (el) el.textContent = App.wVal2.toFixed(1);
  const th = document.getElementById('totalHarga');
  if (th) th.textContent = 'Rp ' + (App.wVal2 * 2000).toLocaleString('id-ID');
  const tf = document.getElementById('totalFormula');
  if (tf) tf.textContent = `${App.wVal2.toFixed(1)} kg × Rp 2.000`;
}

// ==================== CATEGORY ====================
function pickCat(el) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}
function pickCond(el) {
  document.querySelectorAll('.cond-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ==================== AI SCAN ====================
function simulateScan() {
  showToast('🤖 AI Menganalisa...');
  setTimeout(() => {
    document.getElementById('aiResult')?.classList.add('show');
  }, 1500);
}
function hideAI() {
  document.getElementById('aiResult')?.classList.remove('show');
}

// ==================== WALLET ====================
function pickWallet(el, name) {
  document.querySelectorAll('.ew-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const t = document.getElementById('walletTitle');
  if (t) t.textContent = `Tarik ke ${name}`;
}

// ==================== REWARD TABS ====================
function switchTab(btn, contentId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(contentId)?.classList.add('active');
}

function showRewardModal(name, cost) {
  const title = document.getElementById('rewardModalTitle');
  const costEl = document.getElementById('rewardCost');
  const ico = document.getElementById('rewardIco');
  const emojiMap = { 'Pulsa 10K':'📱', 'DANA 20K':'💳', 'OVO 15K':'💜', 'GoPay 25K':'💚', 'Voucher 50K':'🎟', 'Tote Bag Eco':'👜' };
  if (title) title.textContent = name;
  if (costEl) costEl.textContent = `-${parseInt(cost).toLocaleString('id-ID')} pts`;
  if (ico) ico.textContent = emojiMap[name] || '🎁';
  showModal('rewardModal');
}

// ==================== MODALS ====================
function showModal(id) {
  document.getElementById(id)?.classList.add('show');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('show');
}

// ==================== ROLE OVERLAY ====================
function showRoleOverlay() {
  document.getElementById('roleOverlay')?.classList.add('show');
}
function closeRoleOverlay() {
  document.getElementById('roleOverlay')?.classList.remove('show');
}
function switchRole(role) {
  closeRoleOverlay();
  App.currentRole = role;
  const destinations = { user:'dashboard-user', petugas:'dashboard-petugas', bank:'dashboard-bank-sampah', admin:'dashboard-admin' };
  goTo(destinations[role] || 'dashboard-user');
  const names = { user:'User 👤', petugas:'Petugas 🚛', bank:'Bank Sampah 🏦', admin:'Admin ⚙️' };
  showToast(`🔄 Tampilan: ${names[role]}`);
}

// ==================== STATUS TOGGLE ====================
function toggleStatus(el) {
  el.classList.toggle('active');
  el.textContent = el.classList.contains('active') ? '🟢 Online' : '🔴 Offline';
  showToast(el.classList.contains('active') ? '🟢 Status Online' : '🔴 Status Offline');
}

// ==================== SIDEBAR ====================
function toggleSidebar(id) {
  document.getElementById(id)?.classList.toggle('open');
}
function closeSidebar(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ==================== NOTIFICATIONS ====================
function clearNotifs() {
  document.querySelectorAll('.ni-unread').forEach(d => d.remove());
  document.querySelectorAll('.notif-item.unread').forEach(i => i.classList.remove('unread'));
  document.querySelectorAll('.badge-dot').forEach(b => b.remove());
  showToast('✅ Notifikasi dibersihkan');
}

// ==================== PERIOD SELECT ====================
function pickPeriod(btn) {
  document.querySelectorAll('.p-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  showToast(`📊 Data ${btn.textContent}`);
}

// ==================== SIGNATURE PAD ====================
let isDrawing = false, lastX = 0, lastY = 0;
function initSig() {
  const canvas = document.getElementById('sigCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#00D084';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const start = (x, y) => { isDrawing = true; [lastX, lastY] = [x, y]; document.getElementById('sigPH')?.style.setProperty('display','none'); };
  const draw = (x, y) => { if (!isDrawing) return; ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke(); [lastX, lastY] = [x, y]; };
  const stop = () => { isDrawing = false; };

  canvas.addEventListener('mousedown', e => { const r = canvas.getBoundingClientRect(); start(e.clientX-r.left, e.clientY-r.top); });
  canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); draw(e.clientX-r.left, e.clientY-r.top); });
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); const t = e.touches[0]; start(t.clientX-r.left, t.clientY-r.top); }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); const t = e.touches[0]; draw(t.clientX-r.left, t.clientY-r.top); }, { passive: false });
  canvas.addEventListener('touchend', stop);
}
function clearSig() {
  const canvas = document.getElementById('sigCanvas');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  const ph = document.getElementById('sigPH');
  if (ph) ph.style.removeProperty('display');
}

// ==================== CHAT CALL ====================
window.chatCallAttempts = 0;
window.callUser = function() {
  window.chatCallAttempts++;
  if (window.chatCallAttempts >= 3) {
    showToast('📞 Panggilan gagal 3x. Menampilkan kontak darurat.', 3000);
    const msgs = document.getElementById('chatMsgs');
    if (msgs) {
      const sysMsg = document.createElement('div');
      sysMsg.className = 'chat-date';
      sysMsg.style.color = 'var(--red)';
      sysMsg.style.marginTop = '12px';
      sysMsg.innerHTML = `⚠️ Panggilan darurat gagal 3x.<br/>Silakan hubungi WhatsApp User:<br/><a href="tel:081234567890" style="color:var(--red);text-decoration:underline;font-weight:bold;">0812-3456-7890</a>`;
      msgs.appendChild(sysMsg);
      msgs.scrollTop = msgs.scrollHeight;
    }
  } else {
    showToast(`📞 Memanggil... (Percobaan ${window.chatCallAttempts}/3)`);
  }
}

// ==================== CHAT ====================
function sendMsg() {
  const inp = document.getElementById('chatInput');
  const msgs = document.getElementById('chatMsgs');
  if (!inp || !msgs || !inp.value.trim()) return;
  const msg = inp.value.trim();
  inp.value = '';

  const now = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };

  // Sent
  const sent = document.createElement('div');
  sent.className = 'chat-msg sent';
  sent.innerHTML = `<div class="cm-bubble sent-b"><p>${esc(msg)}</p><span>${now()}</span></div>`;
  msgs.appendChild(sent);
  msgs.scrollTop = msgs.scrollHeight;

  // Auto reply
  const replies = [
    'Kami segera bantu Anda! 😊',
    'Terima kasih, sedang kami proses...',
    'Baik, akan kami tindaklanjuti.',
    'Ada yang bisa kami bantu lagi?',
    'Pickup Anda sedang berjalan! 🚛',
  ];
  setTimeout(() => {
    const recv = document.createElement('div');
    recv.className = 'chat-msg recv';
    recv.innerHTML = `<div class="cm-av">SP</div><div class="cm-bubble recv-b"><p>${replies[Math.floor(Math.random()*replies.length)]}</p><span>${now()}</span></div>`;
    msgs.appendChild(recv);
    msgs.scrollTop = msgs.scrollHeight;
  }, 1200);
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

// ==================== CHARTS ====================
function initAdminCharts() {
  const isDark = App.isDark;
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? 'rgba(255,255,255,0.45)' : '#64748B';
  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;

  const mk = (id, cfg) => {
    const el = document.getElementById(id);
    if (!el || App.charts[id]) return;
    App.charts[id] = new Chart(el, cfg);
  };

  mk('revenueChart', {
    type: 'bar',
    data: {
      labels: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'],
      datasets: [
        { label: 'Pendapatan (Rp)', data: [2800000,3200000,2900000,3800000,4200000,4800000,3900000,4500000,5100000,4700000,5300000,4800000], backgroundColor: 'rgba(0,208,132,0.75)', borderRadius: 6, borderSkipped: false },
        { label: 'Target', data: [3000000,3000000,3500000,3500000,4000000,4500000,4500000,4500000,5000000,5000000,5000000,5000000], type: 'line', borderColor: '#F59E0B', backgroundColor: 'transparent', borderDash: [5,5], pointBackgroundColor: '#F59E0B', tension: 0.4, pointRadius: 4 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: v => `Rp ${(v/1000000).toFixed(1)}M` } } } }
  });

  mk('wasteChart', {
    type: 'doughnut',
    data: {
      labels: ['Plastik','Kertas','Besi','Elektronik','Kaca','Lainnya'],
      datasets: [{ data: [35,25,18,12,6,4], backgroundColor: ['#00D084','#3B82F6','#8B5CF6','#F59E0B','#14B8A6','#6B7280'], borderWidth: 0, hoverOffset: 8 }]
    },
    options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } } } }
  });

  mk('pickupChart', {
    type: 'line',
    data: {
      labels: ['Jan','Feb','Mar','Apr','Mei','Jun'],
      datasets: [{ label: 'Pickup', data: [820,940,880,1120,1280,1450], borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#3B82F6', pointRadius: 4 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  mk('userChart', {
    type: 'line',
    data: {
      labels: ['Jan','Feb','Mar','Apr','Mei','Jun'],
      datasets: [{ label: 'User Baru', data: [1200,1580,1350,1890,2100,2450], borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.08)', fill: true, tension: 0.4, pointBackgroundColor: '#8B5CF6', pointRadius: 4 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

function initLaporan() {
  const isDark = App.isDark;
  Chart.defaults.color = isDark ? 'rgba(255,255,255,0.45)' : '#64748B';
  Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const mk = (id, cfg) => {
    const el = document.getElementById(id);
    if (!el || App.charts[id]) return;
    App.charts[id] = new Chart(el, cfg);
  };

  mk('lapRevChart', {
    type: 'bar',
    data: {
      labels: ['Jan','Feb','Mar','Apr','Mei','Jun'],
      datasets: [{ label: 'Pendapatan', data: [2800000,3200000,2900000,3800000,4200000,4800000], backgroundColor: 'rgba(0,208,132,0.75)', borderRadius: 6, borderSkipped: false }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => `Rp ${(v/1000000).toFixed(1)}M` } } } }
  });

  mk('lapWasteChart', {
    type: 'pie',
    data: {
      labels: ['Plastik','Kertas','Logam','Elektronik','Kaca'],
      datasets: [{ data: [38,24,20,12,6], backgroundColor: ['#00D084','#3B82F6','#8B5CF6','#F59E0B','#14B8A6'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'right', labels: { padding: 10, usePointStyle: true } } } }
  });
}

// ==================== KEYBOARD SHORTCUT ====================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.role-overlay.show').forEach(o => o.classList.remove('show'));
    document.querySelectorAll('.sidebar.open').forEach(s => s.classList.remove('open'));
  }
});

// ==================== RESPONSIVE SIDEBAR ====================
window.addEventListener('resize', () => {
  if (window.innerWidth > 900) {
    document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('open'));
  }
});

// ==================== CHAT ENTER KEY ====================
document.addEventListener('DOMContentLoaded', () => {
  const ci = document.getElementById('chatInput');
  if (ci) ci.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

  // Init splash
  initSplash();

  // Init signature pad
  setTimeout(initSig, 500);

  // Render profile data from localStorage
  function renderProfile() {
    const userName = localStorage.getItem('user_name');
    if (userName) {
      // Update names
      document.querySelectorAll('#userName, .ph-name').forEach(el => {
        el.textContent = userName;
      });
      // Update avatars (first letters of words)
      const initials = userName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
      document.querySelectorAll('#userAvatarText, .ph-av, .me-av').forEach(el => {
        el.textContent = initials;
      });
    }
  }
  renderProfile();

  console.log('🌱 Pilah Pilih v3.0 – Premium Redesign Loaded');
  console.log('💡 Tip: Gunakan tombol 🔄 di kanan bawah untuk ganti role');
});
