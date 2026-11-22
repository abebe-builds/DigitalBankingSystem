# PowerShell script to commit project to GitHub
# Run this in PowerShell after restoring files from Recycle Bin

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "GitHub Commit Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if files exist
if (-Not (Test-Path "src/server.js")) {
    Write-Host "❌ ERROR: src/server.js not found!" -ForegroundColor Red
    Write-Host "Please restore files from Recycle Bin first!" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Files found. Ready to commit!" -ForegroundColor Green
Write-Host ""

# Prompt for GitHub username
$username = Read-Host "Enter your GitHub username"
$repoName = Read-Host "Enter repository name (default: DigitalBankingSystem)"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "DigitalBankingSystem"
}

Write-Host ""
Write-Host "Step 1: Creating .gitignore..." -ForegroundColor Yellow

# Create .gitignore
$gitignoreContent = @"
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.production

# Uploads
uploads/
*.zip

# Logs
*.log
check.log

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Agent artifacts
.agents/
.worktrees/
"@

Set-Content -Path ".gitignore" -Value $gitignoreContent
Write-Host "✓ .gitignore created" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Initializing Git..." -ForegroundColor Yellow
git init
Write-Host "✓ Git initialized" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Adding files..." -ForegroundColor Yellow
git add .
Write-Host "✓ Files staged" -ForegroundColor Green
Write-Host ""

Write-Host "Step 4: Creating commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Digital Banking System with Ethiopian banking standards"
Write-Host "✓ Commit created" -ForegroundColor Green
Write-Host ""

Write-Host "Step 5: Adding remote..." -ForegroundColor Yellow
$remoteUrl = "https://github.com/$username/$repoName.git"
git remote add origin $remoteUrl
Write-Host "✓ Remote added: $remoteUrl" -ForegroundColor Green
Write-Host ""

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to: https://github.com/new" -ForegroundColor Yellow
Write-Host "2. Create repository named: $repoName" -ForegroundColor Yellow
Write-Host "3. Make it PRIVATE (recommended for banking system)" -ForegroundColor Yellow
Write-Host "4. DON'T initialize with README" -ForegroundColor Yellow
Write-Host "5. Then run: git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "OR run this command now:" -ForegroundColor Green
Write-Host "git branch -M main" -ForegroundColor White
Write-Host "git push -u origin main" -ForegroundColor White
Write-Host ""
Write-Host "You'll need your GitHub Personal Access Token as password" -ForegroundColor Cyan
Write-Host "Get it from: https://github.com/settings/tokens" -ForegroundColor Cyan
Write-Host ""
