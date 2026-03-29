// Guard against double-injection on the same page
if (!document.getElementById('clarity-reader-root')) {
  (function () {
    const content = extractContent();
    if (!content) {
      renderError();
      return;
    }
    renderCleanLayout(content);
  })();
}

function extractContent() {
  const candidates = scoreCandidates();
  if (candidates.length === 0) return null;

  const best = candidates[0];
  if (best.score < 15) return null;

  const article = best.element.cloneNode(true);
  cleanContent(article);

  const metadata = extractMetadata();
  const text = article.textContent || '';
  metadata.readingTime = Math.max(1, Math.round(text.split(/\s+/).length / 230));

  return { article, metadata };
}

function scoreCandidates() {
  const candidates = [];
  const blocks = document.querySelectorAll('article, main, section, div, [role="main"], [role="article"]');

  for (const el of blocks) {
    let score = 0;
    const tag = el.tagName.toLowerCase();

    if (tag === 'article') score += 50;
    else if (tag === 'main') score += 40;
    if (el.getAttribute('role') === 'main') score += 40;
    if (el.getAttribute('role') === 'article') score += 35;

    const text = el.textContent || '';
    const html = el.innerHTML || '';
    if (html.length > 0) {
      score += (text.length / html.length) * 30;
    }

    const paragraphs = el.querySelectorAll('p');
    score += Math.min(paragraphs.length * 3, 30);

    const links = el.querySelectorAll('a');
    const linkText = Array.from(links).reduce((sum, a) => sum + (a.textContent || '').length, 0);
    if (text.length > 0) {
      score -= (linkText / text.length) * 40;
    }

    const classId = ((el.className || '') + ' ' + (el.id || '')).toLowerCase();
    if (/article|post|content|entry|story|body-?text|main-?content|page-?content/.test(classId)) score += 25;
    if (/sidebar|nav|menu|footer|comment|widget|ad|banner|social|share|related|recommend/.test(classId)) score -= 30;

    if (text.trim().length < 200) score -= 20;

    candidates.push({ element: el, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function cleanContent(el) {
  const removeTags = ['script', 'style', 'iframe', 'form', 'nav', 'aside',
    'input', 'textarea', 'button', 'select', 'svg'];
  for (const tag of removeTags) {
    for (const node of el.querySelectorAll(tag)) node.remove();
  }

  const removePattern = /ad[s_-]?|sponsor|banner|promo|social|share|widget|sidebar|nav|menu|related|recommend|newsletter|signup|subscribe|cookie|consent|popup|modal/i;
  for (const node of el.querySelectorAll('*')) {
    const classId = ((node.className || '') + ' ' + (node.id || ''));
    if (removePattern.test(classId)) node.remove();
  }

  for (const node of el.querySelectorAll('[aria-hidden="true"], [hidden]')) node.remove();

  const preserveEmpty = new Set(['img', 'hr', 'br', 'video', 'audio', 'canvas']);
  for (const node of el.querySelectorAll('*')) {
    if (preserveEmpty.has(node.tagName.toLowerCase())) continue;
    if (!node.textContent?.trim() && !node.querySelector('img, video, audio, canvas')) {
      node.remove();
    }
  }

  // Strip only dangerous attributes — keep class, style, id for original formatting
  for (const node of el.querySelectorAll('*')) {
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.startsWith('on')) node.removeAttribute(attr.name);
    }
  }
}

// ---- Contrast fixer ----

function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function parseColor(str) {
  if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
  const m = str.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function fixContrast(root) {
  const BG_LUM = luminance(14, 14, 14); // #0e0e0e
  const all = root.querySelectorAll('*');

  // Pass 1: nuke all light backgrounds so our dark page shows through
  for (const el of all) {
    const bg = parseColor(getComputedStyle(el).backgroundColor);
    if (bg) {
      const bgLum = luminance(bg.r, bg.g, bg.b);
      if (bgLum > 0.15) {
        el.style.setProperty('background-color', 'transparent', 'important');
      }
    }
  }

  // Pass 2: now fix text colors against the actual rendered background
  // Since we cleared light bgs, effective bg is almost always our dark page bg
  for (const el of all) {
    if (!el.textContent?.trim()) continue;

    const fg = parseColor(getComputedStyle(el).color);
    if (!fg) continue;
    const fgLum = luminance(fg.r, fg.g, fg.b);

    // Walk up to find effective background
    let effectiveBgLum = BG_LUM;
    let parent = el;
    while (parent) {
      const pBg = parseColor(getComputedStyle(parent).backgroundColor);
      if (pBg) {
        const pLum = luminance(pBg.r, pBg.g, pBg.b);
        // Only count it if it's a real visible background (not near-black transparent remnant)
        if (pLum > 0.02) {
          effectiveBgLum = pLum;
          break;
        }
      }
      parent = parent.parentElement;
    }

    const ratio = contrastRatio(fgLum, effectiveBgLum);

    // Require at least 4.5:1 contrast (WCAG AA)
    if (ratio < 4.5) {
      if (effectiveBgLum < 0.5) {
        el.style.setProperty('color', '#d0d0d0', 'important');
      } else {
        el.style.setProperty('color', '#1a1a1a', 'important');
      }
    }
  }

  // Pass 3: catch any remaining dark-on-dark from the page's own stylesheets
  // by also checking border-color and outline-color won't matter, but
  // ensure no element is darker than #444 on our dark background
  for (const el of all) {
    if (!el.textContent?.trim()) continue;
    const fg = parseColor(getComputedStyle(el).color);
    if (!fg) continue;
    const fgLum = luminance(fg.r, fg.g, fg.b);
    // If text is just plain dark (below ~#555), force it light
    if (fgLum < 0.1) {
      el.style.setProperty('color', '#d0d0d0', 'important');
    }
  }
}

// ---- Metadata extraction ----

function extractMetadata() {
  const metadata = {};

  const ogTitle = document.querySelector('meta[property="og:title"]');
  const h1 = document.querySelector('h1');
  metadata.title = ogTitle?.content || h1?.textContent?.trim() || document.title;

  const authorMeta = document.querySelector('meta[name="author"]');
  const authorLink = document.querySelector('[rel="author"], .author, .byline, [class*="author"]');
  metadata.author = authorMeta?.content || authorLink?.textContent?.trim() || null;

  const timeMeta = document.querySelector('meta[property="article:published_time"]');
  const timeEl = document.querySelector('time[datetime]');
  const dateStr = timeMeta?.content || timeEl?.getAttribute('datetime');
  if (dateStr) {
    try {
      metadata.date = new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch {}
  }

  const siteName = document.querySelector('meta[property="og:site_name"]');
  metadata.siteName = siteName?.content || location.hostname;

  return metadata;
}

// ---- Rendering ----

function renderCleanLayout(content) {
  const { article, metadata } = content;

  // Wipe page structure but keep stylesheets so original formatting survives
  document.body.innerHTML = '';
  document.body.className = '';
  document.body.removeAttribute('style');
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');

  const root = document.createElement('div');
  root.id = 'clarity-reader-root';

  // Header
  const header = document.createElement('header');
  header.className = 'clarity-reader-header';

  if (metadata.siteName) {
    const site = document.createElement('div');
    site.className = 'clarity-reader-site';
    site.textContent = metadata.siteName;
    header.appendChild(site);
  }

  const title = document.createElement('h1');
  title.className = 'clarity-reader-title';
  title.textContent = metadata.title;
  header.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'clarity-reader-meta';
  const parts = [];
  if (metadata.author) parts.push(metadata.author);
  if (metadata.date) parts.push(metadata.date);
  if (metadata.readingTime) parts.push(`${metadata.readingTime} min read`);
  meta.textContent = parts.join('  \u00b7  ');
  header.appendChild(meta);

  root.appendChild(header);

  // Article
  const articleEl = document.createElement('article');
  articleEl.className = 'clarity-reader-content';
  articleEl.innerHTML = article.innerHTML;
  root.appendChild(articleEl);

  // Footer
  const footer = document.createElement('footer');
  footer.className = 'clarity-reader-footer';
  footer.innerHTML = `<a href="${location.href}">View original</a>`;
  root.appendChild(footer);

  document.body.appendChild(root);
  window.scrollTo(0, 0);

  // Fix any bad color combos now that everything is in the DOM
  fixContrast(articleEl);
}

function renderError() {
  document.body.innerHTML = '';
  document.body.className = '';
  const root = document.createElement('div');
  root.id = 'clarity-reader-root';
  root.innerHTML = `
    <div class="clarity-reader-error">
      <h2>No article found</h2>
      <p>Clarity couldn't extract readable content from this page.</p>
    </div>
  `;
  document.body.appendChild(root);
}
