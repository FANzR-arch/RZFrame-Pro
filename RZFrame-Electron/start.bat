@echo off
cd /d "%~dp0"
echo Starting RZFrame Workstation...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
start /b npm start
pause
