/* B 站倍速 · 任意调速 —— 注入页面主世界（MAIN world）
 * 思路：重写 HTMLMediaElement.prototype.playbackRate 的 setter，
 *      让播放器写进来的任何值都被替换成用户设定的倍速。
 *      配置由 bridge.js 通过 data 属性 + CustomEvent 搬运。
 */
(function () {
  'use strict';
  if (window.__bili3xMain) return;
  window.__bili3xMain = true;

  var MIN = 0.25;
  var MAX = 16;
  var DEF = 3;
  var ATTR = 'data-bili3x';

  var config = { enabled: true, rate: DEF, showBadge: true, preservePitch: true };

  function clamp(v) {
    v = Number(v);
    if (!isFinite(v)) return DEF;
    if (v < MIN) v = MIN;
    if (v > MAX) v = MAX;
    return Math.round(v * 100) / 100;
  }

  function fmt(v) {
    var s = v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return s === '' ? '0' : s;
  }

  /* ---------------- 1. 拦截 setter ---------------- */

  var proto = HTMLMediaElement.prototype;
  var native = Object.getOwnPropertyDescriptor(proto, 'playbackRate');

  if (native && native.set && native.get) {
    try {
      Object.defineProperty(proto, 'playbackRate', {
        configurable: true,
        enumerable: native.enumerable,
        get: function () {
          return native.get.call(this);
        },
        set: function (v) {
          var target = v;
          if (config.enabled && this && this.tagName === 'VIDEO') {
            target = config.rate;
          }
          try {
            native.set.call(this, target);
          } catch (e) {
            try { native.set.call(this, config.enabled ? config.rate : 1); } catch (e2) { /* 放弃 */ }
          }
        }
      });
    } catch (e) {
      /* 某些环境不允许改写，靠下面的轮询兜底 */
    }
  }

  /* ---------------- 2. 兜底校正 ---------------- */

  function pickVideo() {
    var list = document.querySelectorAll('video');
    for (var i = 0; i < list.length; i++) {
      if (list[i].readyState > 0 || list[i].currentSrc) return list[i];
    }
    return list[0] || null;
  }

  function applyPitch(v) {
    try {
      if ('preservesPitch' in v) v.preservesPitch = config.preservePitch;
      if ('webkitPreservesPitch' in v) v.webkitPreservesPitch = config.preservePitch;
      if ('mozPreservesPitch' in v) v.mozPreservesPitch = config.preservePitch;
    } catch (e) { /* 忽略 */ }
  }

  function enforce() {
    var v = pickVideo();
    if (!v) return;
    applyPitch(v);
    if (!config.enabled) return;
    if (Math.abs(v.playbackRate - config.rate) > 0.01) {
      try { v.playbackRate = config.rate; } catch (e) { /* 忽略 */ }
    }
  }

  ['play', 'playing', 'ratechange', 'loadedmetadata', 'canplay', 'durationchange', 'emptied', 'seeking'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      setTimeout(enforce, 0);
      setTimeout(enforce, 60);
    }, true);
  });

  setInterval(function () {
    enforce();
    syncPlayerLabel();
    mountBadge();
  }, 500);

  /* ---------------- 3. 状态输出 ---------------- */

  function push() {
    var s = JSON.stringify(config);
    try { document.dispatchEvent(new CustomEvent('bili3x:out', { detail: s })); } catch (e) { /* 忽略 */ }
  }

  function apply(next) {
    if (!next || typeof next !== 'object') return;
    if (typeof next.enabled === 'boolean') config.enabled = next.enabled;
    if (next.rate !== undefined) config.rate = clamp(next.rate);
    if (typeof next.showBadge === 'boolean') config.showBadge = next.showBadge;
    if (typeof next.preservePitch === 'boolean') config.preservePitch = next.preservePitch;
    enforce();
    renderBadge();
  }

  function setRate(v, silent) {
    config.rate = clamp(v);
    enforce();
    renderBadge();
    push();
    if (!silent) toast('倍速 ' + fmt(config.rate) + '×');
  }

  function toggle() {
    config.enabled = !config.enabled;
    enforce();
    renderBadge();
    push();
    toast(config.enabled ? '已开启 · ' + fmt(config.rate) + '×' : '已关闭');
  }

  /* ---------------- 4. 悬浮球 ---------------- */

  var badge = null;
  var toastEl = null;
  var toastTimer = 0;

  function injectStyle() {
    if (document.getElementById('bili3x-style')) return;
    var css = [
      '.bili3x-badge{position:fixed;right:16px;bottom:104px;z-index:2147483000;display:flex;align-items:center;gap:4px;',
      'height:30px;padding:0 11px;border-radius:15px;background:rgba(23,24,28,.82);color:#fff;',
      'font:600 13px/30px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;',
      'cursor:pointer;user-select:none;-webkit-user-select:none;backdrop-filter:blur(6px);',
      'box-shadow:0 4px 14px rgba(0,0,0,.28);transition:background .16s,opacity .16s;touch-action:none}',
      '.bili3x-badge:hover{background:rgba(23,24,28,.94)}',
      '.bili3x-dot{width:7px;height:7px;border-radius:50%;background:#fb7299;',
      'box-shadow:0 0 0 3px rgba(251,114,153,.22);flex:none;transition:background .16s}',
      '.bili3x-badge[data-on="0"] .bili3x-dot{background:#7d838d;box-shadow:none}',
      '.bili3x-num{font-variant-numeric:tabular-nums}',
      '.bili3x-x{font-size:11px;opacity:.72;margin-left:-3px}',
      '.bili3x-toast{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:2147483000;',
      'padding:7px 15px;border-radius:8px;background:rgba(23,24,28,.86);color:#fff;',
      'font:600 13px/1.4 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;',
      'pointer-events:none;opacity:0;transition:opacity .18s}',
      '.bili3x-toast[data-show="1"]{opacity:1}'
    ].join('');

    var style = document.createElement('style');
    style.id = 'bili3x-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function buildBadge() {
    injectStyle();
    badge = document.createElement('div');
    badge.className = 'bili3x-badge';
    badge.setAttribute('data-on', '1');
    badge.title = '单击开关 · 滚轮调速 · 拖动移位 · 双击复位';

    var dot = document.createElement('span');
    dot.className = 'bili3x-dot';

    var num = document.createElement('span');
    num.className = 'bili3x-num';

    var x = document.createElement('span');
    x.className = 'bili3x-x';
    x.textContent = 'x';

    badge.appendChild(dot);
    badge.appendChild(num);
    badge.appendChild(x);

    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('bili3x-badge') || 'null'); } catch (e) { saved = null; }
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      badge.style.left = saved.x + 'px';
      badge.style.top = saved.y + 'px';
      badge.style.right = 'auto';
      badge.style.bottom = 'auto';
    }

    bindBadge();
    (document.fullscreenElement || document.body || document.documentElement).appendChild(badge);
    renderBadge();
  }

  function bindBadge() {
    var dragging = false;
    var moved = false;
    var startX = 0;
    var startY = 0;
    var originX = 0;
    var originY = 0;

    badge.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      dragging = true;
      moved = false;
      startX = ev.clientX;
      startY = ev.clientY;
      var rect = badge.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      badge.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });

    badge.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      moved = true;
      var x = Math.max(0, Math.min(window.innerWidth - 60, originX + dx));
      var y = Math.max(0, Math.min(window.innerHeight - 36, originY + dy));
      badge.style.left = x + 'px';
      badge.style.top = y + 'px';
      badge.style.right = 'auto';
      badge.style.bottom = 'auto';
    });

    badge.addEventListener('pointerup', function (ev) {
      if (!dragging) return;
      dragging = false;
      try { badge.releasePointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
      if (moved) {
        var rect = badge.getBoundingClientRect();
        try {
          localStorage.setItem('bili3x-badge', JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
        } catch (e) { /* 忽略 */ }
      } else {
        toggle();
      }
    });

    badge.addEventListener('dblclick', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      setRate(DEF);
    });

    badge.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var step = ev.shiftKey ? 0.05 : 0.25;
      var dir = ev.deltaY > 0 ? -1 : 1;
      setRate(config.rate + dir * step);
    }, { passive: false });

    badge.addEventListener('click', function (ev) {
      ev.stopPropagation();
    });
  }

  function renderBadge() {
    if (!badge) return;
    badge.setAttribute('data-on', config.enabled ? '1' : '0');
    var num = badge.querySelector('.bili3x-num');
    if (num) num.textContent = config.enabled ? fmt(config.rate) : '关';
    badge.style.display = config.showBadge ? '' : 'none';
  }

  function mountBadge() {
    if (!document.querySelector('video')) {
      if (badge) badge.style.display = 'none';
      return;
    }
    if (!badge) {
      if (!document.body && !document.documentElement) return;
      buildBadge();
      return;
    }
    var host = document.fullscreenElement || document.body;
    if (host && badge.parentNode !== host) {
      host.appendChild(badge);
    }
    renderBadge();
  }

  /* ---------------- 5. 提示条 ---------------- */

  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'bili3x-toast';
      (document.fullscreenElement || document.body || document.documentElement).appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.setAttribute('data-show', '1');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (toastEl) toastEl.setAttribute('data-show', '0');
    }, 1100);
  }

  /* ---------------- 6. 同步播放器上的倍速标签 ---------------- */

  function syncPlayerLabel() {
    if (!config.enabled) return;
    var label = fmt(config.rate) + 'x';
    var nodes = ['.bpx-player-ctrl-playbackrate-result', '.bpx-player-ctrl-playbackrate-menu .bpx-state'];
    for (var i = 0; i < nodes.length; i++) {
      var el = document.querySelector(nodes[i]);
      if (el && el.textContent !== label) el.textContent = label;
    }
  }

  /* ---------------- 7. 键盘快捷键 ---------------- */

  document.addEventListener('keydown', function (ev) {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var code = ev.code || '';
    var key = ev.key || '';

    if (code === 'Digit3' || key === '3') {
      toggle();
      ev.preventDefault();
    } else if (key === 'ArrowUp') {
      setRate(config.rate + 0.25);
      ev.preventDefault();
    } else if (key === 'ArrowDown') {
      setRate(config.rate - 0.25);
      ev.preventDefault();
    } else if (code === 'Digit0' || key === '0') {
      setRate(DEF);
      ev.preventDefault();
    }
  }, true);

  /* ---------------- 8. 接收配置 ---------------- */

  document.addEventListener('bili3x:in', function (ev) {
    try {
      apply(JSON.parse(ev.detail));
    } catch (e) { /* 忽略 */ }
  });

  try {
    var raw = document.documentElement.getAttribute(ATTR);
    if (raw) apply(JSON.parse(raw));
  } catch (e) {
    /* 首帧还没拿到配置，等桥接推 */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      enforce();
      mountBadge();
    });
  } else {
    enforce();
    mountBadge();
  }
})();
