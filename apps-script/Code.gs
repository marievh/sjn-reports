/**
 * SJN Reports — Apps Script backend
 *
 * Reports are stored as .html files in a PRIVATE Google Drive folder.
 * This script is the only way the website can reach them, and it checks
 * the password (server-side) on every request.
 *
 * Script Properties to set (Project Settings → Script properties):
 *   FOLDER_ID          ID of the Drive folder that holds the reports
 *   VIEWER_PASSWORD    password for people who can read reports
 *   UPLOADER_PASSWORD  password for people who can read, upload and delete
 */

const SESSION_SECONDS = 6 * 60 * 60;      // 6 hours (Apps Script cache maximum)
const MAX_FAILS = 20;                     // failed logins allowed per 10 minutes
const MAX_REPORT_BYTES = 20 * 1024 * 1024; // 20 MB per report

// GET: a health check when visited in a browser, or an API request sent as ?payload=...
// (the site falls back to this when a POST arrives without its body)
function doGet(e) {
  const payload = e && e.parameter && e.parameter.payload;
  if (!payload) return json_({ ok: false, error: 'RETRY', status: 'SJN Reports API is running.' });
  return handle_(payload);
}

function doPost(e) {
  const body = e && e.postData && e.postData.contents;
  if (!body) return json_({ ok: false, error: 'RETRY' });
  return handle_(body);
}

function handle_(text) {
  let out;
  try {
    out = route_(JSON.parse(text));
  } catch (err) {
    out = { ok: false, error: err.message || String(err) };
  }
  return json_(out);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  switch (req.action) {
    case 'login':
      return login_(req.password);
    case 'logout':
      if (req.token) CacheService.getScriptCache().remove('s_' + req.token);
      return { ok: true };
    case 'list':
      requireRole_(req.token, 'viewer');
      return { ok: true, reports: list_() };
    case 'get':
      requireRole_(req.token, 'viewer');
      return get_(req.id);
    case 'upload':
      requireRole_(req.token, 'uploader');
      return upload_(req);
    case 'delete':
      requireRole_(req.token, 'uploader');
      return delete_(req.id);
    default:
      throw new Error('Unknown action.');
  }
}

/* ---------- Sessions ---------- */

function login_(password) {
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();
  const fails = Number(cache.get('fails') || 0);
  if (fails >= MAX_FAILS) {
    throw new Error('Too many sign-in attempts. Try again in 10 minutes.');
  }

  let role = null;
  if (password && password === props.getProperty('UPLOADER_PASSWORD')) role = 'uploader';
  else if (password && password === props.getProperty('VIEWER_PASSWORD')) role = 'viewer';

  if (!role) {
    cache.put('fails', String(fails + 1), 600);
    Utilities.sleep(1500); // slows down password guessing
    throw new Error('That password is incorrect.');
  }

  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('s_' + token, role, SESSION_SECONDS);
  // Send the report list back with the sign-in, saving a second round trip
  return { ok: true, token: token, role: role, reports: list_() };
}

function requireRole_(token, needed) {
  const role = token ? CacheService.getScriptCache().get('s_' + token) : null;
  if (!role) throw new Error('SESSION_EXPIRED');
  if (needed === 'uploader' && role !== 'uploader') {
    throw new Error('This password does not allow uploads.');
  }
  return role;
}

/* ---------- Reports ---------- */

function folder_() {
  const id = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!id) throw new Error('FOLDER_ID is not set in Script properties.');
  return DriveApp.getFolderById(id);
}

function isHtml_(file) {
  return /\.html?$/i.test(file.getName()) || file.getMimeType() === MimeType.HTML;
}

function meta_(file) {
  try { return JSON.parse(file.getDescription() || '{}'); }
  catch (e) { return {}; }
}

// Only return files that really live in the reports folder, so a session
// can't be used to read other Drive files by guessing their IDs.
function reportFile_(id) {
  if (!id) throw new Error('Missing report ID.');
  const file = DriveApp.getFileById(id);
  const folderId = folder_().getId();
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId && !file.isTrashed()) return file;
  }
  throw new Error('Report not found.');
}

// Building the list means asking Drive about every file one question at a time, which gets
// slow as reports pile up. So the finished list is kept in a cache for 10 minutes, and
// cleared whenever someone uploads or deletes through the site.
const LIST_CACHE_KEY = 'report_list';
const LIST_CACHE_SECONDS = 10 * 60;

function list_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(LIST_CACHE_KEY);
  if (hit) return JSON.parse(hit);
  const reports = buildList_();
  const json = JSON.stringify(reports);
  if (json.length < 95000) cache.put(LIST_CACHE_KEY, json, LIST_CACHE_SECONDS); // cache limit is 100 KB
  return reports;
}

function clearListCache_() {
  CacheService.getScriptCache().remove(LIST_CACHE_KEY);
}

function buildList_() {
  const files = folder_().getFiles();
  const reports = [];
  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName();
    if (!/\.html?$/i.test(name) && f.getMimeType() !== MimeType.HTML) continue;
    if (f.isTrashed()) continue;
    const m = meta_(f);
    reports.push({
      id: f.getId(),
      title: m.title || name.replace(/\.html?$/i, ''),
      summary: m.summary || '',
      uploader: m.uploader || '',
      uploaded: m.uploaded || f.getDateCreated().toISOString(),
      fileName: name
    });
  }
  reports.sort(function (a, b) { return a.uploaded < b.uploaded ? 1 : -1; });
  return reports;
}

function get_(id) {
  const f = reportFile_(id);
  return {
    ok: true,
    fileName: f.getName(),
    html: f.getBlob().getDataAsString('UTF-8')
  };
}

function upload_(req) {
  const html = String(req.html || '');
  if (!html.trim()) throw new Error('The file is empty.');
  if (Utilities.newBlob(html).getBytes().length > MAX_REPORT_BYTES) {
    throw new Error('Reports must be under 20 MB.');
  }

  let name = String(req.fileName || 'report.html').replace(/[\\/:*?"<>|]/g, '-');
  if (!/\.html?$/i.test(name)) name += '.html';

  const title = String(req.title || '').slice(0, 200) || name.replace(/\.html?$/i, '');
  const meta = {
    title: title,
    summary: String(req.summary || '').slice(0, 1000),
    uploader: String(req.uploader || '').slice(0, 100),
    uploaded: new Date().toISOString()
  };

  const file = folder_().createFile(name, html, MimeType.HTML);
  file.setDescription(JSON.stringify(meta));
  clearListCache_();
  return { ok: true, id: file.getId() };
}

function delete_(id) {
  // Moves to Drive trash, so a deleted report can be restored for 30 days.
  reportFile_(id).setTrashed(true);
  clearListCache_();
  return { ok: true };
}

/* Run from the editor after dropping files straight into the Drive folder,
   so they show up on the site right away instead of within 10 minutes. */
function refreshList() {
  clearListCache_();
  Logger.log('Reports found: ' + list_().length);
}

/* Run once from the editor to grant Drive permission and check setup. */
function testSetup() {
  Logger.log('Folder: ' + folder_().getName());
  Logger.log('Reports found: ' + list_().length);
}
