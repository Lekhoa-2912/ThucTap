@echo off
REM ===============================================
REM GoodZWork - Full System Startup Script
REM ===============================================
REM This script starts both Backend and Frontend

setlocal enabledelayedexpansion

REM Get the workspace directory
set "WORKSPACE_DIR=%~dp0"
set "BACKEND_DIR=%WORKSPACE_DIR%Backend"
set "FRONTEND_DIR=%WORKSPACE_DIR%Frontend"

echo.
echo ===============================================
echo   GoodZWork System Startup
echo ===============================================
echo.

REM Check if .venv exists
if not exist "%WORKSPACE_DIR%.venv" (
    echo [ERROR] Virtual environment not found at: %WORKSPACE_DIR%.venv
    echo Please run auto_install.py first to set up the environment.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [WARNING] Frontend dependencies not installed. Installing now...
    cd /d "%FRONTEND_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies
        pause
        exit /b 1
    )
)

echo [1/4] Activating Python Virtual Environment...
call "%WORKSPACE_DIR%.venv\Scripts\activate.bat"
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment
    pause
    exit /b 1
)
echo [OK] Virtual environment activated

echo.
echo [2/4] Starting Backend Server (FastAPI)...
echo.
cd /d "%BACKEND_DIR%"
start cmd /k "title Backend Server - GoodZWork && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
if errorlevel 1 (
    echo [ERROR] Failed to start backend
    pause
    exit /b 1
)
echo [OK] Backend started on http://localhost:8000

timeout /t 3 /nobreak

echo.
echo [3/4] Starting Frontend Server (Vite)...
echo.
cd /d "%FRONTEND_DIR%"
start cmd /k "title Frontend Server - GoodZWork && npm run dev"
if errorlevel 1 (
    echo [ERROR] Failed to start frontend
    pause
    exit /b 1
)
echo [OK] Frontend started on http://localhost:5173

echo.
echo ===============================================
echo   GoodZWork System Startup Complete!
echo ===============================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo Docs:     http://localhost:8000/docs
echo.
echo Press any key to continue...
pause

REM Keep this window open
cmd /k
