
(function () {
  var ASKS = window.TTCG_DROP_ASKS || [];
  var canvas = document.getElementById('drop-canvas');
  if (!canvas) return;
  var packs = document.getElementById('drop-packs');
  var customWrap = document.getElementById('custom-wrap');
  var customText = document.getElementById('custom-text');
  var captionEl = document.getElementById('drop-caption');
  var copyBtn = document.getElementById('drop-copy');
  var downBtn = document.getElementById('drop-download');
  var askId = 'tue';
  var TAG = 'Transform Thrive Create Grow\n#TTCGcommunities #TTCGeducation #ToTheCarpGods';
  var W = 1080, H = 1350, PAD = 88;
  var mark = new Image();
  mark.src = '/logo-192.png';

  function currentAsk() {
    for (var i = 0; i < ASKS.length; i++) if (ASKS[i].id === askId) return ASKS[i];
    return null;
  }
  function lines() {
    if (askId === 'custom') {
      return (customText.value || '')
        .split('\n')
        .map(function (l) { return l.trim().toUpperCase(); })
        .filter(Boolean);
    }
    var a = currentAsk();
    return a ? a.lines.slice() : [];
  }
  function sub() {
    if (askId === 'custom') return '';
    var a = currentAsk();
    return a ? (a.sub || '') : '';
  }
  function caption() {
    if (askId === 'custom') return ((customText.value || '').trim() + '\n\n' + TAG).trim();
    var a = currentAsk();
    return a ? a.caption : TAG;
  }
  function fit(ctx, texts, maxWidth, maxSize) {
    var size = maxSize;
    while (size > 40) {
      ctx.font = '800 ' + size + 'px "Barlow Condensed", "Arial Narrow", sans-serif';
      var widest = 0;
      for (var i = 0; i < texts.length; i++) {
        var w = ctx.measureText(texts[i]).width;
        if (w > widest) widest = w;
      }
      if (widest <= maxWidth) return size;
      size -= 2;
    }
    return size;
  }
  function draw() {
    var ctx = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;
    ctx.fillStyle = '#080807';
    ctx.fillRect(0, 0, W, H);
    var display = lines();
    if (!display.length) display = ['TYPE THE ASK'];
    var usable = W - PAD * 2;
    var mainSize = fit(ctx, display, usable, display.length > 3 ? 92 : 118);
    var subSize = Math.round(mainSize * 0.38);
    var s = sub();
    var lineGap = mainSize * 0.98;
    var blockH = display.length * lineGap + (s ? subSize + 36 : 0);
    var y = H / 2 - blockH / 2 + mainSize * 0.78;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f5f2e9';
    ctx.font = '800 ' + mainSize + 'px "Barlow Condensed", "Arial Narrow", sans-serif';
    for (var i = 0; i < display.length; i++) {
      ctx.fillText(display[i], W / 2, y, usable);
      y += lineGap;
    }
    if (s) {
      y += 8;
      ctx.fillStyle = '#cba268';
      ctx.font = '600 ' + subSize + 'px "Barlow Condensed", "Arial Narrow", sans-serif';
      ctx.fillText(s, W / 2, y, usable);
    }
    if (mark.complete && mark.naturalWidth) {
      var ms = 112;
      ctx.drawImage(mark, W - PAD - ms + 8, H - PAD - ms + 4, ms, ms);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cba268';
    ctx.font = '600 22px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.fillText('TTCG COMMUNITIES', PAD, H - PAD + 8);
    captionEl.textContent = caption();
  }
  function setOn() {
    var buttons = packs.querySelectorAll('.pack');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('on', buttons[i].getAttribute('data-id') === askId);
    }
    customWrap.style.display = askId === 'custom' ? 'block' : 'none';
  }
  packs.addEventListener('click', function (e) {
    var btn = e.target.closest('.pack');
    if (!btn) return;
    askId = btn.getAttribute('data-id');
    setOn();
    draw();
  });
  customText.addEventListener('input', draw);
  downBtn.addEventListener('click', function () {
    var a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'ttcg-drop-' + askId + '.png';
    a.click();
  });
  copyBtn.addEventListener('click', function () {
    var text = caption();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = 'Caption copied';
        setTimeout(function () { copyBtn.textContent = 'Copy the caption'; }, 1800);
      });
    }
  });
  mark.onload = draw;
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(draw);
  }
  setOn();
  draw();
})();
