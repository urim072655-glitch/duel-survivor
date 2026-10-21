@echo off
setlocal EnableDelayedExpansion
title DSserver - Duel Survivor Local Server

rem ==========================================================
rem  ASCII-only on purpose: cmd.exe reads batch files using the
rem  console codepage, so UTF-8 non-ASCII literals get mangled
rem  (cp936). All Chinese output is printed by server.py instead.
rem ==========================================================

cd /d "%~dp0"

rem ---------- locate Python ----------
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py -3"
if not defined PY if exist "%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe" set "PY=%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe"
if not defined PY goto :err_nopy

rem ---------- pick a free port in 8100-8120 ----------
set "PORT=8100"
:pick_port
netstat -ano | findstr ":%PORT% " >nul 2>nul
if not errorlevel 1 goto :port_busy
goto :port_ok
:port_busy
set /a PORT+=1
if !PORT! GTR 8120 goto :err_noport
goto :pick_port
:port_ok

echo ============================================
echo    Duel Survivor - local server
echo ============================================
echo.
echo    Game  : http://localhost:%PORT%/index.html?localapi=1
echo    Admin : http://localhost:%PORT%/admin.html?localapi=1
echo    Login : admin  (password = ADMIN_PWD in server.py)
echo.
echo    Opening browser in 1 second...
echo    Keep this window open to see incoming user data.
echo    Close the window or press Ctrl+C to stop.
echo.

%SystemRoot%\System32\timeout.exe /t 1 /nobreak >nul
start "" "http://localhost:%PORT%/index.html?localapi=1"
%PY% server.py %PORT%

echo.
echo Server stopped. You can close this window.
pause >nul
exit /b 0

:err_nopy
echo [ERROR] Python not found.
echo Install Python 3 from https://www.python.org/downloads/
echo and tick "Add Python to PATH", then run this file again.
echo.
pause
exit /b 1

:err_noport
echo [ERROR] Ports 8100-8120 are all in use. Close the other program and retry.
echo.
pause
exit /b 1
