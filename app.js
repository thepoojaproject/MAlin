// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ===== Admin credentials =====
const ADMIN_ID = 'Bhim';
const ADMIN_PASS = 'Bhim@1999';
const AUTH_KEY = 'malin_admin_logged_in';
const STORAGE_KEY = 'malin_user_comics';
const DB_NAME = 'malin_comics_db';
const DB_STORE = 'pdfs';

// DOM
const uploadBtn = document.getElementById('uploadBtn');
const pdfInput = document.getElementById('pdfInput');
const uploadModal = document.getElementById('uploadModal');
const closeModal = document.getElementById('closeModal');
const cancelUpload = document.getElementById('cancelUpload');
const confirmUpload = document.getElementById('confirmUpload');
const dropZone = document.getElementById('dropZone');
const browseBtn = document.getElementById('browseBtn');
const previewList = document.getElementById('previewList');
const comicsGrid = document.getElementById('comicsGrid');
const emptyState = document.getElementById('emptyState');
const comicsLoading = document.getElementById('comicsLoading');
const noResults = document.getElementById('noResults');
const toast = document.getElementById('toast');
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const headerSearchBtn = document.getElementById('headerSearchBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminBadge = document.getElementById('adminBadge');
const loginModal = document.getElementById('loginModal');
const closeLoginModal = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const unlimitedBtn = document.getElementById('unlimitedBtn');

// PDF Viewer DOM
const pdfViewerModal = document.getElementById('pdfViewerModal');
const pdfViewerTitle = document.getElementById('pdfViewerTitle');
const pdfCanvas = document.getElementById('pdfCanvas');
const pdfPageInfo = document.getElementById('pdfPageInfo');
const pdfPrev = document.getElementById('pdfPrev');
const pdfNext = document.getElementById('pdfNext');
const closePdfViewer = document.getElementById('closePdfViewer');
const pdfCanvasWrap = document.getElementById('pdfCanvasWrap');

let pendingFiles = [];
let isAdmin = false;

// PDF viewer state
let currentPdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let rendering = false;

// ===== IndexedDB for PDF blobs =====
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePdfBlob(id, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put({ id, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPdfBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    req.onerror = () => reject(req.error);
  });
}

async function deletePdfBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== Auth =====
function checkAuth() {
  isAdmin = sessionStorage.getItem(AUTH_KEY) === 'true';
  updateUIForAuth();
}

function updateUIForAuth() {
  if (isAdmin) {
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    adminBadge.style.display = 'inline-block';
    uploadBtn.style.display = 'inline-block';
    document.querySelectorAll('.comic-card .remove-btn').forEach(btn => {
      btn.style.display = '';
    });
  } else {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    adminBadge.style.display = 'none';
    uploadBtn.style.display = 'none';
    document.querySelectorAll('.comic-card .remove-btn').forEach(btn => {
      btn.style.display = 'none';
    });
  }
}

loginBtn.addEventListener('click', () => {
  loginError.style.display = 'none';
  document.getElementById('adminId').value = '';
  document.getElementById('adminPass').value = '';
  loginModal.style.display = '';
  loginModal.classList.add('open');
});

closeLoginModal.addEventListener('click', () => {
  loginModal.classList.remove('open');
  loginModal.style.display = 'none';
});

loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) {
    loginModal.classList.remove('open');
    loginModal.style.display = 'none';
  }
});

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('adminId').value.trim();
  const pass = document.getElementById('adminPass').value;

  if (id === ADMIN_ID && pass === ADMIN_PASS) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    isAdmin = true;
    updateUIForAuth();
    loginModal.classList.remove('open');
    loginModal.style.display = 'none';
    showToast('Welcome Admin, Bhim!');
  } else {
    loginError.style.display = 'block';
  }
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_KEY);
  isAdmin = false;
  updateUIForAuth();
  showToast('Logged out');
});

// ===== Search =====
function performSearch() {
  const query = searchInput.value.trim().toLowerCase();
  clearSearch.style.display = query ? 'block' : 'none';

  const cards = comicsGrid.querySelectorAll('.comic-card');
  let visibleCount = 0;

  cards.forEach(card => {
    const title = (card.dataset.title || card.querySelector('.title')?.textContent || '').toLowerCase();
    const creators = (card.dataset.creators || card.querySelector('.creators')?.textContent || '').toLowerCase();
    const match = !query || title.includes(query) || creators.includes(query);
    card.classList.toggle('hidden', !match);
    if (match) visibleCount++;
  });

  noResults.style.display = (query && visibleCount === 0) ? 'block' : 'none';
}

searchInput.addEventListener('input', performSearch);

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  performSearch();
  searchInput.focus();
});

headerSearchBtn.addEventListener('click', () => {
  searchInput.focus();
});

// ===== Upload Modal =====
uploadBtn.addEventListener('click', () => {
  if (!isAdmin) {
    showToast('Please login as Admin to upload');
    return;
  }
  uploadModal.style.display = '';
  uploadModal.classList.add('open');
  pendingFiles = [];
  previewList.innerHTML = '';
  confirmUpload.disabled = true;
});

function closeUploadModal() {
  uploadModal.classList.remove('open');
  uploadModal.style.display = 'none';
  setTimeout(() => { uploadModal.style.display = ''; }, 50);
  pendingFiles = [];
  previewList.innerHTML = '';
  pdfInput.value = '';
  confirmUpload.disabled = true;
}

closeModal.addEventListener('click', closeUploadModal);
cancelUpload.addEventListener('click', closeUploadModal);

uploadModal.addEventListener('click', (e) => {
  if (e.target === uploadModal) closeUploadModal();
});

browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  pdfInput.click();
});

dropZone.addEventListener('click', () => pdfInput.click());

pdfInput.addEventListener('change', (e) => {
  handleFiles(Array.from(e.target.files));
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  handleFiles(files);
});

async function handleFiles(files) {
  if (!files.length) return;

  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) {
      showToast(`${file.name} is larger than 50MB – skipped`);
      continue;
    }

    const id = 'pdf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const title = cleanTitle(file.name);
    const entry = { file, title, creators: 'You (Uploaded)', coverDataUrl: null, id };

    pendingFiles.push(entry);
    renderPreviewItem(entry);

    try {
      const cover = await extractPdfCover(file);
      entry.coverDataUrl = cover;
      updatePreviewThumb(id, cover);
    } catch (err) {
      console.warn('Could not extract cover for', file.name, err);
      entry.coverDataUrl = createPlaceholder(title);
      updatePreviewThumb(id, entry.coverDataUrl);
    }
  }

  confirmUpload.disabled = pendingFiles.length === 0;
}

function cleanTitle(filename) {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function createPlaceholder(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 450;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 300, 450);
  ctx.fillStyle = '#1a8f3c';
  ctx.font = 'bold 18px Roboto, Arial';
  ctx.textAlign = 'center';
  const words = text.split(' ');
  let line = '';
  let y = 200;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > 260) {
      ctx.fillText(line, 150, y);
      line = word + ' ';
      y += 28;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, 150, y);
  ctx.fillStyle = '#666';
  ctx.font = '12px Roboto, Arial';
  ctx.fillText('PDF', 150, 420);
  return canvas.toDataURL('image/jpeg', 0.55);
}

async function extractPdfCover(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 0.9 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.55);
}

function renderPreviewItem(entry) {
  const div = document.createElement('div');
  div.className = 'preview-item';
  div.dataset.id = entry.id;
  div.innerHTML = `
    <img class="preview-thumb" src="${entry.coverDataUrl || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2275%22><rect fill=%22%23ddd%22 width=%2250%22 height=%2275%22/></svg>'}" alt="" />
    <div class="preview-info">
      <div class="name">${escapeHtml(entry.title)}</div>
      <div class="meta">${formatSize(entry.file.size)}</div>
    </div>
    <button class="remove-preview" title="Remove">&times;</button>
  `;
  div.querySelector('.remove-preview').addEventListener('click', () => {
    pendingFiles = pendingFiles.filter(p => p.id !== entry.id);
    div.remove();
    confirmUpload.disabled = pendingFiles.length === 0;
  });
  previewList.appendChild(div);
}

function updatePreviewThumb(id, dataUrl) {
  const item = previewList.querySelector(`[data-id="${id}"]`);
  if (item) {
    item.querySelector('.preview-thumb').src = dataUrl;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Confirm upload =====
confirmUpload.addEventListener('click', async () => {
  if (!pendingFiles.length || !isAdmin) return;

  const count = pendingFiles.length;
  const ordered = [...pendingFiles].reverse();

  for (const entry of ordered) {
    addComicCard(entry);
    // Save PDF blob to IndexedDB
    try {
      await savePdfBlob(entry.id, entry.file);
    } catch (err) {
      console.warn('IndexedDB save failed', err);
    }
  }

  closeUploadModal();
  showToast(`${count} comic${count > 1 ? 's' : ''} added!`);
  updateEmptyState();
  performSearch();

  try {
    saveToStorage(ordered);
  } catch (err) {
    console.warn('Could not save metadata:', err);
  }
});

function addComicCard(entry) {
  const card = document.createElement('article');
  card.className = 'comic-card';
  card.dataset.id = entry.id;
  card.dataset.title = entry.title;
  card.dataset.creators = entry.creators;
  if (entry.staticUrl) card.dataset.staticUrl = entry.staticUrl;
  const isStatic = !!entry.staticUrl;
  card.innerHTML = `
    <div class="cover-wrap">
      <img src="${entry.coverDataUrl}" alt="${escapeHtml(entry.title)}" class="cover" />
      <span class="pdf-badge">PDF</span>
      ${isStatic ? '' : `<button class="remove-btn" title="Remove" style="${isAdmin ? '' : 'display:none'}">&times;</button>`}
    </div>
    <div class="comic-info">
      <h3 class="title">${escapeHtml(entry.title)}</h3>
      <p class="creators">${escapeHtml(entry.creators)}</p>
    </div>
  `;

  if (!isStatic) {
    card.querySelector('.remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAdmin) return;
      removeComic(entry.id);
    });
  }

  // Open PDF inside page viewer (no download / no new tab)
  card.addEventListener('click', async (e) => {
    if (e.target.classList.contains('remove-btn')) return;
    await openPdfInViewer(entry.id, entry.title, entry.file || null, entry.staticUrl || null);
  });

  comicsGrid.prepend(card);
}

async function removeComic(id) {
  if (!isAdmin) return;
  const card = comicsGrid.querySelector(`[data-id="${id}"]`);
  if (card) card.remove();
  removeFromStorage(id);
  try { await deletePdfBlob(id); } catch (e) {}
  updateEmptyState();
  performSearch();
  showToast('Comic removed');
}

function updateEmptyState() {
  const total = comicsGrid.querySelectorAll('.comic-card').length;
  if (comicsLoading) comicsLoading.classList.add('hidden');
  emptyState.style.display = total === 0 ? 'block' : 'none';
}

function showComicsLoading() {
  if (comicsLoading) comicsLoading.classList.remove('hidden');
  if (emptyState) emptyState.style.display = 'none';
}

// ===== LocalStorage metadata =====
function saveToStorage(entries) {
  // disabled — do not persist uploads in localStorage
}

function removeFromStorage(id) {
  let list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  list = list.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadFromStorage() {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  list.reverse().forEach(entry => {
    const card = document.createElement('article');
    card.className = 'comic-card';
    card.dataset.id = entry.id;
    card.dataset.title = entry.title;
    card.dataset.creators = entry.creators;
    card.innerHTML = `
      <div class="cover-wrap">
        <img src="${entry.coverDataUrl}" alt="${escapeHtml(entry.title)}" class="cover" />
        <span class="pdf-badge">PDF</span>
        <button class="remove-btn" title="Remove" style="display:none">&times;</button>
      </div>
      <div class="comic-info">
        <h3 class="title">${escapeHtml(entry.title)}</h3>
        <p class="creators">${escapeHtml(entry.creators)}</p>
      </div>
    `;
    card.querySelector('.remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAdmin) return;
      removeComic(entry.id);
    });
    card.addEventListener('click', async (e) => {
      if (e.target.classList.contains('remove-btn')) return;
      await openPdfInViewer(entry.id, entry.title, null, null);
    });
    comicsGrid.prepend(card);
  });
  updateEmptyState();
}

// ===== Comics from comics/list.txt =====
// line: filename.pdf  OR  filename.pdf|Display Title
function encodePdfUrl(relativePath) {
  return relativePath.split('/').map(function (s) { return encodeURIComponent(s); }).join('/');
}

function parseComicsList(text) {
  var seen = {};
  var out = [];
  text.split(/\r?\n/).forEach(function (raw) {
    var line = raw.trim();
    if (!line || line.charAt(0) === '#') return;
    var filePart = line;
    var customTitle = null;
    var pipe = line.indexOf('|');
    if (pipe !== -1) {
      filePart = line.slice(0, pipe).trim();
      customTitle = line.slice(pipe + 1).trim() || null;
    }
    if ((filePart.charAt(0) === '"' && filePart.slice(-1) === '"') ||
        (filePart.charAt(0) === "'" && filePart.slice(-1) === "'")) {
      filePart = filePart.slice(1, -1).trim();
    }
    if (!/\.pdf$/i.test(filePart)) return;
    var base = filePart.replace(/^.*[/\\]/, '');
    var key = base.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    var idBase = base.replace(/\.pdf$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'comic';
    out.push({
      id: 'comic-' + idBase,
      title: customTitle || cleanTitle(base),
      creators: 'Bhim Mondal',
      staticUrl: encodePdfUrl('comics/' + base),
      fileName: base
    });
  });
  return out;
}

async function loadBuiltinComics() {
  showComicsLoading();
  var list = [];
  try {
    var res = await fetch('comics/list.txt', { cache: 'no-store' });
    if (res.ok) list = parseComicsList(await res.text());
  } catch (err) {
    console.warn('list.txt error', err);
  }

  for (var i = 0; i < list.length; i++) {
    var comic = list[i];
    if (comicsGrid.querySelector('[data-id="' + comic.id + '"]')) continue;
    var entry = {
      id: comic.id,
      title: comic.title,
      creators: comic.creators,
      staticUrl: comic.staticUrl,
      coverDataUrl: null
    };
    try {
      var pdf = await pdfjsLib.getDocument({ url: entry.staticUrl }).promise;
      var page = await pdf.getPage(1);
      var viewport = page.getViewport({ scale: 1.0 });
      var canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      entry.coverDataUrl = canvas.toDataURL('image/jpeg', 0.72);
    } catch (err) {
      console.warn('Cover failed:', comic.fileName, err);
      entry.coverDataUrl = createPlaceholder(entry.title);
    }
    addComicCard(entry);
  }
  updateEmptyState();
}

// ===== In-page PDF Viewer (no download) =====
async function openPdfInViewer(id, title, fileOrNull, staticUrl) {
  let data = null;
  let loadSource = null;

  if (fileOrNull) {
    data = await fileOrNull.arrayBuffer();
    loadSource = { data };
  } else if (staticUrl) {
    loadSource = { url: staticUrl };
  } else {
    const blob = await getPdfBlob(id);
    if (!blob) {
      showToast('PDF not available. Re-upload required.');
      return;
    }
    data = await blob.arrayBuffer();
    loadSource = { data };
  }

  try {
    currentPdfDoc = await pdfjsLib.getDocument(loadSource).promise;
    totalPages = currentPdfDoc.numPages;
    currentPage = 1;
    pdfViewerTitle.textContent = title;
    pdfViewerModal.style.display = '';
    pdfViewerModal.classList.add('open');
    await renderPage(1);
    // Always start from top
    const body = document.querySelector('.pdf-viewer-body');
    if (body) body.scrollTop = 0;
  } catch (err) {
    console.error(err);
    showToast('Could not open PDF');
  }
}

async function renderPage(num) {
  if (!currentPdfDoc || rendering) return;
  rendering = true;
  currentPage = num;

  const page = await currentPdfDoc.getPage(num);
  // HiDPI: sharp text/art on phones
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pad = window.innerWidth < 600 ? 8 : 20;
  const containerWidth = Math.max(280, (pdfCanvasWrap.clientWidth || window.innerWidth) - pad);
  const unscaled = page.getViewport({ scale: 1 });
  const cssScale = containerWidth / unscaled.width;
  const viewport = page.getViewport({ scale: cssScale * dpr });

  pdfCanvas.width = Math.floor(viewport.width);
  pdfCanvas.height = Math.floor(viewport.height);
  pdfCanvas.style.width = Math.floor(viewport.width / dpr) + 'px';
  pdfCanvas.style.height = Math.floor(viewport.height / dpr) + 'px';

  const ctx = pdfCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  await page.render({ canvasContext: ctx, viewport }).promise;

  pdfPageInfo.textContent = `${num} / ${totalPages}`;
  pdfPrev.disabled = num <= 1;
  pdfNext.disabled = num >= totalPages;
  rendering = false;
  // Scroll viewer to top on every page change
  const body = document.querySelector('.pdf-viewer-body');
  if (body) body.scrollTop = 0;
}

pdfPrev.addEventListener('click', () => {
  if (currentPage > 1) renderPage(currentPage - 1);
});

pdfNext.addEventListener('click', () => {
  if (currentPage < totalPages) renderPage(currentPage + 1);
});

function closePdfViewerFn() {
  pdfViewerModal.classList.remove('open');
  pdfViewerModal.style.display = 'none';
  currentPdfDoc = null;
  // clear canvas
  const ctx = pdfCanvas.getContext('2d');
  ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
}

closePdfViewer.addEventListener('click', closePdfViewerFn);

pdfViewerModal.addEventListener('click', (e) => {
  if (e.target === pdfViewerModal) closePdfViewerFn();
});

// Keyboard navigation in viewer
document.addEventListener('keydown', (e) => {
  if (!pdfViewerModal.classList.contains('open')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentPage > 1) renderPage(currentPage - 1);
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault();
    if (currentPage < totalPages) renderPage(currentPage + 1);
  } else if (e.key === 'Escape') {
    closePdfViewerFn();
  }
});

// Block right-click on canvas (harder to "Save image")
pdfCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
pdfCanvasWrap.addEventListener('contextmenu', (e) => e.preventDefault());

// ===== Toast =====
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ===== Coming Soon =====
function showComingSoon(e) {
  e.preventDefault();
  e.stopPropagation();
  showToast('Coming Soon');
}

unlimitedBtn?.addEventListener('click', showComingSoon);

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', showComingSoon);
});

document.querySelectorAll('.comic-card:not([data-id^="pdf-"])').forEach(card => {
  card.addEventListener('click', (e) => {
    if (!e.target.classList.contains('remove-btn')) {
      showComingSoon(e);
    }
  });
});

// Init
checkAuth();
try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
// loadFromStorage(); // disabled — only comics/list.txt
loadBuiltinComics();
updateUIForAuth();
