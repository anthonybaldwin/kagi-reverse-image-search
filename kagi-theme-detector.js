'use strict';

/**
 * Runs on kagi.com and remembers whether the user's Kagi theme is light or
 * dark, so the extension's own pages can match it.
 */
(() => {
  let lastTheme = null;
  let timer = null;

  /**
   * Detect if a CSS color string is dark based on luminance
   */
  function isDarkColor(colorString) {
    if (!colorString || typeof colorString !== 'string') return null;

    const match = colorString.match(/[\d.]+/g);
    if (!match || match.length < 3) return null;

    const [r, g, b] = match.map(Number);
    const alpha = match.length >= 4 ? Number(match[3]) : 1;
    if (alpha === 0) return null; // transparent - no information

    // Perceived luminance (ITU-R BT.601)
    const luminance = (r * 299 + g * 587 + b * 114) / 1000;
    return luminance < 128;
  }

  function classesSuggest(element, word) {
    if (!element) return false;
    const className = typeof element.className === 'string' ? element.className : '';
    return new RegExp(`(^|[\\s_-])${word}($|[\\s_-])`, 'i').test(className) ||
      (element.dataset && Object.values(element.dataset).some((v) => String(v).toLowerCase() === word));
  }

  function detectTheme() {
    const html = document.documentElement;
    const body = document.body;

    // 1. Explicit theme hints in class names / data attributes
    if (classesSuggest(html, 'dark') || classesSuggest(body, 'dark')) return 'dark';
    if (classesSuggest(html, 'light') || classesSuggest(body, 'light')) return 'light';

    // 2. Computed background colour of body, then html
    for (const element of [body, html]) {
      if (!element) continue;
      const dark = isDarkColor(getComputedStyle(element).backgroundColor);
      if (dark !== null) return dark ? 'dark' : 'light';
    }

    // 3. Whatever the page declares via color-scheme, else the OS preference
    const scheme = html ? getComputedStyle(html).colorScheme : '';
    if (scheme === 'dark') return 'dark';
    if (scheme === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function storeTheme() {
    try {
      const theme = detectTheme();
      if (theme === lastTheme) return;
      lastTheme = theme;
      chrome.storage.sync.set({ kagiTheme: theme });
    } catch (_) {
      // Extension context may have been invalidated - nothing to do
    }
  }

  function scheduleStore() {
    clearTimeout(timer);
    timer = setTimeout(storeTheme, 250);
  }

  function start() {
    storeTheme();

    // Kagi lets users switch themes without a reload - follow class changes
    try {
      const observer = new MutationObserver(scheduleStore);
      const options = { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] };
      observer.observe(document.documentElement, options);
      if (document.body) observer.observe(document.body, options);
    } catch (_) {
      // Observation is best-effort
    }
  }

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }
})();
