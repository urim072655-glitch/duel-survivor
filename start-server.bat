@echo off
chcp 936 >nul
title Duel Survivor Server
setlocal EnableDelayedExpansion
cd /d %~dp0

echo ============================================
echo    决斗幸存者 - 本地服务器
echo ============================================
echo.

rem ---------- 查找 Python ----------
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py -3"
if not defined PY if exist "%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe" set "PY=%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe"
if not defined PY goto :err_nopy

rem ---------- 选择空闲端口（8000-8010）----------
set "PORT=8000"
:pick_port
netstat -ano | findstr ":%PORT% " >nul 2>nul
if not errorlevel 1 goto :port_busy
goto :port_ok
:port_busy
set /a PORT+=1
if !PORT! GTR 8010 goto :err_noport
goto :pick_port
:port_ok

echo 游戏目录：%CD%
echo 本地地址：http://localhost:%PORT%/
echo.
echo 浏览器即将自动打开...
echo 关闭本窗口或按 Ctrl+C 即可停止服务器。
echo.

%SystemRoot%\System32\timeout.exe /t 1 /nobreak >nul
start "" http://localhost:%PORT%/
%PY% -m http.server %PORT% --bind 127.0.0.1

echo.
echo 服务器已停止，按任意键关闭窗口。
pause >nul
exit /b 0

:err_nopy
echo [错误] 未找到 Python。
echo 请先安装 Python 3：https://www.python.org/downloads/
echo 安装时勾选 "Add Python to PATH"，完成后重新双击本文件。
echo.
pause
exit /b 1

:err_noport
echo [错误] 8000-8010 端口均被占用，请关闭部分程序后重试。
echo.
pause
exit /b 1
