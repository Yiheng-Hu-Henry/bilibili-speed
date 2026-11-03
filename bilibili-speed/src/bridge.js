/* B 站倍速 · 任意调速 —— 隔离世界桥接
 * 职责：在 chrome.storage（扩展）与页面主世界（main.js）之间搬运配置。
 * 通道：documentElement 的 data-bili3x 属性（首帧）+ CustomEvent（运行期）。
 */
(function () {
  'use strict';
  if (window.__bili3xBridge) return;
  window.__bili3xBridge = true;

  var KEY = 'bili3xConfig';
  var DEFAULTS = { enabled: true, rate: 3, showBadge: true, preservePitch: true };
  var last = null;

  function merge(obj) {
    var out = {};
    for (var k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) out[k] = DEFAULTS[k];
    }
    if (obj && typeof obj === 'object') {
      for (var j in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, j) && obj[j] !== undefined) out[j] = obj[j];
      }
    }
    return out;
  }

  function deliver(cfg) {
    var s = JSON.stringify(cfg);
    last = s;
    try { document.documentElement.setAttribute('data-bili3x', s); } catch (e) { /* 忽略 */ }
    try { document.dispatchEvent(new CustomEvent('bili3x:in', { detail: s })); } catch (e) { /* 忽略 */ }
  }

  function load() {
    try {
      chrome.storage.local.get(KEY, function (res) {
        if (chrome.runtime.lastError) {
          deliver(merge(null));
          return;
        }
        deliver(merge(res && res[KEY]));
      });
    } catch (e) {
      deliver(merge(null));
    }
  }

  /* 页面内改动 → 落盘 */
  document.addEventListener('bili3x:out', function (ev) {
    var s = ev.detail;
    if (typeof s !== 'string' || s === last) return;
    last = s;
    try {
      var cfg = merge(JSON.parse(s));
      var patch = {};
      patch[KEY] = cfg;
      chrome.storage.local.set(patch);
      document.documentElement.setAttribute('data-bili3x', s);
    } catch (e) { /* 忽略 */ }
  });

  /* 设置面板改动 → 推给页面 */
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes[KEY]) return;
      var cfg = merge(changes[KEY].newValue);
      if (JSON.stringify(cfg) !== last) deliver(cfg);
    });
  } catch (e) { /* 忽略 */ }

  load();

  window.addEventListener('DOMContentLoaded', function () {
    if (!last) load();
  });
})();
