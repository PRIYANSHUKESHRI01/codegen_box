/*
 * AptRun Project Lab — authorship guard.
 *
 * Loaded by the VS Code web client BEFORE it starts (see infra/workspaces/Dockerfile) so that students
 * write their own code: text can be pasted only if it was copied from INSIDE the workspace (editor or
 * terminal) or is a command from a bash block of the SOW. Everything else is refused with a notice.
 * Searching the web, switching windows and reading documentation are not touched.
 *
 * Doors guarded: the `paste` event, `beforeinput`, `navigator.clipboard.read*` (the terminal's and the
 * context menu's Paste), drag-and-drop of text and files, file pickers, synthetic (script-made) events,
 * and extra editor windows (a second document would not have this guard).
 *
 * It keeps NO copy of what is copied or typed: the registry holds fingerprints (hash + length) and the
 * events it reports carry only kind, size, target and time. Perfect prevention is impossible in a
 * browser the student controls, so a second job is to leave evidence: a guard that stops answering, or a
 * burst of typing no human produces, is reported to the dashboard (and from there to the reviewer).
 *
 * Plain script, no dependencies, never throws into VS Code. In a test it is `require`d and driven through
 * createGuard(); in the browser it installs itself on `window` and talks to the dashboard page that embeds
 * the editor with postMessage:
 *   guard  -> page : { aptrun: 'guard', type: 'hello' | 'alive' | 'events', ... }
 *   page   -> guard: { aptrun: 'guard-policy', mode: 'enforce' | 'report' | 'open', trusted: [string] }
 * Until a policy arrives (or when the editor is opened outside the dashboard) it ENFORCES.
 */
(function (root, factory) {
  var api = factory();

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }

  if (root && !root.__APTRUN_GUARD_NO_AUTOSTART__ && typeof root.document !== 'undefined') {
    try {
      api.install(root);
    } catch (e) {
      /* the editor must never be broken by its guard */
    }
  }
})(typeof window !== 'undefined' ? window : undefined, function () {
  'use strict';

  var VERSION = '1.0.0';

  var STORE_KEY = 'aptrun.guard.copied.v1';
  var MAX_REGISTRY = 40;
  var MAX_TRUSTED_CHARS = 200000;

  /** Non-IME text insertions at least this long cannot be typing (a console `insertText`, dictation, an expander). */
  var BULK_BLOCK = 40;
  var BULK_FLAG = 8;

  /** Human typing tops out near 15 characters a second; this many in two seconds is not a person. */
  var FAST_KEYS_IN_2S = 70;
  var ROBOTIC_SAMPLES = 40;
  var ROBOTIC_MAX_MEAN_MS = 150;
  var ROBOTIC_MAX_SD_MS = 4;

  var ALIVE_EVERY_MS = 20000;
  var HELLO_EVERY_MS = 2000;
  var HELLO_TRIES = 30;
  var NOTICE_MS = 7000;
  var NOTICE_GAP_MS = 2500;
  var DRAG_SAFETY_MS = 30000;

  /** Binary assets a student may add (a logo, a font): they cannot carry source code. */
  var ASSET_EXTENSIONS = [
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'icns', 'tif', 'tiff',
    'woff', 'woff2', 'ttf', 'otf', 'eot',
    'mp3', 'wav', 'ogg', 'm4a', 'flac', 'mp4', 'webm', 'mov', 'mkv',
    'pdf',
  ];

  var NOTICES = {
    paste: ['Pasting from outside is turned off', 'This project asks you to write the code yourself, so type it instead. You can still copy and paste anything from inside your workspace.'],
    drop: ['Dropping content from outside is turned off', 'Type it yourself. You can still drag files and text around inside your workspace.'],
    upload: ['That file can’t be added', 'Images, fonts, audio, video and PDFs can be added. Source code and archives must be written in the editor.'],
    window: ['Extra editor windows are turned off', 'Keep working in this window. Use the split editor to see two files side by side.'],
  };

  // ───────────────────────────── pure helpers (unit-tested) ─────────────────────────────

  /** One line-ending convention, so Windows (CRLF) and editor (LF) copies of the same text match. */
  function normalize(text) {
    return String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  }

  /**
   * A fingerprint of a text: three independent 32-bit hashes plus its length. The registry stores this, never
   * the text. Collisions are not a practical concern for a student, and the in-page text is never exposed.
   */
  function fingerprint(text) {
    var s = normalize(text);
    var h1 = 0xdeadbeef;
    var h2 = 0x41c6ce57;
    var f = 0x811c9dc5;

    for (var i = 0; i < s.length; i++) {
      var ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
      f = Math.imul(f ^ ch, 16777619);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return (h2 >>> 0).toString(36) + '.' + (h1 >>> 0).toString(36) + '.' + (f >>> 0).toString(36) + '.' + s.length;
  }

  function extensionOf(name) {
    var n = String(name || '');
    var dot = n.lastIndexOf('.');

    return dot > 0 && dot < n.length - 1 ? n.slice(dot + 1).toLowerCase() : '';
  }

  /** `{ ok, bad }`: ok only if EVERY file is a binary asset; a folder (no extension) is never ok. */
  function classifyFiles(files) {
    var bad = [];
    var total = 0;

    for (var i = 0; i < (files ? files.length : 0); i++) {
      var f = files[i];
      total += f && f.size ? f.size : 0;

      if (ASSET_EXTENSIONS.indexOf(extensionOf(f && f.name)) === -1) {
        bad.push(extensionOf(f && f.name) || 'folder');
      }
    }

    return { ok: bad.length === 0 && (files ? files.length : 0) > 0, bad: bad, size: total, count: files ? files.length : 0 };
  }

  /** A registry of what was copied inside the workspace, shared by tabs of the same workspace through localStorage. */
  function createRegistry(storage) {
    var memory = [];

    function load() {
      if (!storage) return memory;
      try {
        var raw = storage.getItem(STORE_KEY);
        var parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) memory = parsed.filter(function (x) { return typeof x === 'string'; });
      } catch (e) {
        /* corrupt or blocked storage: keep what this tab has seen */
      }
      return memory;
    }

    function save() {
      if (!storage) return;
      try {
        storage.setItem(STORE_KEY, JSON.stringify(memory));
      } catch (e) {
        /* private mode / quota: this tab still has its own memory */
      }
    }

    return {
      add: function (text) {
        var t = normalize(text);
        if (t === '') return null;
        var fp = fingerprint(t);
        load();
        memory = memory.filter(function (x) { return x !== fp; });
        memory.push(fp);
        if (memory.length > MAX_REGISTRY) memory = memory.slice(memory.length - MAX_REGISTRY);
        save();
        return fp;
      },
      has: function (text) {
        var t = normalize(text);
        if (t === '') return false;
        return load().indexOf(fingerprint(t)) !== -1;
      },
      size: function () { return load().length; },
    };
  }

  /**
   * Is `text` a piece of one of the SOW's bash command blocks? Any substring qualifies, so a student can
   * select one line of a block instead of the whole block.
   */
  function isTrustedSnippet(text, blocks) {
    var t = normalize(text).replace(/^\n+|\n+$/g, '');
    if (t.length < 2) return false;

    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].indexOf(t) !== -1) return true;
    }

    return false;
  }

  /** Characters typed in a row faster than any person, or at metronome-regular intervals. */
  function createTypingWatch(emit, clock) {
    var recent = [];
    var intervals = [];
    var last = 0;
    var lastFast = -Infinity;
    var lastRobotic = -Infinity;

    return function onKey(isCharacter) {
      if (!isCharacter) return;
      var t = clock();

      recent.push(t);
      while (recent.length && t - recent[0] > 2000) recent.shift();

      if (last) {
        intervals.push(t - last);
        if (intervals.length > ROBOTIC_SAMPLES) intervals.shift();
      }
      last = t;

      if (recent.length >= FAST_KEYS_IN_2S && t - lastFast > 30000) {
        lastFast = t;
        emit('fast_typing', { size: recent.length, meta: { perSecond: Math.round(recent.length / 2) } });
      }

      if (intervals.length >= ROBOTIC_SAMPLES && t - lastRobotic > 60000) {
        var mean = 0;
        for (var i = 0; i < intervals.length; i++) mean += intervals[i];
        mean /= intervals.length;
        var variance = 0;
        for (var j = 0; j < intervals.length; j++) variance += (intervals[j] - mean) * (intervals[j] - mean);
        var sd = Math.sqrt(variance / intervals.length);

        if (mean < ROBOTIC_MAX_MEAN_MS && sd < ROBOTIC_MAX_SD_MS) {
          lastRobotic = t;
          emit('robotic_typing', { size: intervals.length, meta: { meanMs: Math.round(mean * 10) / 10, sdMs: Math.round(sd * 10) / 10 } });
        }
      }
    };
  }

  // ───────────────────────────── the guard ─────────────────────────────

  /**
   * @param {Window} win
   * @param {{ now?: function(): number, trustAllEvents?: boolean, setTimeout?: function, parent?: object }} [options]
   *   trustAllEvents and parent are for tests only: real synthetic (script-made) events are refused, and the
   *   real embedding page is win.parent.
   */
  function createGuard(win, options) {
    options = options || {};

    var clock = options.now || function () { return Date.now(); };
    var trustAll = options.trustAllEvents === true;
    var later = options.setTimeout || function (fn, ms) { return win.setTimeout(fn, ms); };

    var storage = null;
    try {
      storage = win.localStorage || null;
    } catch (e) {
      storage = null;
    }

    var registry = createRegistry(storage);
    var policy = { mode: 'enforce', trusted: [], received: false };
    var counts = {};
    var queue = [];
    var internalDrag = false;
    var dragTimer = null;
    var lastAllowedAt = -Infinity;
    var lastNoticeAt = -Infinity;
    var noticeHost = null;
    var noticeTimer = null;
    var recordedThisEvent = false;
    var copyWindowOpen = false;
    var flushScheduled = false;

    function inert() {
      return policy.mode === 'open';
    }

    function enforcing() {
      return policy.mode === 'enforce';
    }

    function uid() {
      return Math.random().toString(36).slice(2, 10) + clock().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    /** The page that embeds the editor, or null when the editor is open on its own. */
    function parentWin() {
      var p = options.parent !== undefined ? options.parent : win.parent;
      return p && p !== win ? p : null;
    }

    function post(message) {
      try {
        var p = parentWin();
        if (p) p.postMessage(message, '*');
      } catch (e) {
        /* no embedding page: nothing to tell */
      }
    }

    function emit(kind, data) {
      data = data || {};
      counts[kind] = (counts[kind] || 0) + 1;

      var event = { id: uid(), t: clock(), kind: kind, size: data.size == null ? null : data.size, target: data.target || null };
      if (data.meta) event.meta = data.meta;
      if (policy.mode === 'report' && (kind.indexOf('_blocked') !== -1)) event.meta = Object.assign({}, event.meta, { reportOnly: true });

      queue.push(event);
      if (queue.length > 200) queue.shift();

      // Small batches go out almost immediately (one timer however many events); the pulse also flushes.
      if (!flushScheduled) {
        flushScheduled = true;
        later(function () { flushScheduled = false; flush(); }, 250);
      }
    }

    function flush() {
      if (!queue.length) return;
      var batch = queue.splice(0, queue.length);
      post({ aptrun: 'guard', type: 'events', v: VERSION, events: batch });
    }

    // ── notice shown to the student ──
    function notify(kind) {
      var now = clock();
      if (now - lastNoticeAt < NOTICE_GAP_MS) return;
      lastNoticeAt = now;

      try {
        var doc = win.document;
        if (!doc || !(doc.body || doc.documentElement)) return;

        if (!noticeHost) {
          noticeHost = doc.createElement('div');
          noticeHost.setAttribute('data-aptrun-guard-notice', '');
          noticeHost.style.cssText = 'position:fixed;right:20px;bottom:44px;z-index:2147483000;pointer-events:none;';
          (doc.body || doc.documentElement).appendChild(noticeHost);
          var shadow = noticeHost.attachShadow ? noticeHost.attachShadow({ mode: 'closed' }) : noticeHost;
          var card = doc.createElement('div');
          card.setAttribute('role', 'status');
          card.setAttribute('aria-live', 'polite');
          card.style.cssText =
            'max-width:340px;padding:12px 14px;border-radius:8px;background:#1f2430;color:#f3f4f8;border:1px solid #4a5170;' +
            'box-shadow:0 8px 24px rgba(0,0,0,.35);font:13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;opacity:0;transition:opacity .15s;';
          var title = doc.createElement('div');
          title.style.cssText = 'font-weight:700;margin-bottom:3px;';
          var body = doc.createElement('div');
          body.style.cssText = 'color:#c9cde0;';
          card.appendChild(title);
          card.appendChild(body);
          shadow.appendChild(card);
          noticeHost._card = card;
          noticeHost._title = title;
          noticeHost._body = body;
        }

        var text = NOTICES[kind] || NOTICES.paste;
        noticeHost._title.textContent = text[0];
        noticeHost._body.textContent = text[1];
        noticeHost._card.style.opacity = '1';

        if (noticeTimer) win.clearTimeout(noticeTimer);
        noticeTimer = win.setTimeout(function () {
          if (noticeHost) noticeHost._card.style.opacity = '0';
        }, NOTICE_MS);
      } catch (e) {
        /* a failed notice must not change the verdict */
      }
    }

    function targetOf(e) {
      try {
        var el = e && e.target && e.target.nodeType === 1 ? e.target : e && e.target && e.target.parentElement;
        if (!el || !el.closest) return 'other';
        if (el.closest('.xterm, .terminal-wrapper')) return 'terminal';
        if (el.closest('.monaco-editor')) return 'editor';
        var tag = (el.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return 'input';
      } catch (err) {
        /* fall through */
      }
      return 'other';
    }

    function refuseEvent(e) {
      try { e.preventDefault(); } catch (err) { /* ignore */ }
      try { e.stopImmediatePropagation(); } catch (err) { /* ignore */ }
      try { e.stopPropagation(); } catch (err) { /* ignore */ }
    }

    function textAllowed(text) {
      return registry.has(text) || isTrustedSnippet(text, policy.trusted);
    }

    function isTrustedEvent(e) {
      return trustAll || e.isTrusted !== false;
    }

    // ── copy tracking: what the workbench puts on the clipboard is "from inside" ──
    function remember(text) {
      if (typeof text !== 'string' || text === '') return;
      registry.add(text);
      recordedThisEvent = true;
    }

    function onCopyLike(e) {
      copyWindowOpen = true;
      recordedThisEvent = false;
      if (e.type === 'dragstart') {
        internalDrag = true;
        if (dragTimer) win.clearTimeout(dragTimer);
        dragTimer = win.setTimeout(function () { internalDrag = false; }, DRAG_SAFETY_MS);
      }

      // Handlers run synchronously inside this event; afterwards, if nothing wrote text/plain, fall back to
      // what is selected (a native copy from an input or a read-only part of the page).
      later(function () {
        copyWindowOpen = false;
        if (recordedThisEvent || e.type === 'dragstart') return;
        try {
          var el = e.target;
          var picked = '';
          if (el && typeof el.selectionStart === 'number' && typeof el.value === 'string') {
            picked = el.value.substring(el.selectionStart, el.selectionEnd);
          }
          if (!picked && win.getSelection) picked = String(win.getSelection());
          if (picked) registry.add(picked);
        } catch (err) {
          /* ignore */
        }
      }, 0);
    }

    function onDragEnd() {
      internalDrag = false;
    }

    // ── paste ──
    function onPaste(e) {
      if (inert()) return;
      var cd = e.clipboardData;
      var target = targetOf(e);

      if (!isTrustedEvent(e)) {
        emit('synthetic_blocked', { size: 0, target: target });
        if (enforcing()) { refuseEvent(e); notify('paste'); }
        return;
      }

      var text = '';
      try { text = cd ? cd.getData('text/plain') || '' : ''; } catch (err) { text = ''; }
      var files = cd && cd.files ? cd.files : [];

      if (files.length > 0) {
        var verdict = classifyFiles(files);
        if (verdict.ok) { emit('drop_asset', { size: verdict.size, target: target, meta: { count: verdict.count } }); lastAllowedAt = clock(); return; }
        emit('upload_blocked', { size: verdict.size, target: target, meta: { kinds: verdict.bad.slice(0, 5) } });
        if (enforcing()) { refuseEvent(e); notify('upload'); }
        return;
      }

      if (text === '') {
        // Something with no plain text (only HTML, say): treat as outside content; empty clipboard is a no-op.
        var types = cd && cd.types ? Array.prototype.slice.call(cd.types) : [];
        if (types.indexOf('text/html') === -1) return;
        emit('paste_blocked', { size: 0, target: target });
        if (enforcing()) { refuseEvent(e); notify('paste'); }
        return;
      }

      if (registry.has(text)) {
        lastAllowedAt = clock();
        emit('paste_internal', { size: text.length, target: target });
        return;
      }

      if (isTrustedSnippet(text, policy.trusted)) {
        lastAllowedAt = clock();
        emit('paste_trusted', { size: text.length, target: target });
        return;
      }

      emit('paste_blocked', { size: text.length, target: target });
      if (enforcing()) { refuseEvent(e); notify('paste'); }
    }

    function onBeforeInput(e) {
      if (inert()) return;
      var type = e.inputType || '';
      var target = targetOf(e);

      if (/^insertFrom(Paste|Drop|Yank|PasteAsQuotation)$/.test(type)) {
        // A paste/drop event normally ran first and judged it; this is only reached unjudged by a script.
        if (clock() - lastAllowedAt < 300) return;
        var text = '';
        try { text = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || e.data || ''; } catch (err) { text = e.data || ''; }
        if (text && textAllowed(text)) return;
        emit('paste_blocked', { size: text.length, target: target });
        if (enforcing()) { refuseEvent(e); notify('paste'); }
        return;
      }

      if ((type === 'insertText' || type === 'insertReplacementText') && !e.isComposing && typeof e.data === 'string') {
        if (e.data.length >= BULK_BLOCK) {
          emit('bulk_insert_blocked', { size: e.data.length, target: target });
          if (enforcing()) { refuseEvent(e); notify('paste'); }
        } else if (e.data.length >= BULK_FLAG) {
          emit('bulk_insert', { size: e.data.length, target: target });
        }
      }
    }

    // ── drag and drop ──
    function onDragOver(e) {
      if (inert() || internalDrag || !enforcing()) return;
      var dt = e.dataTransfer;
      var types = dt && dt.types ? Array.prototype.slice.call(dt.types) : [];
      if (types.indexOf('Files') !== -1) return; // judged on drop, when the file names are readable
      if (types.indexOf('text/plain') === -1 && types.indexOf('text/html') === -1 && types.indexOf('text/uri-list') === -1) return;
      try { dt.dropEffect = 'none'; } catch (err) { /* ignore */ }
      e.stopImmediatePropagation();
    }

    function onDrop(e) {
      if (inert()) return;
      var dt = e.dataTransfer;
      if (!dt) return;
      var target = targetOf(e);

      var untrusted = !isTrustedEvent(e);
      if (!untrusted && internalDrag) { internalDrag = false; return; }

      if (untrusted) {
        emit('synthetic_blocked', { size: 0, target: target });
        if (enforcing()) { refuseEvent(e); notify('drop'); }
        return;
      }

      var files = dt.files || [];
      if (files.length > 0) {
        var verdict = classifyFiles(files);
        if (verdict.ok) { emit('drop_asset', { size: verdict.size, target: target, meta: { count: verdict.count } }); return; }
        emit('drop_blocked', { size: verdict.size, target: 'files', meta: { kinds: verdict.bad.slice(0, 5) } });
        if (enforcing()) { refuseEvent(e); notify('upload'); }
        return;
      }

      var text = '';
      try { text = dt.getData('text/plain') || ''; } catch (err) { text = ''; }
      if (text && textAllowed(text)) return;

      emit('drop_blocked', { size: text.length, target: target });
      if (enforcing()) { refuseEvent(e); notify('drop'); }
    }

    // ── file inputs ("Upload…") ──
    function onChange(e) {
      if (inert()) return;
      var el = e.target;
      if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return;

      var verdict = classifyFiles(el.files);
      if (verdict.ok || !el.files || el.files.length === 0) return;

      emit('upload_blocked', { size: verdict.size, target: 'file-input', meta: { kinds: verdict.bad.slice(0, 5) } });
      if (enforcing()) {
        try { el.value = ''; } catch (err) { /* ignore */ }
        refuseEvent(e);
        notify('upload');
      }
    }

    // ── typing ──
    var watch = createTypingWatch(emit, clock);

    function onKeyDown(e) {
      if (inert() || !isTrustedEvent(e)) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      var key = e.key || '';
      watch(key.length === 1 || key === 'Enter' || key === 'Tab');
    }

    // ── policy from the embedding dashboard ──
    function applyPolicy(data) {
      var mode = data.mode;
      if (mode !== 'enforce' && mode !== 'report' && mode !== 'open') return;

      var trusted = [];
      var budget = MAX_TRUSTED_CHARS;
      var list = Array.isArray(data.trusted) ? data.trusted : [];
      for (var i = 0; i < list.length && budget > 0; i++) {
        if (typeof list[i] !== 'string') continue;
        var block = normalize(list[i]).slice(0, budget);
        budget -= block.length;
        trusted.push(block);
      }

      policy = { mode: mode, trusted: trusted, received: true };
    }

    function onMessage(e) {
      var p = parentWin();
      if (!p || e.source !== p) return;
      var d = e.data;
      if (!d || d.aptrun !== 'guard-policy') return;
      applyPolicy(d);
      post({ aptrun: 'guard', type: 'alive', v: VERSION, mode: policy.mode, counts: counts });
    }

    function define(obj, name, value) {
      try {
        Object.defineProperty(obj, name, { value: value, writable: false, configurable: false, enumerable: false });
        return true;
      } catch (e) {
        return false;
      }
    }

    // ── clipboard API (the terminal's "Paste", the editor's context-menu and palette Paste) ──
    function patchClipboard() {
      var proto = win.Clipboard && win.Clipboard.prototype;
      if (!proto) return;

      var readText = proto.readText;
      var read = proto.read;
      var writeText = proto.writeText;

      if (typeof readText === 'function') {
        define(proto, 'readText', function () {
          return readText.apply(this, arguments).then(function (text) {
            if (inert() || !text) return text;
            if (registry.has(text)) { emit('paste_internal', { size: text.length, target: 'clipboard-api' }); return text; }
            if (isTrustedSnippet(text, policy.trusted)) { emit('paste_trusted', { size: text.length, target: 'clipboard-api' }); return text; }
            emit('clipboard_read_blocked', { size: text.length, target: 'clipboard-api' });
            if (!enforcing()) return text;
            notify('paste');
            return '';
          });
        });
      }

      if (typeof read === 'function') {
        define(proto, 'read', function () {
          return read.apply(this, arguments).then(function (items) {
            if (inert() || !items) return items;
            var checks = [];
            for (var i = 0; i < items.length; i++) {
              var it = items[i];
              if (it && it.types && it.types.indexOf('text/plain') !== -1) {
                checks.push(it.getType('text/plain').then(function (b) { return b.text(); }).catch(function () { return ''; }));
              }
            }
            return Promise.all(checks).then(function (texts) {
              for (var k = 0; k < texts.length; k++) {
                if (texts[k] && !textAllowed(texts[k])) {
                  emit('clipboard_read_blocked', { size: texts[k].length, target: 'clipboard-api' });
                  if (!enforcing()) return items;
                  notify('paste');
                  return [];
                }
              }
              return items;
            });
          });
        });
      }

      if (typeof writeText === 'function') {
        define(proto, 'writeText', function (text) {
          try { registry.add(text); } catch (e) { /* ignore */ }
          return writeText.apply(this, arguments);
        });
      }
    }

    function patchDataTransfer() {
      var proto = win.DataTransfer && win.DataTransfer.prototype;
      if (!proto || typeof proto.setData !== 'function') return;
      var setData = proto.setData;

      define(proto, 'setData', function (type, data) {
        if (copyWindowOpen && type === 'text/plain') remember(data);
        return setData.apply(this, arguments);
      });
    }

    function patchPickers() {
      var openFile = win.showOpenFilePicker;
      var openDir = win.showDirectoryPicker;
      var abort = function () {
        try { return new win.DOMException('Blocked by the project rules.', 'AbortError'); } catch (e) { return new Error('Blocked by the project rules.'); }
      };

      if (typeof openFile === 'function') {
        define(win, 'showOpenFilePicker', function () {
          return openFile.apply(win, arguments).then(function (handles) {
            if (inert()) return handles;
            var named = handles.map(function (h) { return { name: h && h.name, size: 0 }; });
            var verdict = classifyFiles(named);
            if (verdict.ok) return handles;
            emit('upload_blocked', { size: 0, target: 'file-picker', meta: { kinds: verdict.bad.slice(0, 5) } });
            if (!enforcing()) return handles;
            notify('upload');
            throw abort();
          });
        });
      }

      if (typeof openDir === 'function') {
        define(win, 'showDirectoryPicker', function () {
          if (inert()) return openDir.apply(win, arguments);
          emit('upload_blocked', { size: 0, target: 'directory-picker' });
          if (!enforcing()) return openDir.apply(win, arguments);
          notify('upload');
          return Promise.reject(abort());
        });
      }
    }

    function patchOpen() {
      var open = win.open;
      if (typeof open !== 'function') return;

      define(win, 'open', function (url) {
        var u = url === undefined || url === null ? '' : String(url);
        // Extra editor windows are opened blank; real links (docs, "open in browser") have an address.
        if (!inert() && (u === '' || u === 'about:blank')) {
          emit('window_blocked', { size: 0, target: 'window' });
          if (enforcing()) {
            notify('window');
            return null;
          }
        }
        return open.apply(win, arguments);
      });
    }

    /**
     * Newer Chromium gives VS Code an `EditContext` to receive text, which sends no `beforeinput` events, so a
     * text insertion by a script, dictation or an expander would be invisible to this guard. VS Code only uses it
     * when `typeof globalThis.EditContext == "function"`; without it the editor uses its classic textarea input
     * (as Firefox and Safari always have), where every insertion is observable.
     */
    function disableEditContext() {
      try {
        if (typeof win.EditContext === 'undefined') return;
        try { delete win.EditContext; } catch (e) { /* fall through */ }
        if (typeof win.EditContext !== 'undefined') define(win, 'EditContext', undefined);
      } catch (e) {
        /* the editor still works with EditContext; only bulk-insert detection is weaker */
      }
    }

    /** True when the focused element is the editor or the terminal (the quick-input's own boxes are none of our business). */
    function writesCode(el) {
      var where = targetOf({ target: el });
      return where === 'editor' || where === 'terminal';
    }

    /**
     * `document.execCommand('insertText' | 'insertHTML', …)` is how text-expander and "insert into page" browser
     * extensions (and a console) put text into an editable field, and it fires NO `beforeinput`, so it has to be
     * gated here. VS Code itself uses it only inside the quick-input's file dialog, never in the editor/terminal.
     */
    function patchExecCommand() {
      var proto = win.Document && win.Document.prototype;
      var exec = proto && proto.execCommand;
      if (typeof exec !== 'function') return;

      define(proto, 'execCommand', function (command, showUI, value) {
        var name = String(command || '').toLowerCase();

        if (!inert() && (name === 'inserttext' || name === 'inserthtml')) {
          var el = null;
          try { el = win.document.activeElement; } catch (e) { el = null; }
          var text = value == null ? '' : String(value);

          if (el && writesCode(el) && text.length > 1 && !textAllowed(text)) {
            emit('bulk_insert_blocked', { size: text.length, target: targetOf({ target: el }), meta: { via: 'execCommand' } });
            if (enforcing()) {
              notify('paste');
              return false;
            }
          }
        }

        return exec.apply(this, arguments);
      });
    }

    /** A script-made input/composition event in the editor or terminal is how a script "types" without a keyboard. */
    function onSyntheticInput(e) {
      if (inert() || isTrustedEvent(e)) return;
      if (!writesCode(e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement)) return;

      emit('synthetic_blocked', { size: 0, target: targetOf(e), meta: { type: e.type } });
      if (enforcing()) refuseEvent(e);
    }

    // ── wiring ──
    function start() {
      var cap = true;
      disableEditContext();
      win.addEventListener('paste', onPaste, cap);
      win.addEventListener('beforeinput', onBeforeInput, cap);
      win.addEventListener('drop', onDrop, cap);
      win.addEventListener('dragover', onDragOver, cap);
      win.addEventListener('dragenter', onDragOver, cap);
      win.addEventListener('dragend', onDragEnd, cap);
      win.addEventListener('change', onChange, cap);
      win.addEventListener('keydown', onKeyDown, cap);
      ['copy', 'cut', 'dragstart'].forEach(function (name) { win.addEventListener(name, onCopyLike, cap); });
      win.addEventListener('message', onMessage, false);

      ['input', 'beforeinput', 'compositionstart', 'compositionupdate', 'compositionend', 'textInput'].forEach(function (name) {
        win.addEventListener(name, onSyntheticInput, cap);
      });

      patchClipboard();
      patchDataTransfer();
      patchPickers();
      patchOpen();
      patchExecCommand();

      // Introduce ourselves to the embedding page until it answers with the policy, then keep a pulse.
      if (parentWin()) {
        var tries = 0;
        var hello = function () {
          if (policy.received || tries++ >= HELLO_TRIES) return;
          post({ aptrun: 'guard', type: 'hello', v: VERSION });
          win.setTimeout(hello, HELLO_EVERY_MS);
        };
        hello();

        win.setInterval(function () {
          flush();
          post({ aptrun: 'guard', type: 'alive', v: VERSION, mode: policy.mode, counts: counts });
        }, ALIVE_EVERY_MS);

        win.addEventListener('pagehide', flush, false);
      }
    }

    return {
      start: start,
      // exposed for tests
      state: function () { return { policy: policy, counts: counts, queue: queue, internalDrag: internalDrag }; },
      registry: registry,
      applyPolicy: applyPolicy,
      flush: flush,
      handlers: { onPaste: onPaste, onBeforeInput: onBeforeInput, onDrop: onDrop, onDragOver: onDragOver, onChange: onChange, onKeyDown: onKeyDown, onCopyLike: onCopyLike, onMessage: onMessage, onSyntheticInput: onSyntheticInput },
    };
  }

  function install(win) {
    var guard = createGuard(win);
    guard.start();

    return guard;
  }

  return {
    VERSION: VERSION,
    createGuard: createGuard,
    install: install,
    internals: {
      normalize: normalize,
      fingerprint: fingerprint,
      classifyFiles: classifyFiles,
      createRegistry: createRegistry,
      isTrustedSnippet: isTrustedSnippet,
      createTypingWatch: createTypingWatch,
      ASSET_EXTENSIONS: ASSET_EXTENSIONS,
      BULK_BLOCK: BULK_BLOCK,
      BULK_FLAG: BULK_FLAG,
      FAST_KEYS_IN_2S: FAST_KEYS_IN_2S,
    },
  };
});
