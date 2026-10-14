@echo off
echo =======================================================
echo   Smart Workforce ^& Task Allocation System - Setup
echo =======================================================
echo.
echo Installing root, backend and frontend dependencies...
call npm run setup
if errorlevel 1 (
  echo.
  echo Setup failed. Make sure Node.js 20 or newer is installed.
  pause
  exit /b 1
)
echo.
echo =======================================================
echo   Setup complete!
echo.
echo   Development (API on :5000 + React on :5173):
echo       npm run dev
echo   Then open http://localhost:5173
echo.
echo   Production (single server on :5000):
echo       npm run build
echo       npm start
echo.
echo   Demo login: admin@smartworkflow.org / password123
echo =======================================================
pause
