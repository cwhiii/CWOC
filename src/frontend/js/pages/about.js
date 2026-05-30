/* ═══════════════════════════════════════════════════════════════════════════
   About Page — version display
   ═══════════════════════════════════════════════════════════════════════════ */
(function() {
    'use strict';

    // Fetch and display version
    fetch('/api/version')
        .then(function(r) { return r.ok ? r.json() : {}; })
        .then(function(d) {
            var el = document.getElementById('about-version-label');
            if (el && d.version) {
                el.textContent = 'v' + d.version;
            } else if (el) {
                el.textContent = '';
            }
        })
        .catch(function() {
            var el = document.getElementById('about-version-label');
            if (el) el.textContent = '';
        });
})();
