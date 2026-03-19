/* ─────────────────────────────────────────────
   Video Showcase Gallery v2 — main.js
   Dynamically renders from JSONBin config.
   Share URL: https://your-site.pages.dev/#YOUR_BIN_ID
   ───────────────────────────────────────────── */

const JSONBIN_BASE   = 'https://api.jsonbin.io/v3/b';
// TODO: remove before production
const DEFAULT_BIN_ID = '69bb6594b7ec241ddc7ff79f';

// ── Utils ─────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = (hex || '#36C5F0').replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) || 54,
    g: parseInt(h.slice(2, 4), 16) || 197,
    b: parseInt(h.slice(4, 6), 16) || 240,
  };
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '').replace(/\/embed2?/g, '');
    return `https://vimeo.com${path}/embed2`;
  } catch { return ''; }
}

function toFeaturedUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '').replace(/\/embed2?/g, '');
    return `https://vimeo.com${path}?share=copy&fl=sm&fe=fs`;
  } catch { return url; }
}

// ── Init ──────────────────────────────────────────────────

async function init() {
  // Read bin ID from URL hash (sharing link) and persist it.
  // JSONBin IDs are 24-char hex strings — ignore section anchors like #galleries.
  const hash = location.hash.slice(1);
  if (/^[a-f0-9]{24}$/i.test(hash)) {
    localStorage.setItem('vsg_bin_id', hash);
    history.replaceState(null, '', location.pathname);
  }

  // Always reset to hardcoded default to clear any stale localStorage values
  localStorage.setItem('vsg_bin_id', DEFAULT_BIN_ID);
  const binId = DEFAULT_BIN_ID;

  if (!binId) {
    document.getElementById('hero-sub').innerHTML =
      'No gallery configured yet. <a href="/config.html" class="hero-setup-link">Set it up →</a>';
    document.getElementById('scroll-cta').hidden = true;
    initScrollFeatures([]);
    return;
  }

  try {
    const res = await fetch(`${JSONBIN_BASE}/${binId}/latest`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { record } = await res.json();
    applyConfig(record);
  } catch (err) {
    console.warn('Gallery config error:', err);
    document.getElementById('hero-sub').textContent = 'Could not load gallery configuration.';
    document.getElementById('scroll-cta').hidden = true;
    initScrollFeatures([]);
  }
}

// ── Apply config ──────────────────────────────────────────

function applyConfig({ featuredSection, galleriesSection, showcases = [] }) {
  const showFeatured  = featuredSection?.enabled  && showcases.length > 0;
  const showGalleries = galleriesSection?.enabled && showcases.length > 0;

  if (showFeatured) {
    renderFolders(showcases);
    document.getElementById('folders').hidden = false;
  }

  if (showGalleries) {
    renderGalleries(showcases);
    document.getElementById('galleries').hidden = false;
  }

  // Fix scroll CTA
  const scrollCta = document.getElementById('scroll-cta');
  if (scrollCta) {
    if (showFeatured)       scrollCta.href = '#folders';
    else if (showGalleries) scrollCta.href = '#galleries';
    else                    scrollCta.hidden = true;
  }

  // If galleries visible but featured hidden, hide the featured down-arrow
  // and fix galleries up-arrow to point to hero
  if (!showFeatured) {
    document.getElementById('folders-down-arrow')?.remove();
  }
  if (showGalleries && !showFeatured) {
    const up = document.getElementById('galleries-up-arrow');
    if (up) up.href = '#hero';
  }

  // Nav dot sections
  const navIds = ['hero'];
  if (showFeatured)  navIds.push('folders');
  if (showGalleries) navIds.push('galleries');

  initScrollFeatures(navIds);
  initReveal();
  initGalleryToggles();

  // Scroll to the hash section now that content is visible.
  // Browsers scroll to #hash before dynamic content renders, so we redo it here.
  const hash = location.hash.slice(1);
  if (hash) {
    const target = document.getElementById(hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'instant' }), 0);
  }
}

// ── Render: featured folder cards ─────────────────────────

function renderFolders(showcases) {
  document.getElementById('folders-grid').innerHTML = showcases.map(s => {
    const { r, g, b } = hexToRgb(s.color);
    return `
      <a class="folder-card"
         href="${escHtml(toFeaturedUrl(s.url))}"
         target="_blank"
         rel="noopener noreferrer"
         aria-label="Open ${escHtml(s.title)} in a new tab">
        <div class="folder-thumb"
             style="background:${escHtml(s.color || '#36C5F0')};--thumb-rgb:${r},${g},${b}">
          <svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3"  y="3"  width="8" height="8" rx="1.5"/>
            <rect x="13" y="3"  width="8" height="8" rx="1.5"/>
            <rect x="3"  y="13" width="8" height="8" rx="1.5"/>
            <rect x="13" y="13" width="8" height="8" rx="1.5"/>
          </svg>
        </div>
        <span class="folder-name">${escHtml(s.title)}</span>
      </a>`;
  }).join('');
}

// ── Render: expanding gallery blocks ──────────────────────

function renderGalleries(showcases) {
  document.getElementById('galleries-inner').innerHTML = showcases.map((s, i) => {
    const { r, g, b } = hexToRgb(s.color);
    const isAlt  = i % 2 !== 0;
    const num    = String(i + 1).padStart(2, '0');
    const safeId = escHtml(s.id);
    const divider = i > 0
      ? `<div class="section-divider" aria-hidden="true">
           <div class="div-line"></div><div class="div-dot"></div><div class="div-line"></div>
         </div>`
      : '';
    return `${divider}
      <article class="gallery-block" id="gallery-${safeId}">
        <div class="gallery-header${isAlt ? ' gallery-header--alt' : ''}" data-reveal>
          <span class="gallery-chip"
                style="background:rgba(${r},${g},${b},0.12);color:${escHtml(s.color)};border:1px solid rgba(${r},${g},${b},0.25)">
            Gallery ${num}
          </span>
          <h2 class="gallery-title">${escHtml(s.title)}</h2>
          <button class="toggle-btn"
                  data-target="player-${safeId}"
                  aria-expanded="false"
                  aria-controls="player-${safeId}"
                  style="--btn-color:${escHtml(s.color)};--btn-rgb:${r},${g},${b}">
            <span class="btn-label">Open Gallery</span>
            <span class="btn-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </span>
          </button>
        </div>
        <div class="player-wrap" id="player-${safeId}" aria-hidden="true">
          <div class="player-inner">
            <iframe class="showcase-iframe"
                    src="${escHtml(toEmbedUrl(s.url))}?height=300px"
                    scrolling="no"
                    allowfullscreen
                    frameborder="0"
                    loading="eager"
                    title="${escHtml(s.title)}"></iframe>
          </div>
        </div>
      </article>`;
  }).join('');
}

// ── Scroll features (progress bar, nav dots, parallax, Vimeo) ──

function initScrollFeatures(navIds) {
  // Progress bar
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  document.body.prepend(bar);
  window.addEventListener('scroll', () => {
    const pct = (window.scrollY / (document.body.scrollHeight - innerHeight)) * 100;
    bar.style.width = `${pct}%`;
  }, { passive: true });

  // Nav dots (only if more than just hero)
  if (navIds.length > 1) {
    const navLabels = { hero: 'Top', folders: 'Featured', galleries: 'Galleries' };
    const nav = document.createElement('nav');
    nav.className = 'nav-dots';
    nav.ariaLabel = 'Page sections';

    navIds.forEach(id => {
      const btn = document.createElement('button');
      btn.className  = 'nav-dot';
      btn.title      = navLabels[id] || id;
      btn.ariaLabel  = navLabels[id] || id;
      btn.addEventListener('click', () =>
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      );
      nav.appendChild(btn);
    });
    document.body.appendChild(nav);

    const sections = navIds.map(id => document.getElementById(id)).filter(Boolean);
    const dots     = () => nav.querySelectorAll('.nav-dot');

    new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const idx = sections.indexOf(entry.target);
        dots().forEach((d, i) => d.classList.toggle('active', i === idx));
      });
    }, { threshold: 0.4 }).observe && sections.forEach(s => {
      new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const idx = sections.indexOf(entry.target);
          dots().forEach((d, i) => d.classList.toggle('active', i === idx));
        });
      }, { threshold: 0.4 }).observe(s);
    });
  }

  // Parallax on hero orbs
  const orbs = document.querySelectorAll('.orb');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    orbs.forEach((orb, i) => {
      orb.style.transform = `translateY(${y * (0.08 + i * 0.04)}px)`;
    });
  }, { passive: true });

}

// ── Scroll-reveal ─────────────────────────────────────────

function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));
}

// ── Gallery toggle ────────────────────────────────────────

function initGalleryToggles() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const player = document.getElementById(btn.dataset.target);
      const isOpen = player.classList.contains('open');

      // Close all open players
      document.querySelectorAll('.player-wrap.open').forEach(p => {
        if (p === player) return;
        p.classList.remove('open');
        p.setAttribute('aria-hidden', 'true');
        const ob = document.querySelector(`[data-target="${p.id}"]`);
        if (ob) {
          ob.setAttribute('aria-expanded', 'false');
          ob.querySelector('.btn-label').textContent = 'Open Gallery';
        }
      });

      if (isOpen) {
        player.classList.remove('open');
        player.setAttribute('aria-hidden', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.querySelector('.btn-label').textContent = 'Open Gallery';
        // After collapsing, scroll back to the top of the galleries section —
        // same position as a fresh /#galleries load.
        setTimeout(() => {
          document.getElementById('galleries').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 560);
      } else {
        player.classList.add('open');
        player.setAttribute('aria-hidden', 'false');
        btn.setAttribute('aria-expanded', 'true');
        btn.querySelector('.btn-label').textContent = 'Close Gallery';
      }
    });
  });
}

// ── Run ───────────────────────────────────────────────────
init();
