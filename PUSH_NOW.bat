@echo off
echo ================================================================================
echo   PUSHING DIGITAL BANKING SYSTEM TO ABEBE-BUILDS
echo ================================================================================
echo.
echo This will push your complete banking system to GitHub.
echo.
echo IMPORTANT: When prompted for password, use your PERSONAL ACCESS TOKEN
echo (Not your regular password - GitHub requires tokens now)
echo.
echo If you don't have a token yet:
echo 1. Go to: https://github.com/settings/tokens
echo 2. Click "Generate new token (classic)"
echo 3. Check "repo" scope
echo 4. Copy the token (ghp_xxxxx...)
echo.
pause
echo.
echo Starting push...
echo.

cd /d C:\DigitalBankingSystem

echo Step 1: Cleaning up temporary files...
git add -A
git commit -m "chore: remove temporary instruction files"

echo.
echo Step 2: Pushing to GitHub...
echo Username will be: abebe-builds
echo.
git push -u origin main

echo.
echo ================================================================================
echo   DONE!
echo ================================================================================
echo.
echo Check your repository at:
echo https://github.com/abebe-builds/DigitalBankingSystem
echo.
pause
