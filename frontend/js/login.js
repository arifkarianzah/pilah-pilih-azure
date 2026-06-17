'use strict';
/* ================================================
   PILAH PILIH – Login Page Logic
   Handles: Splash, Auth, OTP, Forgot Password
   ================================================ */

const Auth = {
  currentRole: 'user',
  otpInterval: null,
  isDark: true,
};

// ==================== SPLASH ====================
function initSplash() {
  const bar = document.getElementById('splashFill');
  const txt = document.getElementById('splashTxt');
  const msgs = ['Memuat sistem...', 'Menghubungkan server...', 'Menyiapkan data...', 'Siap! ✅'];
  let pct = 0;
  const iv = setInterval(() => {
    pct += Math.random() * 25 + 8;
    if (pct >= 100) {
      pct = 100;
      clearInterval(iv);
      setTimeout(() => {
        document.getElementById('splash-screen').classList.add('hide');
        setTimeout(() => {
          document.getElementById('splash-screen').style.display = 'none';
          document.getElementById('loginPage').classList.add('show');
        }, 600);
      }, 400);
    }
    if (bar) bar.style.width = pct + '%';
    if (txt) {
      const idx = Math.min(Math.floor(pct / 30), msgs.length - 1);
      txt.textContent = msgs[idx];
    }
  }, 280);
}

// ==================== VIEW MANAGER ====================
function showView(name) {
  document.getElementById('view-auth').style.display = 'none';
  document.getElementById('view-otp').style.display = 'none';
  document.getElementById('view-forgot').style.display = 'none';

  if (name === 'auth') {
    document.getElementById('view-auth').style.display = 'block';
  } else if (name === 'otp') {
    document.getElementById('view-otp').style.display = 'block';
    startOTP();
  } else if (name === 'forgot') {
    document.getElementById('view-forgot').style.display = 'block';
  }
}

// ==================== AUTH TAB SWITCH ====================
function switchTab(tab) {
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

// ==================== ROLE PICKER ====================
function pickRole(role) {
  document.querySelectorAll('.role-c').forEach(c => c.classList.remove('active'));
  document.getElementById(`role-${role}`)?.classList.add('active');
  Auth.currentRole = role;
  
  // Auto-fill demo credentials
  const emailMap = {
    'user': 'user@pilahpilih.com',
    'petugas': 'petugas@pilahpilih.com',
    'bank': 'bank@pilahpilih.com',
    'admin': 'admin@pilahpilih.com'
  };
  
  const emEl = document.getElementById('loginEmail');
  const pwEl = document.getElementById('loginPwd');
  if (emEl && pwEl && emailMap[role]) {
    emEl.value = emailMap[role];
    pwEl.value = 'password123';
  }
}

// ==================== TOGGLE PASSWORD ====================
function togglePwd(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  
  const eyeOpen = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const eyeClosed = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  
  btn.innerHTML = inp.type === 'password' ? eyeOpen : eyeClosed;
}

// ==================== VALIDATION ====================
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /^\d{10,14}$/.test(email.replace(/[-\s+]/g, ''));
}

// ==================== LOGIN ====================
async function doLogin() {
  const email = document.getElementById('loginEmail')?.value?.trim();
  const pwd = document.getElementById('loginPwd')?.value;
  
  // Reset demo payment status
  localStorage.removeItem('petugas_sub_paid');
  
  if (!email) { showToast('❌ Email wajib diisi'); return; }
  if (!pwd) { showToast('❌ Password wajib diisi'); return; }

  const btn = document.getElementById('btnLogin');
  const btnText = document.getElementById('btnLoginText');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Memverifikasi...';
  
  try {
    const res = await API.Auth.login(email, pwd);
    
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Masuk Sekarang →';

    const roleMap = {
      admin: 'dashboard-admin.html',
      petugas: 'dashboard-petugas.html',
      user: 'dashboard-user.html',
      bank_sampah: 'dashboard-pengepul.html'
    };

    const roleNames = {
      admin: 'Admin',
      petugas: 'Petugas',
      user: 'User'
    };

    const userRole = res.data.user.role; // db uses string 'role' not 'role_id'
    const userName = res.data.user.name;
    
    // Simpan nama ke localStorage agar tampil di dashboard
    if (userName) {
      localStorage.setItem('user_name', userName);
    }
    
    showToast(`✅ Login berhasil sebagai ${roleNames[userRole] || 'User'}!`);
    
    setTimeout(() => {
      window.location.href = roleMap[userRole] || 'dashboard-user.html';
    }, 800);

  } catch (err) {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Masuk Sekarang →';
    showToast('❌ ' + err.message);
  }
}

// ==================== SOCIAL LOGIN ====================
function socialLogin(provider) {
  showToast(`⏳ Menghubungkan ke ${provider}...`);
  setTimeout(() => {
    showToast(`✅ Login via ${provider} berhasil!`);
    setTimeout(() => {
      window.location.href = 'dashboard-user.html';
    }, 800);
  }, 1500);
}

// ==================== REGISTER ====================
async function doRegister() {
  const name = document.getElementById('regName')?.value?.trim();
  const email = document.getElementById('regEmail')?.value?.trim();
  const phone = document.getElementById('regPhone')?.value?.trim();
  const pwd = document.getElementById('regPwd')?.value?.trim();
  const roleSelect = document.getElementById('regRole')?.value;

  // Reset demo payment status
  localStorage.removeItem('petugas_sub_paid');

  if (!name) { showToast('❌ Nama wajib diisi'); return; }
  if (!email || !validateEmail(email)) { showToast('❌ Email tidak valid'); return; }
  if (!phone) { showToast('❌ Nomor HP wajib diisi'); return; }
  if (!pwd || pwd.length < 8) { showToast('❌ Password minimal 8 karakter'); return; }

  const ktpFile = document.getElementById('regKTP')?.files[0];
  if ((roleSelect === 'user' || roleSelect === 'petugas') && !ktpFile) {
    showToast('❌ Foto KTP wajib diunggah untuk pendaftaran ini'); return;
  }

  showToast('⏳ Mengunggah data & Mendaftar...');
  
  try {
    const roleIdMap = { admin: 'admin', petugas: 'petugas', user: 'user', bank: 'bank_sampah', pengepul: 'bank_sampah' };
    const mappedRole = roleIdMap[roleSelect] || 'user';
    
    await API.Auth.register({ name, email, phone, password: pwd, role: mappedRole });
    
    // Simpan nama ke localStorage agar tampil di dashboard
    localStorage.setItem('user_name', name);
    
    const otpTgt = document.getElementById('otpTarget');
    if (otpTgt) otpTgt.textContent = phone;
    showToast('✅ Registrasi berhasil! Silakan verifikasi OTP');
    setTimeout(() => showView('otp'), 600);
  } catch (err) {
    showToast('❌ ' + err.message);
  }
}

// ==================== OTP ====================
function startOTP() {
  if (Auth.otpInterval) clearInterval(Auth.otpInterval);
  let secs = 120;
  const el = document.getElementById('otpTimer');
  Auth.otpInterval = setInterval(() => {
    secs--;
    if (el) {
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      el.textContent = `${m}:${s}`;
    }
    if (secs <= 0) { clearInterval(Auth.otpInterval); if (el) el.textContent = 'Kedaluwarsa'; }
  }, 1000);
  // Focus first box
  document.getElementById('otp0')?.focus();
}

function otpNext(inp, idx) {
  const boxes = document.querySelectorAll('.otp-box');
  if (inp.value.length === 1 && idx < boxes.length - 1) boxes[idx + 1]?.focus();
  const allFilled = Array.from(boxes).every(b => b.value.length === 1);
  if (allFilled) {
    showToast('✅ OTP lengkap! Memverifikasi...');
    setTimeout(() => verifyOTP(), 500);
  }
}

function verifyOTP() {
  const boxes = document.querySelectorAll('.otp-box');
  const code = Array.from(boxes).map(b => b.value).join('');
  if (code.length < 6) { showToast('❌ Masukkan 6 digit OTP'); return; }
  showToast('✅ OTP Terverifikasi! Mengarahkan...');
  clearInterval(Auth.otpInterval);
  
  setTimeout(() => {
    const user = API.Storage.getUser();
    const roleMap = {
      admin: 'dashboard-admin.html',
      petugas: 'dashboard-petugas.html',
      user: 'dashboard-user.html',
      bank_sampah: 'dashboard-pengepul.html'
    };
    const userRole = user ? user.role : 'user';
    window.location.href = roleMap[userRole] || 'dashboard-user.html';
  }, 1000);
}

function resendOTP() {
  document.querySelectorAll('.otp-box').forEach(b => b.value = '');
  document.getElementById('otp0')?.focus();
  showToast('📱 Kode OTP baru telah dikirim!');
  startOTP();
}

// ==================== FORGOT PASSWORD ====================
function sendReset() {
  const email = document.getElementById('forgotEmail')?.value?.trim();
  if (!email) { showToast('❌ Email atau No. HP wajib diisi'); return; }
  showToast('⏳ Mengirim kode reset...');
  setTimeout(() => {
    showToast('✅ Kode reset telah dikirim ke ' + email);
    setTimeout(() => showView('auth'), 1500);
  }, 1200);
}

// ==================== KTP UPLOAD LOGIC ====================
function toggleKtpUpload(role) {
  const wrap = document.getElementById('ktpWrap');
  if (!wrap) return;
  if (role === 'user' || role === 'petugas') {
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }
}

function handleKtpUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  // Validasi ukuran max 5MB
  if (file.size > 5 * 1024 * 1024) {
    showToast('❌ Ukuran file maksimal 5MB');
    input.value = '';
    return;
  }

  const dz = document.getElementById('ktpDropzone');
  const prev = document.getElementById('ktpPreview');
  const icon = dz.querySelector('.ktp-icon');
  const txt = dz.querySelector('.ktp-text');
  const sub = dz.querySelector('.ktp-sub');
  
  const reader = new FileReader();
  reader.onload = e => {
    prev.src = e.target.result;
    prev.style.display = 'block';
    if(icon) icon.style.display = 'none';
    if(txt) txt.style.display = 'none';
    if(sub) sub.style.display = 'none';
    dz.classList.add('has-file');
  };
  reader.readAsDataURL(file);
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
  if (e.key === 'Enter') {
    const loginForm = document.getElementById('formLogin');
    const regForm = document.getElementById('formRegister');
    if (loginForm?.classList.contains('active')) doLogin();
    else if (regForm?.classList.contains('active')) doRegister();
  }
});

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  initSplash();
  console.log('🌱 PilahPilih Login v2.0 Loaded');
});
