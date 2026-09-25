# SJN Reports site

A password-protected site at **reports.solutionsjournalism.org** for sharing Claude-created HTML reports with SJN staff and partners.

## How it fits together

| Piece | Where it lives | What it does |
|---|---|---|
| `index.html`, `sjn-logo.png`, `favicon.ico` | GitHub repo `sjn-reports`, served by GitHub Pages | The website people see |
| `Code.gs` | Google Apps Script project **SJN Reports API** (in a shared drive) | Checks passwords and hands out reports |
| The reports themselves | Private Google Drive folder **SJN Reports** | Storage (reports never go in the repo) |

The website talks to Apps Script through the `/exec` URL set on the `API_URL` line near the top of the `<script>` section in `index.html`.

## First-time setup

### 1. Drive folder
1. Create a folder such as **SJN Reports**, ideally in a shared drive. Keep sharing restricted (not "anyone with the link").
2. Copy the folder ID from its URL: `drive.google.com/drive/folders/THIS_PART`.

### 2. Apps Script
1. Go to script.google.com → **New project**, name it **SJN Reports API**, and paste in `Code.gs`. Save.
2. **Project Settings (gear) → Script properties**, add:
   - `FOLDER_ID`: the folder ID
   - `VIEWER_PASSWORD`: for partners and readers
   - `UPLOADER_PASSWORD`: a different, stronger password for people who upload
3. In the editor, choose `testSetup` and click **Run**. Approve Drive access. The log should show the folder name.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Copy the `/exec` URL.
5. Optional: in Drive, move the project into a shared drive (**right-click → Organize → Move**). The URL stays the same.

### 3. GitHub Pages
1. Create a public repo `sjn-reports` (public is required for Pages on free plans, and it's safe: no reports or passwords are in it).
2. Add `index.html`, `sjn-logo.png` (transparent PNG, 600px+ wide) and `favicon.ico`. File names are case-sensitive.
3. Put your `/exec` URL on the `API_URL` line in `index.html`, keeping the quote marks.
4. Commit and push, then **Settings → Pages → Deploy from a branch → main / (root) → Save**.

### 4. Custom domain
1. **Settings → Pages → Custom domain**: `reports.solutionsjournalism.org` → Save. This adds a `CNAME` file to the repo, so pull before your next push.
2. In GoDaddy DNS for solutionsjournalism.org, add a **CNAME**: name `reports`, value `YOUR-GITHUB-USERNAME.github.io`.
3. Once GitHub's DNS check passes, tick **Enforce HTTPS**. The certificate can take up to 24 hours.

## Making updates

**Website changes (`index.html`, logo, favicon):** commit and push. Live in a minute or two, then hard refresh (Cmd/Ctrl + Shift + R).

**Backend changes (`Code.gs`):** paste in, **Save**, then **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. Saving alone doesn't change the live app. Always edit the existing deployment. **New deployment** creates a new URL.

**When both files change together, update Apps Script first, then push `index.html`.**

## Everyday use

- **Uploading:** sign in with the uploader password → **Upload reports** → drop in HTML files. Titles come from each report's `<title>`, and you can edit them and add a summary. Anyone with edit access to the Drive folder can also drop files in directly.
- **Deleting:** moves the file to Drive trash, restorable for 30 days.
- **Linking to one report:** open it and copy the address (it ends in `#report=…`). Whoever opens that link goes straight to the report after signing in.
- **Sharing with partners:** send the link and the viewer password separately.

## Passwords and sessions

- Change passwords by editing the Script properties. No redeploy needed.
- Sign-ins last up to 6 hours. To sign everyone out right away, change `'s_'` to something new (e.g. `'s2_'`) in the three places it appears in `Code.gs` and deploy a new version.
- After 20 wrong passwords in 10 minutes, sign-in pauses for everyone for 10 minutes.
- Anyone with access to the Apps Script project can see the passwords, so keep that shared drive's membership small.

## How the site handles a few tricky things

- **Report scripts:** reports open in a sandboxed frame, so charts and interactive parts work but can't read the sign-in session.
- **Links inside reports:** links to another section of the same report (like a table of contents) scroll within the report. All other links open in a new tab.
- **Back button:** opening a report adds a step to browser history, so Back returns to the list rather than leaving the site.
- **Google's redirects:** Google sometimes drops the contents of requests sent to Apps Script. To avoid that, sign-in, the report list and deleting are sent in the request address (encrypted over HTTPS). Opening a report and uploading use POST with automatic retries, because some reports fail to come back over GET. Sign-in also returns the report list in the same trip.

## Troubleshooting

| What you see | Likely cause and fix |
|---|---|
| "Secure Site Not Available" / HTTPS warning | GitHub's certificate isn't issued yet. Check **Enforce HTTPS** in Settings → Pages. If stuck for hours, remove and re-add the custom domain. Also check GoDaddy for **CAA** records that don't include `letsencrypt.org`. |
| `Unexpected token '<'` or `Unexpected token 'S'` | Apps Script returned a page instead of data. Make sure both files are the latest versions and Apps Script has been redeployed as a **New version**. Visiting the `/exec` URL in a private window should show a line ending in "SJN Reports API is running." |
| "Couldn't reach the reports server" | Google was unreachable after several retries. Try again in a moment. |
| "FOLDER_ID is not set" / "No item with the given ID" | Check the `FOLDER_ID` Script property for typos or spaces. |
| "You do not have permission to call DriveApp" | Run `testSetup` in the editor, approve access, and deploy a new version. |
| Text wordmark shows instead of the logo | `sjn-logo.png` is missing or named differently (case matters). |
| First sign-in takes a few seconds | Normal: Apps Script waking up after a quiet period. |
| Changes don't appear | Hard refresh. For `Code.gs`, check you deployed a new version. |
