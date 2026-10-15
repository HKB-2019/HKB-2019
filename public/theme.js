/* Sets the light or dark theme before the page is drawn, so it never flashes
 * the wrong one. The shopper's own choice if they made one, else their
 * device's. Kept in sync afterwards by src/lib/theme.js. */
(function () {
  var saved = null;
  try { saved = localStorage.getItem('masq:theme'); } catch (e) { /* private mode */ }
  var light = saved ? saved === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
})();
