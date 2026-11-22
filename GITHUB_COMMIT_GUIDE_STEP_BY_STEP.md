# 📝 Complete Guide: Commit to GitHub (Step-by-Step)

## 🔄 PART 1: Restore Files from Recycle Bin

### Step 1.1: Open Recycle Bin
1. **Find the Recycle Bin icon** on your Desktop
2. **Double-click** to open it

### Step 1.2: Restore All Files
1. **Inside Recycle Bin**, press `Ctrl + A` on your keyboard (selects all files)
2. **Right-click** on any selected file
3. Click **"Restore"**
4. All files will return to their original location: `C:\DigitalBankingSystem`

**✅ Confirmation**: Check if `C:\DigitalBankingSystem` folder has files like:
- `src` folder
- `public` folder
- `package.json`
- `commit-to-github.bat` (the file I created)

---

## 💻 PART 2: Run the Commit Script

### Step 2.1: Navigate to the Folder
1. Open **File Explorer** (Windows key + E)
2. Navigate to: `C:\DigitalBankingSystem`

### Step 2.2: Run the Batch File
1. **Find the file**: `commit-to-github.bat`
2. **Double-click** it
3. A **black command window** will open

### Step 2.3: What Happens
The script will:
```
✓ Check if files exist
✓ Initialize Git repository
✓ Add all files to Git
✓ Create first commit
```

You'll see output like:
```
Step 1: Initializing Git...
Initialized empty Git repository in C:/DigitalBankingSystem/.git/
Done!

Step 2: Adding files...
Done!

Step 3: Creating commit...
[main (root-commit) abc1234] Initial commit: Digital Banking System
 150 files changed, 15000 insertions(+)
Done!
```

**Press any key** when done. The window will close or wait for you.

---

## 🌐 PART 3: Create GitHub Repository

### Step 3.1: Go to GitHub
1. Open your web browser
2. Go to: **https://github.com/new**
3. **Log in** if not already logged in

### Step 3.2: Fill Repository Details
You'll see a form. Fill it like this:

**Repository name**: `DigitalBankingSystem`  
(Exactly as shown, or choose your own name)

**Description** (optional): `Ethiopian Digital Banking System with KYC verification`

**Visibility**:
- ⚫ **Select "Private"** (IMPORTANT for banking systems!)
- ❌ **Do NOT select "Public"** (would expose your code)

**Initialize this repository with**:
- ❌ **UNCHECK** "Add a README file"
- ❌ **UNCHECK** "Add .gitignore"
- ❌ **UNCHECK** "Choose a license"

**ALL BOXES SHOULD BE UNCHECKED!**

### Step 3.3: Create Repository
Click the big green button: **"Create repository"**

---

## 🔗 PART 4: Connect Local Code to GitHub

### Step 4.1: Copy Your Repository URL
After creating the repository, GitHub shows you a page with commands.

**Look for** the section that says:
```
…or push an existing repository from the command line
```

**Copy your repository URL**. It looks like:
```
https://github.com/YOUR_USERNAME/DigitalBankingSystem.git
```

**Example**: If your username is `johnsmith`, it would be:
```
https://github.com/johnsmith/DigitalBankingSystem.git
```

### Step 4.2: Open PowerShell
1. Press **Windows key**
2. Type **"PowerShell"**
3. Click **"Windows PowerShell"** (NOT "PowerShell ISE")
4. A blue window opens

### Step 4.3: Navigate to Your Project
In PowerShell, type:
```powershell
cd C:\DigitalBankingSystem
```
Press **Enter**

### Step 4.4: Add GitHub Remote
Type this command (replace YOUR_USERNAME with your actual GitHub username):
```powershell
git remote add origin https://github.com/YOUR_USERNAME/DigitalBankingSystem.git
```
Press **Enter**

**Example**:
```powershell
git remote add origin https://github.com/johnsmith/DigitalBankingSystem.git
```

### Step 4.5: Rename Branch to Main
Type:
```powershell
git branch -M main
```
Press **Enter**

### Step 4.6: Push to GitHub
Type:
```powershell
git push -u origin main
```
Press **Enter**

---

## 🔑 PART 5: Authentication (Personal Access Token)

### Problem: GitHub Asks for Password

When you run `git push`, you'll see:
```
Username for 'https://github.com': 
```

### Step 5.1: Enter Your Username
Type your **GitHub username** and press **Enter**

### Step 5.2: Get Personal Access Token

**You CANNOT use your GitHub password anymore!** You need a token.

#### Create Token:
1. Open new browser tab
2. Go to: **https://github.com/settings/tokens**
3. Click **"Generate new token"** → Select **"Generate new token (classic)"**

#### Configure Token:
- **Note**: `DigitalBankingSystem Access`
- **Expiration**: Choose `90 days` or `No expiration`
- **Select scopes**:
  - ✅ Check **"repo"** (this checks all repo sub-boxes)
  - ✅ Leave everything else unchecked

#### Generate:
1. Scroll to bottom
2. Click **"Generate token"**
3. **COPY THE TOKEN** - looks like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
4. **SAVE IT** in a safe place (Notepad) - you'll never see it again!

### Step 5.3: Use Token as Password
Back in PowerShell, when it asks:
```
Password for 'https://YOUR_USERNAME@github.com':
```

**Paste your token** (right-click in PowerShell to paste) and press **Enter**

**Note**: You won't see anything as you paste - that's normal!

---

## ✅ PART 6: Verify Success

### Step 6.1: Check PowerShell Output
You should see:
```
Enumerating objects: 150, done.
Counting objects: 100% (150/150), done.
Delta compression using up to 8 threads
Compressing objects: 100% (140/140), done.
Writing objects: 100% (150/150), 250.00 KiB | 5.00 MiB/s, done.
Total 150 (delta 20), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (20/20), done.
To https://github.com/YOUR_USERNAME/DigitalBankingSystem.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

**✅ Success!** Your code is on GitHub!

### Step 6.2: View on GitHub
1. Go to: `https://github.com/YOUR_USERNAME/DigitalBankingSystem`
2. You should see all your files!

---

## 🎯 QUICK REFERENCE COMMANDS

Open PowerShell in `C:\DigitalBankingSystem` and run:

```powershell
# 1. Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/DigitalBankingSystem.git

# 2. Rename branch to main
git branch -M main

# 3. Push to GitHub
git push -u origin main
```

**When prompted**:
- **Username**: Your GitHub username
- **Password**: Your Personal Access Token (NOT your GitHub password!)

---

## ❓ Troubleshooting

### Problem 1: "git is not recognized"
**Solution**: Install Git
1. Go to: https://git-scm.com/download/win
2. Download and install
3. Restart PowerShell
4. Try again

### Problem 2: "remote origin already exists"
**Solution**: Remove and re-add
```powershell
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/DigitalBankingSystem.git
```

### Problem 3: "Authentication failed"
**Solution**: Use token, not password
- Make sure you're using Personal Access Token
- Check token has "repo" scope
- Token hasn't expired

### Problem 4: "Updates were rejected"
**Solution**: Force push (CAREFUL!)
```powershell
git push -u origin main --force
```

### Problem 5: Can't paste in PowerShell
**Solution**: Use right-click or Ctrl+V

---

## 📋 Checklist

Before starting, make sure:
- [ ] Files restored from Recycle Bin
- [ ] `commit-to-github.bat` exists in folder
- [ ] You have a GitHub account
- [ ] Git is installed on your computer

During process:
- [ ] Ran `commit-to-github.bat`
- [ ] Created GitHub repository (PRIVATE)
- [ ] Got Personal Access Token
- [ ] Pushed code to GitHub

After:
- [ ] Can see files on GitHub website
- [ ] Repository is Private
- [ ] No `.env` file visible on GitHub (it's in .gitignore)

---

## 🎓 What Each Command Does

### `git init`
Creates a new Git repository in your folder

### `git add .`
Stages all files for commit (the `.` means "all files")

### `git commit -m "message"`
Saves a snapshot with a message

### `git remote add origin URL`
Links your local repository to GitHub

### `git branch -M main`
Renames your branch to "main" (GitHub's default)

### `git push -u origin main`
Uploads your code to GitHub

---

## 🔒 Security Notes

**Files Excluded from GitHub** (in .gitignore):
- ✅ `.env` - Contains database passwords (NEVER commit this!)
- ✅ `node_modules/` - Dependencies (too large, can be reinstalled)
- ✅ `uploads/` - User uploaded files
- ✅ `*.log` - Log files

**Repository Privacy**:
- ✅ Keep it PRIVATE for banking systems
- ✅ Only invite trusted collaborators
- ✅ Never share your Personal Access Token

---

## 📞 Need Help?

If something doesn't work:
1. Read the error message carefully
2. Check the Troubleshooting section
3. Make sure you're in the correct folder: `C:\DigitalBankingSystem`
4. Try running commands one at a time

---

## 🎉 Congratulations!

Once done, your Digital Banking System is:
- ✅ Safely backed up on GitHub
- ✅ Version controlled
- ✅ Protected (Private repository)
- ✅ Ready for collaboration

You can now:
- Make changes and commit them: `git add .` → `git commit -m "message"` → `git push`
- View history: `git log`
- Revert changes: `git checkout`

**Happy coding!** 🚀
