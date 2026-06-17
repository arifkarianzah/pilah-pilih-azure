@echo off
echo ============================================
echo   PILAH PILIH - Setup Backend
echo ============================================
echo.

cd /d "%~dp0backend"

echo [1/3] Menginstall dependencies...
npm install sqlite3 bcryptjs cors dotenv express express-rate-limit express-validator jsonwebtoken multer nodemon

echo.
echo [2/3] Mengisi data awal database...
node database/seed.js

echo.
echo [3/3] Menjalankan server...
echo Backend akan berjalan di: http://localhost:5000
echo Docs API: http://localhost:5000/api/docs
echo.
echo Tekan Ctrl+C untuk berhenti
echo.
node server.js

pause
