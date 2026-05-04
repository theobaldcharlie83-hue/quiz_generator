@echo off
setlocal

:: ============================================================
::  L'Aventure du Savoir - Creation du raccourci Bureau
::  Lancer une seule fois apres installation.
:: ============================================================

set "APP_DIR=%~dp0"
:: Supprimer le backslash final
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

echo.
echo  ==========================================
echo   L'Aventure du Savoir - Creation raccourci
echo  ==========================================
echo.

:: --- Etape 1 : Conversion PNG -> ICO ---
echo  [1/2] Creation de l'icone (.ico)...
python "%APP_DIR%\make_icon.py"
if %errorlevel% neq 0 (
    echo.
    echo  ERREUR : impossible de creer l'icone.
    echo  Verifiez que Python est bien installe.
    pause
    exit /b 1
)

:: --- Etape 2 : Creation du raccourci via PowerShell ---
echo  [2/2] Creation du raccourci sur le Bureau...

set "ICO_PATH=%APP_DIR%\icon.ico"
set "VBS_PATH=%APP_DIR%\launch.vbs"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; " ^
  "$Desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$LnkPath = $Desktop + '\LAventure du Savoir.lnk'; " ^
  "$Shortcut = $WshShell.CreateShortcut($LnkPath); " ^
  "$Shortcut.TargetPath = 'wscript.exe'; " ^
  "$Shortcut.Arguments = '\""%VBS_PATH%\"\"'; " ^
  "$Shortcut.WorkingDirectory = '%APP_DIR%'; " ^
  "$Shortcut.IconLocation = '%ICO_PATH%'; " ^
  "$Shortcut.Description = 'LAventure du Savoir - Transforme tes cours en quiz !'; " ^
  "$Shortcut.Save(); " ^
  "Write-Host '  Raccourci cree : ' $LnkPath"

if %errorlevel% neq 0 (
    echo.
    echo  ERREUR lors de la creation du raccourci.
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo   Succes !
echo   L'icone "LAventure du Savoir" est sur
echo   ton Bureau. Double-clique pour jouer !
echo  ==========================================
echo.
pause
