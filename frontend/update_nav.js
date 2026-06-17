const fs = require('fs');
const files = [
  'penimbangan.html', 'petugas-home.html', 'petugas-profil.html',
  'pickup-berjalan.html', 'pickup-masuk.html', 'riwayat-pickup.html'
];
const newNav = `    <nav class="bottom-nav blue-nav">
      <div class="bn-item" id="nav-home" onclick="goPage('home')">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        <p>Beranda</p>
      </div>
      <div class="bn-item" id="nav-masuk" onclick="goPage('pickup-masuk')">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
        <p>Masuk</p>
      </div>
      <div class="bn-fab" onclick="showQRModal()">
        <div class="fab-circle blue-fab" style="display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="5"></rect><rect x="16" y="3" width="5" height="5"></rect><rect x="3" y="16" width="5" height="5"></rect><path d="M21 16v5h-5"></path><line x1="10" y1="10" x2="14" y2="14"></line></svg>
        </div>
        <p>Scan</p>
      </div>
      <div class="bn-item" id="nav-timbang" onclick="goPage('penimbangan')">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="3" y1="6" x2="21" y2="6"></line><circle cx="6" cy="14" r="3"></circle><circle cx="18" cy="14" r="3"></circle><polyline points="6 6 6 11"></polyline><polyline points="18 6 18 11"></polyline></svg>
        <p>Timbang</p>
      </div>
      <div class="bn-item" id="nav-profil" onclick="goPage('profil')">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:4px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <p>Profil</p>
      </div>
    </nav>`;

files.forEach(f => {
  const p = 'd:/Downloadan/sampah/frontend/views/petugas/' + f;
  if(fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8');
    const updated = content.replace(/<nav class="bottom-nav blue-nav">[\s\S]*?<\/nav>/, newNav);
    fs.writeFileSync(p, updated);
    console.log('Updated ' + f);
  }
});
