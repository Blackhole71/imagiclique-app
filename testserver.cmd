@echo off
chcp 65001 >nul
title Imagiclique - App-Testserver
rem Startet die App lokal auf http://localhost:8765
rem Ist ein Android-Handy per USB angeschlossen (USB-Debugging an), wird der Port
rem dorthin durchgereicht: dann auf dem Handy in Chrome http://localhost:8765 oeffnen.
cd /d "%~dp0"

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if exist "%ADB%" (
  "%ADB%" reverse tcp:8765 tcp:8765 >nul 2>&1 && echo  Handy verbunden: dort http://localhost:8765 in Chrome oeffnen. || echo  Kein Handy per USB gefunden - nur am PC erreichbar.
)

start "" http://localhost:8765/
python -m http.server 8765 --bind 127.0.0.1
pause
