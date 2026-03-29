@echo off
setlocal

:: ============================================================
::  L'Aventure du Savoir - Snapshot rapide
::  Usage : snapshot.bat "Description de la sauvegarde"
::  Exemple: snapshot.bat "Ajout multi-fichiers"
:: ============================================================

set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "MSG=%~1"

if "%MSG%"=="" (
    echo.
    echo  Usage : snapshot.bat "Description courte de la version"
    echo  Exemple: snapshot.bat "Ajout statistiques de performance"
    echo.
    pause
    exit /b 1
)

echo.
echo  [GIT] Sauvegarde en cours : "%MSG%"
echo.

cd /d "%APP_DIR%"
git add -A
git commit -m "%MSG%"

echo.
echo  [GIT] Sauvegarde enregistree !
echo  Utilisez "git log --oneline" pour voir l'historique.
echo.
pause
