'use strict';

(() => {
  // Prevent duplicate injection (the background script may inject us on demand)
  if (window.__kagiReverseImageSearchLoaded) return;
  window.__kagiReverseImageSearchLoaded = true;

  // Constants
  const MIN_SELECTION_SIZE = 10;
  const TOAST_DURATION_MS = 3200;
  const TOAST_FADE_MS = 250;
  const HOST_TAG = 'kagi-reverse-image-search';

  // Events the page must not see while selection mode is active
  const SWALLOWED_EVENTS = ['click', 'dblclick', 'auxclick', 'contextmenu', 'selectstart', 'dragstart'];

  const state = {
    active: false,
    dragging: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0
  };

  // UI elements (created lazily, live inside a shadow root so page CSS can't touch them)
  const ui = {
    host: null,
    root: null,
    overlay: null,
    guideX: null,
    guideY: null,
    box: null,
    badge: null,
    hint: null,
    toast: null,
    toastTimer: null,
    toastHideTimer: null
  };

  const STYLES = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      color: #fff;
      --kagi-yellow: #FFC700;
      --dim: rgba(10, 10, 12, 0.42);
    }
    :host([hidden]) { display: none !important; }

    .overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      cursor: crosshair;
      background: var(--dim);
      opacity: 0;
      transition: opacity 160ms ease, background-color 120ms ease;
      box-shadow: inset 0 0 0 0 var(--kagi-yellow);
    }
    :host(.active) .overlay {
      pointer-events: auto;
      opacity: 1;
      animation: kagi-pulse 520ms ease-out;
    }
    :host(.dragging) .overlay {
      background: transparent;
    }
    @keyframes kagi-pulse {
      0%   { box-shadow: inset 0 0 0 0 rgba(255, 199, 0, 0); }
      35%  { box-shadow: inset 0 0 0 4px rgba(255, 199, 0, 0.9); }
      100% { box-shadow: inset 0 0 0 0 rgba(255, 199, 0, 0); }
    }

    /* Crosshair guide lines that follow the pointer before a drag starts */
    .guide {
      position: absolute;
      display: none;
      background: rgba(255, 199, 0, 0.55);
      pointer-events: none;
    }
    .guide-x { left: 0; right: 0; height: 1px; }
    .guide-y { top: 0; bottom: 0; width: 1px; }
    :host(.active.pointer:not(.dragging)) .guide { display: block; }

    /* Selection box. The huge box-shadow dims everything outside of it. */
    .box {
      position: absolute;
      display: none;
      box-sizing: border-box;
      border-radius: 6px;
      pointer-events: none;
      box-shadow: 0 0 0 1px rgba(255, 199, 0, 0.9), 0 0 0 100vmax var(--dim);
    }
    :host(.dragging) .box { display: block; }

    .corner {
      position: absolute;
      width: 18px;
      height: 18px;
      border: 3px solid var(--kagi-yellow);
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
    }
    .corner.tl { top: -3px; left: -3px; border-right: 0; border-bottom: 0; border-top-left-radius: 8px; }
    .corner.tr { top: -3px; right: -3px; border-left: 0; border-bottom: 0; border-top-right-radius: 8px; }
    .corner.bl { bottom: -3px; left: -3px; border-right: 0; border-top: 0; border-bottom-left-radius: 8px; }
    .corner.br { bottom: -3px; right: -3px; border-left: 0; border-top: 0; border-bottom-right-radius: 8px; }

    /* Size badge */
    .badge {
      position: absolute;
      left: 0;
      top: calc(100% + 8px);
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(20, 20, 22, 0.92);
      color: #fff;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    }
    .badge.above { top: auto; bottom: calc(100% + 8px); }
    .badge.too-small { background: rgba(185, 28, 28, 0.95); }

    /* Hint pill at the top of the viewport */
    .hint {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translate(-50%, -24px);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 16px 9px 12px;
      border-radius: 999px;
      background: rgba(20, 20, 22, 0.92);
      color: #fff;
      font-weight: 500;
      white-space: nowrap;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08);
      opacity: 0;
      transition: opacity 180ms ease, transform 180ms ease;
    }
    :host(.active) .hint { opacity: 1; transform: translate(-50%, 0); }
    :host(.dragging) .hint { opacity: 0; transform: translate(-50%, -24px); }
    .hint svg { width: 18px; height: 18px; flex: none; }
    .hint kbd {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.2);
      font: 600 11px/1.5 inherit;
      font-family: inherit;
    }
    .hint .sep { opacity: 0.4; }

    /* Toast */
    .toast {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translate(-50%, 16px);
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: min(90vw, 480px);
      padding: 12px 18px 12px 14px;
      border-radius: 12px;
      background: rgba(20, 20, 22, 0.94);
      color: #fff;
      font-weight: 500;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08);
      opacity: 0;
      transition: opacity ${TOAST_FADE_MS}ms ease, transform ${TOAST_FADE_MS}ms ease;
    }
    .toast.show { opacity: 1; transform: translate(-50%, 0); }
    .toast svg { width: 18px; height: 18px; flex: none; }
    .toast.info svg { color: var(--kagi-yellow); }
    .toast.error svg { color: #f87171; }

    @media (prefers-reduced-motion: reduce) {
      .overlay, .hint, .toast { transition: none; animation: none; }
    }
  `;

  const ICON_KAGI = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" stroke="#FFC700" stroke-width="2"/><path d="M8 8v8M8 12l5-4M8 12l5 4" stroke="#FFC700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_INFO = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const ICON_ERROR = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

  /**
   * Messages from the background script
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message && message.action) {
        case 'toggleSelectionMode':
          if (state.active) {
            deactivate();
            showToast('Selection cancelled.', 'info');
          } else {
            activate();
          }
          sendResponse({ success: true, active: state.active });
          break;

        case 'getSelectionModeStatus':
          sendResponse({ isSelectionMode: state.active });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Kagi Reverse Image Search:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  });

  /* ------------------------------------------------------------------ */
  /* Selection mode                                                     */
  /* ------------------------------------------------------------------ */

  function activate() {
    if (state.active) return;
    state.active = true;
    state.dragging = false;

    mount();
    ui.host.hidden = false;
    ui.host.classList.remove('pointer', 'dragging');
    // Force a reflow so the fade-in transition runs even if we were just mounted
    void ui.host.offsetWidth;
    ui.host.classList.add('active');

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onWindowBlur);
    SWALLOWED_EVENTS.forEach((type) => document.addEventListener(type, swallowEvent, true));
  }

  function deactivate() {
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('blur', onWindowBlur);
    SWALLOWED_EVENTS.forEach((type) => document.removeEventListener(type, swallowEvent, true));

    state.active = false;
    state.dragging = false;

    if (ui.host) {
      ui.host.classList.remove('active', 'dragging', 'pointer');
      ui.host.hidden = false;
    }
    unmountIfIdle();
  }

  /* ------------------------------------------------------------------ */
  /* Event handlers                                                     */
  /* ------------------------------------------------------------------ */

  function swallowEvent(event) {
    if (!state.active) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onKeyDown(event) {
    if (!state.active || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    deactivate();
    showToast('Selection cancelled.', 'info');
  }

  function onWindowBlur() {
    // Losing focus mid-drag means we will never get the mouseup; reset the drag.
    if (state.dragging) {
      state.dragging = false;
      ui.host.classList.remove('dragging');
    }
  }

  function onMouseDown(event) {
    if (!state.active) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) return;

    state.dragging = true;
    state.startX = state.endX = clampX(event.clientX);
    state.startY = state.endY = clampY(event.clientY);

    ui.host.classList.add('dragging');
    updateSelectionBox();
  }

  function onMouseMove(event) {
    if (!state.active) return;
    event.stopPropagation();

    if (!state.dragging) {
      updateGuides(event.clientX, event.clientY);
      return;
    }

    event.preventDefault();
    state.endX = clampX(event.clientX);
    state.endY = clampY(event.clientY);
    updateSelectionBox();
  }

  function onMouseUp(event) {
    if (!state.active) return;
    event.preventDefault();
    event.stopPropagation();
    if (!state.dragging || event.button !== 0) return;

    state.dragging = false;
    state.endX = clampX(event.clientX);
    state.endY = clampY(event.clientY);

    const rect = selectionRect();
    ui.host.classList.remove('dragging');

    if (rect.width < MIN_SELECTION_SIZE || rect.height < MIN_SELECTION_SIZE) {
      updateGuides(event.clientX, event.clientY);
      showToast('Selection too small. Drag out a larger area.', 'info');
      return;
    }

    capture(rect);
  }

  /* ------------------------------------------------------------------ */
  /* Geometry                                                           */
  /* ------------------------------------------------------------------ */

  function clampX(x) {
    return Math.min(Math.max(x, 0), window.innerWidth);
  }

  function clampY(y) {
    return Math.min(Math.max(y, 0), window.innerHeight);
  }

  function selectionRect() {
    const x = Math.min(state.startX, state.endX);
    const y = Math.min(state.startY, state.endY);
    return {
      x,
      y,
      width: Math.abs(state.endX - state.startX),
      height: Math.abs(state.endY - state.startY)
    };
  }

  function updateGuides(x, y) {
    ui.host.classList.add('pointer');
    ui.guideX.style.top = clampY(y) + 'px';
    ui.guideY.style.left = clampX(x) + 'px';
  }

  function updateSelectionBox() {
    const rect = selectionRect();
    ui.box.style.left = rect.x + 'px';
    ui.box.style.top = rect.y + 'px';
    ui.box.style.width = rect.width + 'px';
    ui.box.style.height = rect.height + 'px';

    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    ui.badge.textContent = `${width} × ${height}`;
    ui.badge.classList.toggle('too-small', width < MIN_SELECTION_SIZE || height < MIN_SELECTION_SIZE);
    // Keep the badge on screen when the selection reaches the bottom edge
    ui.badge.classList.toggle('above', rect.y + rect.height + 36 > window.innerHeight);
  }

  /* ------------------------------------------------------------------ */
  /* Capture                                                            */
  /* ------------------------------------------------------------------ */

  function capture(rect) {
    const area = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1
    };

    // Hide every piece of our UI and wait for the browser to paint before
    // asking the background script to take the screenshot.
    hideToast();
    ui.host.hidden = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          chrome.runtime.sendMessage({ action: 'captureSelectedArea', area, viewport }, (response) => {
            deactivate();

            if (chrome.runtime.lastError) {
              console.error('Kagi Reverse Image Search:', chrome.runtime.lastError.message);
              showToast('Connection lost. Refresh the page and try again.', 'error');
              return;
            }

            if (response && !response.success) {
              showToast(response.error || 'Something went wrong. Please try again.', 'error');
            }
          });
        } catch (error) {
          // Extension was reloaded/updated underneath us
          console.error('Kagi Reverse Image Search:', error);
          deactivate();
          showToast('Extension was updated. Refresh the page and try again.', 'error');
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                 */
  /* ------------------------------------------------------------------ */

  function mount() {
    if (ui.host && ui.host.isConnected) return;

    if (!ui.host) {
      ui.host = document.createElement(HOST_TAG);
      ui.root = ui.host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = STYLES;

      ui.overlay = el('div', 'overlay');
      ui.guideX = el('div', 'guide guide-x');
      ui.guideY = el('div', 'guide guide-y');

      ui.box = el('div', 'box');
      ['tl', 'tr', 'bl', 'br'].forEach((corner) => ui.box.appendChild(el('span', 'corner ' + corner)));
      ui.badge = el('div', 'badge');
      ui.box.appendChild(ui.badge);

      ui.hint = el('div', 'hint');
      ui.hint.innerHTML = `${ICON_KAGI}<span>Drag to select an area</span><span class="sep">·</span><span><kbd>Esc</kbd> to cancel</span>`;

      ui.toast = el('div', 'toast');

      ui.root.append(style, ui.overlay, ui.guideX, ui.guideY, ui.box, ui.hint, ui.toast);
    }

    (document.documentElement || document.body).appendChild(ui.host);
  }

  function unmountIfIdle() {
    if (!ui.host || state.active || ui.toast.classList.contains('show')) return;
    ui.host.remove();
  }

  function el(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }

  function showToast(message, kind = 'info') {
    mount();
    ui.host.hidden = false;

    clearTimeout(ui.toastTimer);
    clearTimeout(ui.toastHideTimer);

    ui.toast.className = 'toast ' + kind;
    ui.toast.innerHTML = kind === 'error' ? ICON_ERROR : ICON_INFO;
    ui.toast.appendChild(document.createTextNode(message));
    void ui.toast.offsetWidth;
    ui.toast.classList.add('show');

    ui.toastTimer = setTimeout(hideToast, TOAST_DURATION_MS);
  }

  function hideToast() {
    if (!ui.toast) return;
    clearTimeout(ui.toastTimer);
    clearTimeout(ui.toastHideTimer);
    ui.toast.classList.remove('show');
    ui.toastHideTimer = setTimeout(unmountIfIdle, TOAST_FADE_MS);
  }
})();
