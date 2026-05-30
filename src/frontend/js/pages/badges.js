/* ═══════════════════════════════════════════════════════════════════════════
   CWOC Badges Page — badges.js
   Fetches badge data from the API and renders categorized badge cards.
   Handles staleness display, dismiss actions, and recently completed section.

   Depends on: shared-utils.js (getCachedSettings, cwocToast, cwocConfirm),
               shared-sidebar.js (_cwocInitSidebar, toggleSidebar),
               shared-page.js (header/footer injection)
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Module State ─────────────────────────────────────────────────────────────

var _badgesPageState = {
  badges: [],
  counts: { active: 0, completed: 0 },
  timeFormat: '24hour',
  completedWindow: '3',
  loading: false
};

// Category order (always rendered in this order)
var _badgesCategories = ['Package', 'Flight', 'Hotel', 'Rental', 'Event', 'Restaurant', 'Transit', 'Order'];

// ── Initialization ───────────────────────────────────────────────────────────

(async function _initBadgesPage() {
  try {
    // Fetch settings first (for time format and completed window)
    var settings = await getCachedSettings();
    _badgesPageState.timeFormat = (settings && settings.time_format) || '24hour';
    _badgesPageState.completedWindow = (settings && settings.badges_completed_window) || '3';

    // Initialize shared sidebar
    _initBadgesSidebar();

    // Initialize mobile sidebar overlay
    if (typeof initMobileSidebar === 'function') initMobileSidebar();

    // Inject page-specific sidebar controls
    _injectBadgesSidebarControls();

    // Fetch and render badges
    await _fetchAndRenderBadges();
  } catch (err) {
    console.error('[Badges] Init error:', err);
    _showBadgesError('Failed to load badges. Please try refreshing.');
  }
})();

// ── Sidebar Setup ────────────────────────────────────────────────────────────

function _initBadgesSidebar() {
  _cwocInitSidebar({
    page: 'badges',
    currentPage: 'badges',
    onCreateChit: function() {
      window.location.href = '/frontend/html/editor.html';
    },
    onToday: function() {
      window.location.href = '/';
    }
  });

  // Hide the author-info footer (sidebar has its own branding)
  var authorInfo = document.querySelector('.author-info');
  if (authorInfo) authorInfo.style.display = 'none';
}

/**
 * Inject page-specific sidebar controls: Recently Completed dropdown + Refresh button.
 * Inserts after the create section in the shared sidebar.
 */
function _injectBadgesSidebarControls() {
  var createSection = document.getElementById('section-create');
  if (!createSection) return;

  var section = document.createElement('div');
  section.className = 'sidebar-section badges-sidebar-section';
  section.id = 'section-badges-controls';

  // Recently Completed dropdown
  var label = document.createElement('label');
  label.textContent = 'Recently Completed';
  label.setAttribute('for', 'badges-completed-window');
  section.appendChild(label);

  var select = document.createElement('select');
  select.id = 'badges-completed-window';
  select.className = 'standard-select';
  var options = [
    { value: '1', text: '1 day' },
    { value: '3', text: '3 days' },
    { value: '7', text: '1 week' },
    { value: '30', text: '1 month' },
    { value: '365', text: '1 year' },
    { value: 'all', text: 'All' }
  ];
  for (var i = 0; i < options.length; i++) {
    var opt = document.createElement('option');
    opt.value = options[i].value;
    opt.textContent = options[i].text;
    select.appendChild(opt);
  }
  select.value = _badgesPageState.completedWindow;
  select.addEventListener('change', _onCompletedWindowChange);
  section.appendChild(select);

  // Refresh button
  var refreshBtn = document.createElement('button');
  refreshBtn.id = 'badges-refresh-btn';
  refreshBtn.className = 'action-button badges-refresh-btn';
  refreshBtn.innerHTML = '🔄 Refresh';
  refreshBtn.addEventListener('click', _onRefreshClick);
  section.appendChild(refreshBtn);

  // Insert after the create section
  createSection.insertAdjacentElement('afterend', section);
}

// ── Data Fetching ────────────────────────────────────────────────────────────

async function _fetchAndRenderBadges() {
  _badgesPageState.loading = true;

  try {
    var url = '/api/badges?completed_window=' + encodeURIComponent(_badgesPageState.completedWindow);
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('API returned ' + resp.status);

    var data = await resp.json();
    _badgesPageState.badges = data.badges || [];
    _badgesPageState.counts = data.counts || { active: 0, completed: 0 };

    // Hide loading, show categories
    var loadingEl = document.getElementById('badges-content');
    if (loadingEl) loadingEl.style.display = 'none';

    var categoriesEl = document.getElementById('badges-categories');
    if (categoriesEl) categoriesEl.style.display = '';

    // Render all sections
    _renderAllCategories();
    _renderCompletedSection();

    if (typeof cwocNetSuccess === 'function') cwocNetSuccess();
  } catch (err) {
    console.error('[Badges] Fetch error:', err);
    if (typeof cwocNetFail === 'function') cwocNetFail();
    _showBadgesError('Could not load badges. Check your connection.');
  } finally {
    _badgesPageState.loading = false;
  }
}

function _showBadgesError(message) {
  var loadingEl = document.getElementById('badges-content');
  if (loadingEl) {
    loadingEl.innerHTML = '<div class="badge-empty" style="padding:2em;">' + message + '</div>';
    loadingEl.style.display = '';
  }
}

// ── Rendering: Categories ────────────────────────────────────────────────────

function _renderAllCategories() {
  for (var i = 0; i < _badgesCategories.length; i++) {
    var cat = _badgesCategories[i];
    _renderCategory(cat);
  }
}

function _renderCategory(category) {
  var container = document.getElementById('cards-' + category);
  var countEl = document.getElementById('count-' + category);
  if (!container) return;

  // Filter active badges for this category, sorted by last_updated_at descending
  var badges = _badgesPageState.badges.filter(function(b) {
    return b.category === category && b.status === 'active';
  });
  badges.sort(function(a, b) {
    return (b.last_updated_at || '').localeCompare(a.last_updated_at || '');
  });

  // Update count
  if (countEl) {
    countEl.textContent = badges.length > 0 ? '(' + badges.length + ')' : '';
  }

  // Render cards or empty state
  container.innerHTML = '';
  if (badges.length === 0) {
    var emptyNames = {
      Package: 'packages', Flight: 'flights', Hotel: 'hotels',
      Rental: 'rentals', Event: 'events', Restaurant: 'restaurants',
      Transit: 'transit', Order: 'orders'
    };
    var empty = document.createElement('div');
    empty.className = 'badge-empty';
    empty.textContent = 'No active ' + (emptyNames[category] || category.toLowerCase());
    container.appendChild(empty);
  } else {
    for (var i = 0; i < badges.length; i++) {
      container.appendChild(_createBadgeCard(badges[i], false));
    }
  }
}

// ── Rendering: Completed Section ─────────────────────────────────────────────

function _renderCompletedSection() {
  var section = document.getElementById('badges-completed');
  var container = document.getElementById('cards-completed');
  var countEl = document.getElementById('completed-count');
  if (!section || !container) return;

  // Filter completed/dismissed badges, sorted by completed_at descending
  var completed = _badgesPageState.badges.filter(function(b) {
    return b.status === 'completed' || b.status === 'dismissed';
  });
  completed.sort(function(a, b) {
    return (b.completed_at || b.last_updated_at || '').localeCompare(a.completed_at || a.last_updated_at || '');
  });

  if (countEl) {
    countEl.textContent = completed.length > 0 ? '(' + completed.length + ')' : '';
  }

  if (completed.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  container.innerHTML = '';
  for (var i = 0; i < completed.length; i++) {
    container.appendChild(_createBadgeCard(completed[i], true));
  }
}

// ── Badge Card Creation ──────────────────────────────────────────────────────

function _createBadgeCard(badge, isCompleted) {
  var card = document.createElement('div');
  card.className = 'badge-card';
  card.dataset.badgeId = badge.id;

  if (badge.status === 'completed') card.classList.add('completed');
  if (badge.status === 'dismissed') card.classList.add('dismissed');

  // ── Top row: icon, provider, staleness, dismiss ──
  var top = document.createElement('div');
  top.className = 'badge-card-top';

  // Provider icon
  if (badge.icon && badge.icon.indexOf('/') !== -1) {
    var iconImg = document.createElement('img');
    iconImg.className = 'badge-card-icon';
    iconImg.src = badge.icon;
    iconImg.alt = badge.provider_name;
    iconImg.onerror = function() { this.style.display = 'none'; };
    top.appendChild(iconImg);
  } else {
    var iconEmoji = document.createElement('span');
    iconEmoji.className = 'badge-card-icon-emoji';
    iconEmoji.textContent = badge.icon || '🔗';
    top.appendChild(iconEmoji);
  }

  // Provider name
  var provider = document.createElement('span');
  provider.className = 'badge-card-provider';
  provider.textContent = badge.provider_name;
  top.appendChild(provider);

  // Status badge (for completed section)
  if (isCompleted) {
    var statusBadge = document.createElement('span');
    statusBadge.className = 'badge-card-status';
    if (badge.status === 'completed') {
      statusBadge.classList.add('status-completed');
      statusBadge.textContent = 'Completed';
    } else if (badge.status === 'dismissed') {
      statusBadge.classList.add('status-dismissed');
      statusBadge.textContent = 'Dismissed';
    }
    top.appendChild(statusBadge);
  }

  // Staleness indicator
  var staleness = document.createElement('span');
  staleness.className = 'badge-card-staleness';
  var stalenessInfo = _calculateStaleness(badge.last_updated_at);
  staleness.textContent = stalenessInfo.text;
  if (stalenessInfo.warning) staleness.classList.add('stale-warning');

  // Tooltip on hover
  staleness.addEventListener('mouseenter', function(e) {
    _showStalenessTooltip(e.target, badge.last_updated_at);
  });
  staleness.addEventListener('mouseleave', function() {
    _hideStalenessTooltip();
  });
  top.appendChild(staleness);

  // Dismiss button (only for active badges)
  if (!isCompleted) {
    var dismissBtn = document.createElement('button');
    dismissBtn.className = 'badge-card-dismiss';
    dismissBtn.title = 'Dismiss';
    dismissBtn.textContent = '✕';
    dismissBtn.addEventListener('click', function() {
      _dismissBadge(badge.id, card);
    });
    top.appendChild(dismissBtn);
  }

  card.appendChild(top);

  // ── Code ──
  if (badge.code) {
    var code = document.createElement('div');
    code.className = 'badge-card-code';
    code.textContent = badge.code;
    card.appendChild(code);
  }

  // ── Last email subject ──
  if (badge.last_email_subject) {
    var subject = document.createElement('div');
    subject.className = 'badge-card-subject';
    subject.textContent = '"' + badge.last_email_subject + '"';
    card.appendChild(subject);
  }

  // ── Actions row ──
  var actions = document.createElement('div');
  actions.className = 'badge-card-actions';

  // Action button (Track / View / Manage — opens external URL)
  if (badge.url) {
    var actionBtn = document.createElement('a');
    actionBtn.className = 'badge-card-action-btn';
    actionBtn.href = badge.url;
    actionBtn.target = '_blank';
    actionBtn.rel = 'noopener noreferrer';
    actionBtn.textContent = (badge.label || 'Track') + ' ↗';
    actions.appendChild(actionBtn);
  }

  // View Chit link
  if (badge.chit_id) {
    var viewChit = document.createElement('a');
    viewChit.className = 'badge-card-view-chit';
    viewChit.href = '/frontend/html/editor.html?id=' + encodeURIComponent(badge.chit_id);
    viewChit.textContent = '📝 View Chit';
    actions.appendChild(viewChit);
  }

  card.appendChild(actions);

  return card;
}

// ── Staleness Calculation ────────────────────────────────────────────────────

/**
 * Calculate staleness from last_updated_at to now.
 * Returns { text: '⏱️ Xm/Xh/Xd', warning: boolean }
 */
function _calculateStaleness(lastUpdatedAt) {
  if (!lastUpdatedAt) return { text: '⏱️ ?', warning: false };

  var updated = new Date(lastUpdatedAt);
  var now = new Date();
  var diffMs = now.getTime() - updated.getTime();

  if (diffMs < 0) return { text: '⏱️ now', warning: false };

  var diffMinutes = Math.floor(diffMs / 60000);
  var diffHours = Math.floor(diffMs / 3600000);
  var diffDays = Math.floor(diffMs / 86400000);

  var text;
  if (diffMinutes < 60) {
    text = '⏱️ ' + diffMinutes + 'm';
  } else if (diffHours < 24) {
    text = '⏱️ ' + diffHours + 'h';
  } else {
    text = '⏱️ ' + diffDays + 'd';
  }

  // Warning if > 7 days old
  var warning = diffDays > 7;

  return { text: text, warning: warning };
}

// ── Staleness Tooltip ────────────────────────────────────────────────────────

var _badgesTooltipEl = null;

function _showStalenessTooltip(targetEl, lastUpdatedAt) {
  if (!lastUpdatedAt) return;

  _hideStalenessTooltip();

  var updated = new Date(lastUpdatedAt);
  var formatted = _formatDateTimeForTooltip(updated);

  var tooltip = document.createElement('div');
  tooltip.className = 'badge-staleness-tooltip';
  tooltip.textContent = 'Last updated: ' + formatted;
  document.body.appendChild(tooltip);

  // Position near the target element
  var rect = targetEl.getBoundingClientRect();
  tooltip.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  tooltip.style.left = (rect.left + window.scrollX) + 'px';

  // Show with slight delay for smooth appearance
  requestAnimationFrame(function() {
    tooltip.classList.add('visible');
  });

  _badgesTooltipEl = tooltip;
}

function _hideStalenessTooltip() {
  if (_badgesTooltipEl) {
    _badgesTooltipEl.remove();
    _badgesTooltipEl = null;
  }
}

/**
 * Format a date for the staleness tooltip, respecting 24h setting.
 * e.g., "May 28, 2026 14:30" (24h) or "May 28, 2026 2:30 PM" (12h)
 */
function _formatDateTimeForTooltip(date) {
  var is24h = _badgesPageState.timeFormat === '24hour';

  var opts = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: !is24h
  };

  try {
    return date.toLocaleString('en-US', opts);
  } catch (e) {
    return date.toISOString();
  }
}

// ── Dismiss Action ───────────────────────────────────────────────────────────

async function _dismissBadge(badgeId, cardEl) {
  // Add dismissing animation
  cardEl.classList.add('dismissing');

  try {
    var resp = await fetch('/api/badges/' + encodeURIComponent(badgeId) + '/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!resp.ok) throw new Error('Dismiss failed: ' + resp.status);

    var updatedBadge = await resp.json();

    // Update local state
    for (var i = 0; i < _badgesPageState.badges.length; i++) {
      if (_badgesPageState.badges[i].id === badgeId) {
        _badgesPageState.badges[i] = updatedBadge;
        break;
      }
    }

    // Wait for animation to complete, then re-render
    setTimeout(function() {
      _renderAllCategories();
      _renderCompletedSection();
    }, 300);

    cwocToast('Badge dismissed', 'success');
  } catch (err) {
    console.error('[Badges] Dismiss error:', err);
    cardEl.classList.remove('dismissing');
    cwocToast('Failed to dismiss badge', 'error');
  }
}

// ── Sidebar Event Handlers ───────────────────────────────────────────────────

async function _onCompletedWindowChange() {
  var select = document.getElementById('badges-completed-window');
  if (!select) return;

  var newValue = select.value;
  _badgesPageState.completedWindow = newValue;

  // Save to settings
  try {
    var settings = await getCachedSettings();
    var userId = (settings && settings.user_id) ? settings.user_id : 'default_user';

    await fetch('/api/settings/' + encodeURIComponent(userId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ badges_completed_window: newValue })
    });

    _invalidateSettingsCache();
  } catch (err) {
    console.error('[Badges] Failed to save completed window setting:', err);
  }

  // Re-fetch badges with new window
  await _fetchAndRenderBadges();
}

async function _onRefreshClick() {
  var btn = document.getElementById('badges-refresh-btn');
  if (!btn || _badgesPageState.loading) return;

  // Show spinner
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing…';
  btn.disabled = true;

  try {
    // Trigger email check
    await fetch('/api/email/check', { method: 'POST' });

    // Wait a moment for processing
    await new Promise(function(resolve) { setTimeout(resolve, 1500); });

    // Re-fetch badges
    await _fetchAndRenderBadges();

    cwocToast('Badges refreshed', 'success');
  } catch (err) {
    console.error('[Badges] Refresh error:', err);
    cwocToast('Refresh failed', 'error');
  } finally {
    btn.innerHTML = '🔄 Refresh';
    btn.disabled = false;
  }
}
