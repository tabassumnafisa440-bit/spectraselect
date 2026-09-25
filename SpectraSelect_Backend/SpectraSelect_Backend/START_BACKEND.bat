@echo off
cd /d "%~dp0"
echo Installing/checking Node dependencies...
call npm install
echo.
echo Starting SpectraSelect backend...
npm start
pause
