# SJN Reports site — setup

Two parts: `index.html` goes in a GitHub repo (served by GitHub Pages), and `Code.gs` goes in Google Apps Script. Reports live in a private Google Drive folder and never go in the repo.

## 1. Drive folder
1. In Google Drive, create a folder such as **SJN Reports**. Keep its sharing restricted (don't set "anyone with the link").
2. Open it and copy the ID from the URL: `drive.google.com/drive/folders/THIS_PART`.

Tip: anyone with edit access to this folder can also add reports by dropping `.html` files straight into it. They'll show up in the list using the file name as the title.

## 2. Apps Script
1. Go to script.google.com → **New project**, name it "SJN Reports API".
2. Replace the contents of `Code.gs` with the file from this folder. Save.
3. **Project Settings (gear) → Script properties → Add**:
   - `FOLDER_ID` = the folder ID
   - `VIEWER_PASSWORD` = password for partners and readers
   - `UPLOADER_PASSWORD` = a different, stronger password for people who upload
4. Back in the editor, choose `testSetup` from the function menu and click **Run**. Approve the Drive permission. The log should show the folder name.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (the passwords do the gatekeeping)
6. Copy the web app URL (ends in `/exec`).

When you edit `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## 3. GitHub Pages
1. Create a repo, e.g. `sjn-reports`, and add `index.html`.
2. In `index.html`, find `PASTE_YOUR_APPS_SCRIPT_URL_HERE` and paste the `/exec` URL.
3. Commit and push. Then **Settings → Pages → Deploy from branch → main / root**.
4. Custom domain: in **Settings → Pages**, enter `reports.solutionsjournalism.org`. In the DNS settings for solutionsjournalism.org, add a **CNAME** record: name `reports`, value `YOUR-GITHUB-USERNAME.github.io`. Tick **Enforce HTTPS** once it's available.

## Changing passwords
Edit the Script properties. No redeploy needed. Existing sessions last up to 6 hours; to sign everyone out immediately, run any function from the editor after changing the password and wait for sessions to expire, or change the code's cache key prefix (`'s_'`) and deploy a new version.

## Good to know
- The repo can be public. It contains no reports and no passwords.
- Reports open in a sandboxed frame, so scripts inside a report (charts etc.) work but can't read the sign-in session.
- Deleting from the site moves the file to Drive trash (restorable for 30 days).
- After 20 wrong passwords in 10 minutes, sign-in pauses for everyone for 10 minutes.
