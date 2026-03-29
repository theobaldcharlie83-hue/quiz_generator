@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo L'Aventure du Savoir - Lancement
echo ==============================================

:: Verification python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Python n'est pas installe ou n'est pas reconnu.
    echo Assurez-vous d'avoir installe Python depuis python.org.
    pause
    exit /b
)

:: Creation de l'environnement virtuel pour eviter les conflits
if not exist "venv" (
    echo [INFO] Creation de l'environnement local...
    python -m venv venv
)

:: Activation de l'environnement virtuel
call venv\Scripts\activate.bat

:: Installation des packages Python
echo [INFO] Installation des dependances...
pip install -r requirements.txt

:: Verification de la cle API
if not exist ".env" (
    echo.
    echo [ATTENTION] Fichier .env introuvable !
    echo Veuillez renommer le fichier .env.example en .env
    echo et coller votre vraie cle API a l'interieur.
    echo L'application a besoin de la cle pour fonctionner.
    echo.
    pause
)

:: Lancement en tâche de fond (Headless)
echo [INFO] Lancement de l'application en arriere-plan...
start "" /B pythonw.exe app.py
exit
