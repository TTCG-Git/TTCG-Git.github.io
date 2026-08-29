
(function () {
  var b = document.querySelector('.burger');
  var m = document.querySelector('.mobile');
  if (!b || !m) return;
  b.addEventListener('click', function () {
    var open = m.classList.toggle('open');
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    b.textContent = open ? '×' : '☰';
  });
})();
