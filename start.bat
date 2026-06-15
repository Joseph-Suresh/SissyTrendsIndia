@echo off
title SissyTrends Local Server
cd /d "%~dp0"
echo.
echo  ======================================
echo   SissyTrends Boutique - Local Server
echo  ======================================
echo.

:: ── Find Python ──────────────────────────────────────────────
set PYTHON_CMD=

for %%C in (py python3 python) do (
    if "%PYTHON_CMD%"=="" (
        %%C -c "import sys; sys.exit(0)" >nul 2>&1
        if not errorlevel 1 set PYTHON_CMD=%%C
    )
)

if "%PYTHON_CMD%"=="" (
    for %%P in (
        "%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python39\python.exe"
        "C:\Python314\python.exe"
        "C:\Python313\python.exe"
        "C:\Python312\python.exe"
        "%ProgramFiles%\Python313\python.exe"
        "%ProgramFiles%\Python312\python.exe"
    ) do (
        if "%PYTHON_CMD%"=="" (
            if exist %%P (
                %%P -c "import sys; sys.exit(0)" >nul 2>&1
                if not errorlevel 1 set PYTHON_CMD=%%P
            )
        )
    )
)

if "%PYTHON_CMD%"=="" (
    echo  ERROR: Python not found.
    echo  Install from https://python.org and tick "Add Python to PATH".
    pause
    exit /b 1
)

echo  Using Python: %PYTHON_CMD%
echo.

:: ── Create data folder ───────────────────────────────────────
if not exist "data" mkdir data

:: ── Init DB on first run ─────────────────────────────────────
if not exist "data\sissytrends.db" (
    echo  First run - creating database...
    "%PYTHON_CMD%" init_db.py
    if errorlevel 1 (
        echo  ERROR: init_db.py failed. Run it manually in a Command Prompt.
        pause
        exit /b 1
    )
    echo  Database ready.
    echo.
)

:: ── Kill anything already on port 5000 ───────────────────────
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: ── Open browser after 2 s ───────────────────────────────────
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

echo  Server: http://localhost:5000
echo  Admin:  http://localhost:5000/admin/
echo  Keep this window open. Ctrl+C to stop.
echo.

:: ── Start server ─────────────────────────────────────────────
"%PYTHON_CMD%" api.py

echo.
echo  Server stopped.
pause
