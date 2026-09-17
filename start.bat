@echo off
title AMW PDTrack Delivery Tracker Server
cd /d "%~dp0"
echo ========================================================
echo   AMW PDTrack - Delivery Tracking App
echo ========================================================
echo Checking and syncing latest Status Overview data...
python scripts/update_overview.py
echo Starting Vite Web Server at http://localhost:3000 ...
start http://localhost:3000
npm run dev -- --host 0.0.0.0 --port 3000
pause
