@echo off
echo ============================================
echo   PILAH PILIH - Setup Frontend
echo ============================================
echo.

cd /d "%~dp0frontend"

echo [1/2] Menginstall dependencies...
call npm install serve

echo.
echo [2/2] Menjalankan dev server...
echo Frontend akan berjalan di: http://localhost:3000
echo.
echo Tekan Ctrl+C untuk berhenti
echo.
call npx --yes serve . -p 3000 -s

pause
