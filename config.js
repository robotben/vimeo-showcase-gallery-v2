/* ─────────────────────────────────────────────
   Gallery Config — config.js
   Reads/writes gallery config to a JSONBin.io bin.
   Credentials stored in localStorage (this browser only).
   ───────────────────────────────────────────── */

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

let config = {
  featuredSection:  { enabled: true },
  galleriesSection: { enabled: true },
  showcases: [],
};

let editingId = null;

// ── Init ──────────────────────────────────────────────────

function init() {
  // Restore saved credentials
  document.getElementById('bin-id').value     = localStorage.getItem('vsg_bin_id')     || '';
  document.getElementById('master-key').value = localStorage.getItem('vsg_master_key') || '';

  // Auto-connect if credentials exist
  if (localStorage.getItem('vsg_bin_id') && localStorage.getItem('vsg_master_key')) {
    connect();
  }

  // Bindings
  document.getElementById('connect-btn').addEventListener('click', connect);
  document.getElementById('save-btn').addEventListener('click', save);
  document.getElementById('add-btn').addEventListener('click', handleAddOrUpdate);
  document.getElementById('cancel-btn').addEventListener('click', cancelEdit);
  document.getElementById('share-url-box').addEventListener('click', copyShareUrl);

  // Color picker ↔ hex sync
  const picker = document.getElementById('sc-color-picker');
  const hex    = document.getElementById('sc-color-hex');

  picker.addEventListener('input', () => { hex.value = picker.value; });
  hex.addEventListener('input', () => {
    const v = hex.value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) picker.value = v;
  });

  // Section toggles update config in memory
  document.getElementById('toggle-featured').addEventListener('change', e => {
    config.featuredSection.enabled = e.target.checked;
  });
  document.getElementById('toggle-galleries').addEventListener('change', e => {
    config.galleriesSection.enabled = e.target.checked;
  });
}

// ── JSONBin: connect ──────────────────────────────────────

async function connect() {
  const binId     = document.getElementById('bin-id').value.trim();
  const masterKey = document.getElementById('master-key').value.trim();

  if (!binId || !masterKey) {
    setStatus('error', 'Enter both Bin ID and Master Key');
    return;
  }

  setStatus('', 'Connecting…');

  try {
    const res = await fetch(`${JSONBIN_BASE}/${binId}/latest`, {
      headers: { 'X-Master-Key': masterKey },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { record } = await res.json();

    // Merge with defaults (handles empty / first-time bins)
    config = {
      featuredSection:  { enabled: true, ...(record.featuredSection  || {}) },
      galleriesSection: { enabled: true, ...(record.galleriesSection || {}) },
      showcases: Array.isArray(record.showcases) ? record.showcases : [],
    };

    localStorage.setItem('vsg_bin_id',     binId);
    localStorage.setItem('vsg_master_key', masterKey);

    setStatus('connected', 'Connected');
    showConfigUI();
    renderToggles();
    renderShowcaseList();
    updateShareUrl();

  } catch (err) {
    setStatus('error', `Failed: ${err.message}`);
  }
}

// ── JSONBin: save ─────────────────────────────────────────

async function save() {
  const binId     = localStorage.getItem('vsg_bin_id');
  const masterKey = localStorage.getItem('vsg_master_key');
  if (!binId || !masterKey) { toast('Not connected', 'error'); return; }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  // Sync toggles to config before saving
  config.featuredSection.enabled  = document.getElementById('toggle-featured').checked;
  config.galleriesSection.enabled = document.getElementById('toggle-galleries').checked;

  try {
    const res = await fetch(`${JSONBIN_BASE}/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': masterKey,
      },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    toast('Saved!', 'ok');
  } catch (err) {
    toast(`Save failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

// ── Show config UI after connect ──────────────────────────

function showConfigUI() {
  document.getElementById('sections-config').hidden  = false;
  document.getElementById('showcases-config').hidden = false;
  document.getElementById('share-url-section').hidden = false;
}

function renderToggles() {
  document.getElementById('toggle-featured').checked  = config.featuredSection?.enabled  ?? true;
  document.getElementById('toggle-galleries').checked = config.galleriesSection?.enabled ?? true;
}

// ── Showcase list ─────────────────────────────────────────

function renderShowcaseList() {
  const list = document.getElementById('showcase-list');

  if (!config.showcases.length) {
    list.innerHTML = '<p class="showcase-empty">No showcases added yet. Use the form below to add one.</p>';
    return;
  }

  list.innerHTML = config.showcases.map((s, i) => `
    <div class="showcase-item" data-id="${esc(s.id)}">
      <div class="showcase-color-dot" style="background:${esc(s.color || '#36C5F0')}"></div>
      <div class="showcase-item-info">
        <div class="showcase-item-title">${esc(s.title)}</div>
        <div class="showcase-item-url">${esc(s.url)}</div>
      </div>
      <div class="showcase-item-actions">
        ${i > 0
          ? `<button class="icon-btn" onclick="move('${esc(s.id)}',-1)" title="Move up">↑</button>`
          : ''}
        ${i < config.showcases.length - 1
          ? `<button class="icon-btn" onclick="move('${esc(s.id)}',1)" title="Move down">↓</button>`
          : ''}
        <button class="icon-btn" onclick="startEdit('${esc(s.id)}')">Edit</button>
        <button class="icon-btn danger" onclick="del('${esc(s.id)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// ── Add / update ──────────────────────────────────────────

function handleAddOrUpdate() {
  const title = document.getElementById('sc-title').value.trim();
  const url   = document.getElementById('sc-url').value.trim();
  const color = document.getElementById('sc-color-hex').value.trim() || '#36C5F0';

  if (!title) { toast('Enter a title', 'error'); return; }
  if (!url)   { toast('Enter a Vimeo showcase URL', 'error'); return; }
  if (!isVimeoShowcase(url)) { toast('URL must be a vimeo.com/showcase/… link', 'error'); return; }
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) { toast('Enter a valid hex color e.g. #36C5F0', 'error'); return; }

  if (editingId) {
    const idx = config.showcases.findIndex(s => s.id === editingId);
    if (idx !== -1) config.showcases[idx] = { ...config.showcases[idx], title, url, color };
    cancelEdit();
    toast('Showcase updated');
  } else {
    config.showcases.push({ id: uid(), title, url, color });
    clearForm();
    toast('Showcase added');
  }

  renderShowcaseList();
}

// ── Edit ──────────────────────────────────────────────────

function startEdit(id) {
  const s = config.showcases.find(s => s.id === id);
  if (!s) return;
  editingId = id;

  document.getElementById('sc-title').value       = s.title;
  document.getElementById('sc-url').value         = s.url;
  document.getElementById('sc-color-hex').value   = s.color || '#36C5F0';
  document.getElementById('sc-color-picker').value = s.color || '#36C5F0';

  document.getElementById('add-form-title').textContent = 'Edit Showcase';
  document.getElementById('add-btn').textContent         = 'Update Showcase';
  document.getElementById('cancel-btn').hidden           = false;

  document.getElementById('sc-title').focus();
  document.querySelector('.add-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelEdit() {
  editingId = null;
  clearForm();
  document.getElementById('add-form-title').textContent = 'Add Showcase';
  document.getElementById('add-btn').textContent         = 'Add Showcase';
  document.getElementById('cancel-btn').hidden           = true;
}

// ── Delete ────────────────────────────────────────────────

function del(id) {
  if (!confirm('Delete this showcase?')) return;
  config.showcases = config.showcases.filter(s => s.id !== id);
  if (editingId === id) cancelEdit();
  renderShowcaseList();
  toast('Showcase deleted');
}

// ── Reorder ───────────────────────────────────────────────

function move(id, dir) {
  const idx = config.showcases.findIndex(s => s.id === id);
  const to  = idx + dir;
  if (to < 0 || to >= config.showcases.length) return;
  [config.showcases[idx], config.showcases[to]] = [config.showcases[to], config.showcases[idx]];
  renderShowcaseList();
}

// ── Share URL ─────────────────────────────────────────────

function updateShareUrl() {
  const binId = localStorage.getItem('vsg_bin_id') || '';
  document.getElementById('share-url-box').textContent =
    `${location.origin}/#${binId}`;
}

function copyShareUrl() {
  const url = document.getElementById('share-url-box').textContent.trim();
  navigator.clipboard.writeText(url)
    .then(() => toast('URL copied!', 'ok'))
    .catch(() => toast('Copy failed — select & copy manually', 'error'));
}

// ── Connection status ─────────────────────────────────────

function setStatus(type, msg) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  dot.className = 'status-dot' + (type ? ' ' + type : '');
  text.textContent = msg;
}

// ── Helpers ───────────────────────────────────────────────

function clearForm() {
  document.getElementById('sc-title').value        = '';
  document.getElementById('sc-url').value          = '';
  document.getElementById('sc-color-hex').value    = '#36C5F0';
  document.getElementById('sc-color-picker').value = '#36C5F0';
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function isVimeoShowcase(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'vimeo.com' && u.pathname.includes('/showcase/');
  } catch { return false; }
}

// ── Toast ─────────────────────────────────────────────────

let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Run ───────────────────────────────────────────────────
init();
