@echo off
title PDTrack Delivery Tracker Server
cd /d "%~dp0"
echo ========================================================
echo   PDTrack - Delivery Tracking App (Machine Index)
echo ========================================================
echo Starting Vite Web Server at http://localhost:3000 ...
start http://localhost:3000
npm run dev -- --host 0.0.0.0 --port 3000
pause
