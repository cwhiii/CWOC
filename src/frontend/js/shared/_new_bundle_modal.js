
  // Remove any existing modal
  var existing = document.getElementById('bundle-add-overlay');
  if (existing) existing.remove();

  // Extract email metadata
  var senderRaw = chit.email_from || '';
  var senderEmail = senderRaw;
  var emailMatch = senderRaw.match(/<([^>]+)>/);
  if (emailMatch) senderEmail = emailMatch[1];
  else if (senderRaw.indexOf('@') > -1) senderEmail = senderRaw.trim();

  var subject = chit.title || chit.email_subject || '(No Subject)';

  var recipientRaw = chit.email_to || '';
  var recipientEmail = '';
  if (Array.isArray(recipientRaw)) {
    recipientEmail = recipientRaw[0] || '';
  } else if (typeof recipientRaw === 'string' && recipientRaw.startsWith('[')) {
    try { recipientEmail = JSON.parse(recipientRaw)[0] || ''; } catch(e) { recipientEmail = recipientRaw; }
  } else {
    recipientEmail = String(recipientRaw);
  }
  var recipMatch = recipientEmail.match(/<([^>]+)>/);
  if (recipMatch) recipientEmail = recipMatch[1];
  else if (recipientEmail.indexOf('@') > -1) recipientEmail = recipientEmail.trim();

  // Build modal
  var overlay = document.createElement('div');
  overlay.className = 'cwoc-overlay';
  overlay.id = 'bundle-add-overlay';

  var modal = document.createElement('div');
  modal.className = 'cwoc-modal bundle-drop-modal';

  var titleEl = document.createElement('h3');
  titleEl.textContent = preselectedBundleName ? ('Move to ' + preselectedBundleName) : 'Add Email to Bundle';
  modal.appendChild(titleEl);

  // ── Mode radio options ──
  var options = [
    { value: 'move_once', labelHtml: 'Just this <b>once</b>', matchField: null },
    { value: 'always_sender', labelHtml: 'Always <b>from</b> this sender', matchField: senderEmail },
    { value: 'always_subject', labelHtml: 'Always <b>with</b> this subject', matchField: subject },
    { value: 'always_recipient', labelHtml: 'Always <b>to</b> this recipient', matchField: recipientEmail }
  ];

  var radioGroup = document.createElement('div');
  radioGroup.className = 'bundle-drop-options';

  options.forEach(function(opt, idx) {
    var row = document.createElement('label');
    row.className = 'bundle-drop-option';
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'bundle-add-mode';
    radio.value = opt.value;
    if (idx === 0) radio.checked = true;
    row.appendChild(radio);
    var labelText = document.createElement('span');
    labelText.innerHTML = opt.labelHtml;
    row.appendChild(labelText);
    radioGroup.appendChild(row);
  });
  modal.appendChild(radioGroup);

  // ── Match value input ──
  var matchSection = document.createElement('div');
  matchSection.className = 'bundle-drop-match-section';
  matchSection.style.display = 'none';

  var matchLabel = document.createElement('label');
  matchLabel.textContent = 'Match value (use * as wildcard):';
  matchSection.appendChild(matchLabel);

  var matchInput = document.createElement('input');
  matchInput.type = 'text';
  matchInput.className = 'bundle-drop-match-input';
  matchInput.value = senderEmail;
  matchSection.appendChild(matchInput);
  modal.appendChild(matchSection);

  // ── Bundle selection (only if no preselected bundle) ──
  var bundleSelect = null;
  var newBundleSection = null;

  if (!preselectedBundleId) {
    var bundleLabel = document.createElement('label');
    bundleLabel.style.cssText = 'display:block;margin-bottom:0.3em;font-weight:bold;color:#1a1208;';
    bundleLabel.textContent = 'Target bundle:';
    modal.appendChild(bundleLabel);

    bundleSelect = document.createElement('select');
    bundleSelect.className = 'bundle-drop-match-input';
    bundleSelect.style.marginBottom = '0.8em';
    bundleSelect.innerHTML = '<option value="">Loading...</option>';
    modal.appendChild(bundleSelect);

    // "Create new bundle" section
    newBundleSection = document.createElement('div');
    newBundleSection.className = 'bundle-drop-match-section';
    newBundleSection.style.display = 'none';

    var newBundleLabel = document.createElement('label');
    newBundleLabel.textContent = 'New bundle name:';
    newBundleSection.appendChild(newBundleLabel);

    var newBundleInput = document.createElement('input');
    newBundleInput.type = 'text';
    newBundleInput.className = 'bundle-drop-match-input';
    newBundleInput.placeholder = 'Enter bundle name...';
    newBundleSection.appendChild(newBundleInput);
    modal.appendChild(newBundleSection);

    // Load bundles into select
    _loadBundlesForAddModal(bundleSelect, newBundleSection);
  }

  // ── Retroactive checkbox ──
  var retroSection = document.createElement('div');
  retroSection.className = 'bundle-drop-retro-section';

  var retroLabel = document.createElement('label');
  retroLabel.className = 'bundle-drop-retro-label';

  var retroCb = document.createElement('input');
  retroCb.type = 'checkbox';
  retroCb.checked = true;
  retroLabel.appendChild(retroCb);

  var retroText = document.createElement('span');
  retroText.textContent = ' Apply retroactively to existing emails';
  retroLabel.appendChild(retroText);
  retroSection.appendChild(retroLabel);
  modal.appendChild(retroSection);

  // ── Buttons ──
  var btnRow = document.createElement('div');
  btnRow.className = 'bundle-drop-buttons';

  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'zone-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', function() { _closeAddBundleModal(); });
  btnRow.appendChild(cancelBtn);

  var confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'zone-button zone-button-primary';
  confirmBtn.textContent = preselectedBundleId ? 'Move' : 'Add to Bundle';
  confirmBtn.addEventListener('click', function() {
    var mode = modal.querySelector('input[name="bundle-add-mode"]:checked').value;
    var matchValue = matchInput.value.trim();
    var retroactive = retroCb.checked;

    // Determine target bundle ID
    var targetBundleId = preselectedBundleId || null;
    if (!targetBundleId && bundleSelect) {
      targetBundleId = bundleSelect.value;
    }

    // Handle "create new bundle" option
    if (!targetBundleId || targetBundleId === '__new__') {
      var newName = newBundleSection ? newBundleSection.querySelector('input[type="text"]').value.trim() : '';
      if (!newName) {
        cwocToast('Please enter a name for the new bundle.', 'error');
        return;
      }
      _createBundleThenDrop(newName, chit.id, mode, matchValue, retroactive);
      return;
    }

    if (!targetBundleId) {
      cwocToast('Please select a bundle.', 'error');
      return;
    }

    _executeUnifiedBundleDrop(chit.id, targetBundleId, mode, matchValue, retroactive);
  });
  btnRow.appendChild(confirmBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // ── Show/hide match input based on radio selection ──
  radioGroup.addEventListener('change', function() {
    var selected = modal.querySelector('input[name="bundle-add-mode"]:checked').value;
    if (selected === 'move_once') {
      matchSection.style.display = 'none';
      retroCb.checked = false;
    } else {
      matchSection.style.display = '';
      retroCb.checked = true;
      if (selected === 'always_sender') matchInput.value = senderEmail;
      else if (selected === 'always_subject') matchInput.value = subject;
      else if (selected === 'always_recipient') matchInput.value = recipientEmail;
    }
  });

  // ── ESC to close ──
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _closeAddBundleModal();
  });
  document.addEventListener('keydown', _addBundleModalEscHandler, true);
}

function _addBundleModalEscHandler(e) {
  if (e.key === 'Escape') {
    e.stopImmediatePropagation();
    e.preventDefault();
    _closeAddBundleModal();
  }
}

function _closeAddBundleModal() {
  var overlay = document.getElementById('bundle-add-overlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', _addBundleModalEscHandler, true);
}

/**
 * Load bundles into the select element for the unified Add to Bundle modal.
 * Includes a "Create new bundle..." option at the end.
 */
function _loadBundlesForAddModal(selectEl, newBundleSection) {
  var bundles = [];

  // Try cached settings first
  if (window._cwocSettings && window._cwocSettings.bundles) {
    bundles = window._cwocSettings.bundles;
  } else if (typeof _emailBundlesData !== 'undefined' && _emailBundlesData) {
    bundles = _emailBundlesData;
  }

  if (bundles && bundles.length) {
    _populateAddBundleSelect(selectEl, bundles, newBundleSection);
    return;
  }

  // Fall back to fetching settings
  if (typeof getCachedSettings === 'function') {
    getCachedSettings().then(function(settings) {
      var b = (settings && settings.bundles) || [];
      _populateAddBundleSelect(selectEl, b, newBundleSection);
    }).catch(function() {
      selectEl.innerHTML = '<option value="">Error loading bundles</option>';
    });
  } else {
    selectEl.innerHTML = '<option value="">No bundles available</option>';
  }
}

function _populateAddBundleSelect(selectEl, bundles, newBundleSection) {
  selectEl.innerHTML = '';

  var defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Select a bundle...';
  selectEl.appendChild(defaultOpt);

  var available = (bundles || []).filter(function(b) {
    return !b.is_catch_all && b.display_order !== -1;
  }).sort(function(a, b) {
    return (a.display_order || 0) - (b.display_order || 0);
  });

  available.forEach(function(bundle) {
    var opt = document.createElement('option');
    opt.value = bundle.id;
    opt.textContent = bundle.name;
    selectEl.appendChild(opt);
  });

  // "Create new bundle" option
  var newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '\u2795 Create new bundle...';
  selectEl.appendChild(newOpt);

  // Show/hide new bundle name input
  selectEl.addEventListener('change', function() {
    if (selectEl.value === '__new__') {
      newBundleSection.style.display = '';
      newBundleSection.querySelector('input[type="text"]').focus();
    } else {
      newBundleSection.style.display = 'none';
    }
  });
}

/**
 * Create a new bundle, then execute the drop-email action into it.
 */
async function _createBundleThenDrop(bundleName, chitId, mode, matchValue, retroactive) {
  _closeAddBundleModal();
  try {
    var resp = await fetch('/api/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: bundleName })
    });
    if (!resp.ok) {
      var err = await resp.json().catch(function() { return {}; });
      cwocToast(err.detail || 'Failed to create bundle', 'error');
      return;
    }
    var newBundle = await resp.json();
    cwocToast('Created bundle "' + newBundle.name + '"', 'success');
    await _executeUnifiedBundleDrop(chitId, newBundle.id, mode, matchValue, retroactive);
  } catch (e) {
    console.error('[AddToBundle] Create bundle error:', e);
    cwocToast('Failed to create bundle', 'error');
  }
}

/**
 * Execute the unified bundle drop via /api/bundles/{id}/drop-email.
 * Used by context menu, drag-drop, and mobile long-press flows.
 */
async function _executeUnifiedBundleDrop(chitId, bundleId, mode, matchValue, retroactive) {
  _closeAddBundleModal();
  try {
    var response = await fetch('/api/bundles/' + encodeURIComponent(bundleId) + '/drop-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chit_id: chitId,
        mode: mode,
        match_value: matchValue,
        apply_retroactively: retroactive
      })
    });

    if (!response.ok) {
      var err = await response.json().catch(function() { return {}; });
      cwocToast(err.detail || 'Failed to move email', 'error');
      return;
    }

    var data = await response.json();
    var msg = 'Moved to ' + data.bundle_name;
    if (data.rule_name) msg += ' (rule created)';
    if (data.reclassified_count > 0) msg += ' \u2014 ' + data.reclassified_count + ' emails reclassified';
    cwocToast(msg, 'success');

    // Refresh
    if (typeof _invalidateSettingsCache === 'function') _invalidateSettingsCache();
    if (typeof fetchChits === 'function') {
      await fetchChits();
      if (typeof displayChits === 'function') displayChits();
    }
  } catch (e) {
    console.error('[AddToBundle] Error:', e);
    cwocToast('Failed to move email', 'error');
  }
}
