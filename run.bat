@echo off
setlocal
cd /d "%~dp0"

echo [Quiz] Verification des dependances...
if not exist "node_modules" (
    echo [ERREUR] node_modules est manquant. L'application necessite d'etre installee.
    pause
    exit /b
)

echo [Quiz] Lancement de L'Aventure du Savoir...
:: Lancer le serveur vite en arrière-plan (port 5174 pour eviter les conflits)
start /b cmd /c "npm run dev -- --port 5174"

echo [Quiz] Attente de l'initialisation du serveur...
:WAIT_LOOP
timeout /t 1 /nobreak >nul
netstat -aon | findstr ":5174 " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo [Quiz] ...en attente...
    goto WAIT_LOOP
)

echo [Quiz] Serveur pret ! Ouverture de la page.
:: Ouvrir Chrome en mode App (fenêtre isolée) avec un profil temporaire 
start /wait chrome.exe --app="http://localhost:5174/quiz_generator/" --user-data-dir="%TEMP%\QuizGenChromeProfile"

:: Dès que la fenêtre est fermée, on recherche le processus qui écoute sur le port 5174 pour le tuer
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5174 " ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo [Quiz] Fin de session.
