# GitHub Push Helper Script
# This script guides you through pushing your project to GitHub

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       DIGITAL BANKING SYSTEM - GITHUB PUSH HELPER        ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if files exist
Write-Host "Checking if files exist..." -ForegroundColor Yellow
if (-Not (Test-Path "src\server.js")) {
    Write-Host "❌ ERROR: Files not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please restore files from Recycle Bin first:" -ForegroundColor Yellow
    Write-Host "1. Open Recycle Bin" -ForegroundColor White
    Write-Host "2. Press Ctrl+A to select all" -ForegroundColor White
    Write-Host "3. Right-click → Restore" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
Write-Host "✓ Files found!" -ForegroundColor Green
Write-Host ""

# Check if Git is installed
Write-Host "Checking if Git is installed..." -ForegroundColor Yellow
try {
    $gitVersion = git --version 2>$null
    Write-Host "✓ Git installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Then restart this script." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
Write-Host ""

# Check if already initialized
if (Test-Path ".git") {
    Write-Host "✓ Git repository already initialized" -ForegroundColor Green
} else {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Git initialized" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to initialize Git" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Check if files are staged
Write-Host "Staging files..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Files staged" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to stage files" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check if commit exists
$commitExists = git log -1 2>$null
if (-Not $commitExists) {
    Write-Host "Creating initial commit..." -ForegroundColor Yellow
    git commit -m "Initial commit: Digital Banking System - Ethiopian Banking Standards"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Commit created" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create commit" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ Commit already exists" -ForegroundColor Green
}
Write-Host ""

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    NEXT STEPS                             ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. CREATE GITHUB REPOSITORY" -ForegroundColor Yellow
Write-Host "   Go to: " -NoNewline -ForegroundColor White
Write-Host "https://github.com/new" -ForegroundColor Cyan
Write-Host "   • Repository name: DigitalBankingSystem" -ForegroundColor White
Write-Host "   • Make it PRIVATE (important for banking!)" -ForegroundColor White
Write-Host "   • DON'T check any boxes" -ForegroundColor White
Write-Host "   • Click 'Create repository'" -ForegroundColor White
Write-Host ""

Write-Host "2. GET PERSONAL ACCESS TOKEN" -ForegroundColor Yellow
Write-Host "   Go to: " -NoNewline -ForegroundColor White
Write-Host "https://github.com/settings/tokens" -ForegroundColor Cyan
Write-Host "   • Click 'Generate new token (classic)'" -ForegroundColor White
Write-Host "   • Check 'repo' scope" -ForegroundColor White
Write-Host "   • Click 'Generate token'" -ForegroundColor White
Write-Host "   • COPY THE TOKEN and save it!" -ForegroundColor White
Write-Host ""

Write-Host "3. ENTER YOUR GITHUB USERNAME" -ForegroundColor Yellow
$username = Read-Host "   Enter your GitHub username"

if ([string]::IsNullOrWhiteSpace($username)) {
    Write-Host "❌ Username cannot be empty!" -ForegroundColor Red
    exit 1
}

$repoUrl = "https://github.com/$username/DigitalBankingSystem.git"

Write-Host ""
Write-Host "Your repository URL will be:" -ForegroundColor White
Write-Host "   $repoUrl" -ForegroundColor Cyan
Write-Host ""

Write-Host "Press Enter when you've created the repository and have your token ready..." -ForegroundColor Yellow
$null = Read-Host

Write-Host ""
Write-Host "4. ADDING REMOTE..." -ForegroundColor Yellow

# Check if remote already exists
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "   Remote 'origin' already exists. Removing..." -ForegroundColor Gray
    git remote remove origin
}

git remote add origin $repoUrl
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Remote added" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to add remote" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "5. RENAMING BRANCH TO MAIN..." -ForegroundColor Yellow
git branch -M main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Branch renamed" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to rename branch" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "6. PUSHING TO GITHUB..." -ForegroundColor Yellow
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  IMPORTANT: When prompted for password,                   ║" -ForegroundColor Magenta
Write-Host "║  paste your PERSONAL ACCESS TOKEN (not your password!)    ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "Username: $username" -ForegroundColor Cyan
Write-Host "Password: (paste your token here when prompted)" -ForegroundColor Cyan
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                    🎉 SUCCESS! 🎉                          ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your code is now on GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "View it at:" -ForegroundColor White
    Write-Host "   https://github.com/$username/DigitalBankingSystem" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Future updates:" -ForegroundColor White
    Write-Host "   git add ." -ForegroundColor Gray
    Write-Host "   git commit -m `"Your message`"" -ForegroundColor Gray
    Write-Host "   git push" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "• Wrong username" -ForegroundColor White
    Write-Host "• Wrong token or token expired" -ForegroundColor White
    Write-Host "• Token doesn't have 'repo' scope" -ForegroundColor White
    Write-Host "• Repository doesn't exist on GitHub yet" -ForegroundColor White
    Write-Host ""
    Write-Host "Try running the script again." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
