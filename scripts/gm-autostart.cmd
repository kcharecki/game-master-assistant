@echo off
REM Boot-time launcher for the GM Assistant dev server (Task Scheduler, at logon).
REM Serves Vite on the fixed port from vite.config.ts (42710, strictPort).
cd /d "H:\repo\game-master-assistant"
"C:\Program Files\nodejs\npm.cmd" run dev
