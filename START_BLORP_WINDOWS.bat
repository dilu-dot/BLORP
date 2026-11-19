@echo off
setlocal
cd /d "%~dp0"
echo.
echo ======================================
echo    BLORP STUDIO V4.3
 echo ======================================
echo.
echo This runs a local Blorp server on your PC only.
echo Install Ollama and pull a model separately for Local AI Lab.
echo Copy the localhost URL printed below into Edge or Chrome.
echo Stop the app by pressing CTRL+C.
echo.
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 server.py
) else (
    python server.py
)
echo.
echo Server stopped. If Python was not found, install Python 3.10+.
pause
