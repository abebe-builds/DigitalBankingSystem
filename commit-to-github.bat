@echo off
echo ===================================
echo GitHub Commit Script
echo ===================================
echo.

REM Check if files exist
if not exist "src\server.js" (
    echo ERROR: Files not found!
    echo Please restore from Recycle Bin first!
    echo.
    echo HOW TO RESTORE:
    echo 1. Open Recycle Bin
    echo 2. Press Ctrl+A to select all
    echo 3. Right-click and choose Restore
    echo.
    pause
    exit /b 1
)

echo Files found! Ready to commit.
echo.

REM Initialize Git
echo Step 1: Initializing Git...
git init
if %errorlevel% neq 0 (
    echo ERROR: Git not installed or not in PATH
    echo Install Git from: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo Done!
echo.

REM Add files
echo Step 2: Adding files...
git add .
echo Done!
echo.

REM Create commit
echo Step 3: Creating commit...
git commit -m "Initial commit: Digital Banking System - Ethiopian Banking Standards"
echo Done!
echo.

echo ===================================
echo SUCCESS! Git repository created
echo ===================================
echo.
echo NEXT STEPS:
echo.
echo 1. Go to: https://github.com/new
echo 2. Create a repository (suggested name: DigitalBankingSystem)
echo 3. Make it PRIVATE (recommended for banking systems)
echo 4. DON'T check "Initialize with README"
echo 5. Copy your repository URL
echo.
echo 6. Then run these commands:
echo    git branch -M main
echo    git remote add origin YOUR_REPO_URL
echo    git push -u origin main
echo.
echo Example:
echo   git remote add origin https://github.com/YOUR_USERNAME/DigitalBankingSystem.git
echo   git branch -M main
echo   git push -u origin main
echo.
echo You'll need a GitHub Personal Access Token as password
echo Get it from: https://github.com/settings/tokens
echo.
pause
