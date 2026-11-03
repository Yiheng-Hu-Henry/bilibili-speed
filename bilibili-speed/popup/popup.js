(function () {
  'use strict';

  var KEY = 'bili3xConfig';
  var DEFAULTS = { enabled: true, rate: 3, showBadge: true, preservePitch: true };
  var MIN = 0.25;
  var MAX = 16;

  var state = {
    enabled: true,
    rate: 3,
    showBadge: true,
    preservePitch: true
  };

  var el = {
    power: document.getElementById('power'),
    val: document.getElementById('val'),
    slider: document.getElementById('slider'),
    presets: document.getElementById('presets'),
    num: document.getElementById('num'),
    minus: document.getElementById('minus'),
    plus: document.getElementById('plus'),
    badge: document.getElementById('badge'),
    pitch: document.getElementById('pitch')
  };

  function clamp(v) {
    v = Number(v);
    if (!isFinite(v)) return DEFAULTS.rate;
    if (v < MIN) v = MIN;
    if (v > MAX) v = MAX;
    return Math.round(v * 100) / 100;
  }

  function fmt(v) {
    var s = v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return s === '' ? '0' : s;
  }

  function save() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    var patch = {};
    patch[KEY] = {
      enabled: state.enabled,
      rate: state.rate,
      showBadge: state.showBadge,
      preservePitch: state.preservePitch
    };
    chrome.storage.local.set(patch);
  }

  function render() {
    el.val.textContent = fmt(state.rate);
    el.slider.value = String(Math.round(state.rate * 100));
    el.num.value = fmt(state.rate);
    el.power.setAttribute('data-on', state.enabled ? '1' : '0');
    el.badge.checked = state.showBadge;
    el.pitch.checked = state.preservePitch;
    document.body.setAttribute('data-off', state.enabled ? '0' : '1');

    var chips = el.presets.querySelectorAll('button');
    for (var i = 0; i < chips.length; i++) {
      var r = Number(chips[i].getAttribute('data-rate'));
      chips[i].setAttribute('data-active', Math.abs(r - state.rate) < 0.001 ? '1' : '0');
    }
  }

  function setRate(v, persist) {
    state.rate = clamp(v);
    render();
    if (persist !== false) save();
  }

  function hydrate() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      render();
      return;
    }
    chrome.storage.local.get(KEY, function (res) {
      var cfg = (res && res[KEY]) || {};
      state.enabled = typeof cfg.enabled === 'boolean' ? cfg.enabled : DEFAULTS.enabled;
      state.rate = clamp(cfg.rate === undefined ? DEFAULTS.rate : cfg.rate);
      state.showBadge = typeof cfg.showBadge === 'boolean' ? cfg.showBadge : DEFAULTS.showBadge;
      state.preservePitch = typeof cfg.preservePitch === 'boolean' ? cfg.preservePitch : DEFAULTS.preservePitch;
      render();
    });
  }

  hydrate();

  el.power.addEventListener('click', function () {
    state.enabled = !state.enabled;
    render();
    save();
  });

  el.slider.addEventListener('input', function () {
    setRate(Number(el.slider.value) / 100, false);
  });

  el.slider.addEventListener('change', function () {
    setRate(Number(el.slider.value) / 100);
  });

  el.presets.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button');
    if (!btn) return;
    setRate(Number(btn.getAttribute('data-rate')));
  });

  el.num.addEventListener('change', function () {
    setRate(el.num.value);
  });

  el.num.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') {
      setRate(el.num.value);
      el.num.blur();
    }
  });

  el.minus.addEventListener('click', function () {
    setRate(state.rate - 0.25);
  });

  el.plus.addEventListener('click', function () {
    setRate(state.rate + 0.25);
  });

  el.badge.addEventListener('change', function () {
    state.showBadge = el.badge.checked;
    save();
  });

  el.pitch.addEventListener('change', function () {
    state.preservePitch = el.pitch.checked;
    save();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowUp') {
      setRate(state.rate + 0.25);
      ev.preventDefault();
    } else if (ev.key === 'ArrowDown') {
      setRate(state.rate - 0.25);
      ev.preventDefault();
    }
  });

  render();
})();
