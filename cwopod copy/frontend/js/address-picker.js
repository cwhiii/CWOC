/**
 * Shared address picker component.
 * Used by both the single-order (project page) and batch-order (bookshelf page).
 *
 * Renders a saved-address dropdown + custom address form, and provides
 * a helper to extract the selected/entered address as a structured object.
 */

import { api } from './api.js';
import { escapeHtml } from './dom.js';

/**
 * Returns the HTML for the address picker section.
 * Caller should inject this into their container, then call `initAddressPicker`.
 *
 * @param {object} opts
 * @param {string} [opts.idPrefix=''] - Optional prefix for element IDs to avoid collisions when
 *   multiple pickers exist on the same page. Leave empty for the default IDs.
 * @returns {string} HTML string
 */
export function addressPickerHtml(opts = {}) {
    const p = opts.idPrefix || '';
    console.log('[AddressPicker] Generating HTML, idPrefix=', p);
    return `
        <div class="form-group">
            <label>Shipping Address</label>
            <select id="${p}shipping-address-select">
                <option value="">Loading addresses...</option>
            </select>
        </div>
        <div id="${p}custom-address-fields" style="display:none;">
            <div class="form-group"><label>Full Name</label><input type="text" id="${p}custom-addr-name" maxlength="200"></div>
            <div class="form-group"><label>Street Address</label><input type="text" id="${p}custom-addr-street1" maxlength="300"></div>
            <div class="form-group"><label>Street Address 2 (optional)</label><input type="text" id="${p}custom-addr-street2" maxlength="300"></div>
            <div class="form-group"><label>City</label><input type="text" id="${p}custom-addr-city" maxlength="100"></div>
            <div class="form-group"><label>State/Province</label><input type="text" id="${p}custom-addr-state" maxlength="100"></div>
            <div class="form-group"><label>Postal Code</label><input type="text" id="${p}custom-addr-postal" maxlength="20"></div>
            <div class="form-group"><label>Country (2-letter code)</label><input type="text" id="${p}custom-addr-country" value="US" maxlength="2"></div>
            <div class="form-group"><label>Phone Number</label><input type="tel" id="${p}custom-addr-phone" placeholder="e.g. 555-123-4567" maxlength="30"></div>
            <div class="form-group"><label><input type="checkbox" id="${p}save-custom-addr"> Save this address for future orders</label></div>
            <div id="${p}save-addr-label-group" style="display:none;"><div class="form-group"><label>Address Label</label><input type="text" id="${p}custom-addr-label" placeholder="e.g. Office, Mom's House" maxlength="100"></div></div>
        </div>
    `;
}

/**
 * Initialize the address picker: fetch saved addresses, populate dropdown, wire events.
 *
 * @param {jQuery} $container - The jQuery element containing the address picker HTML.
 * @param {object} [opts]
 * @param {string} [opts.idPrefix=''] - Must match the prefix used in `addressPickerHtml`.
 * @returns {Promise<void>}
 */
export async function initAddressPicker($container, opts = {}) {
    const p = opts.idPrefix || '';
    console.log('[AddressPicker] Initializing, idPrefix=', p);

    let savedAddresses = [];
    try {
        const addrData = await api.get('/user/shipping-addresses');
        savedAddresses = addrData.addresses || [];
        console.log('[AddressPicker] Loaded', savedAddresses.length, 'saved addresses');
    } catch (err) {
        console.warn('[AddressPicker] Could not load shipping addresses:', err.message);
    }

    renderAddressDropdown($container, savedAddresses, p);

    // Show/hide custom fields on dropdown change
    $container.find(`#${p}shipping-address-select`).on('change', function () {
        const val = $(this).val();
        console.log('[AddressPicker] Address selection changed:', val);
        $container.find(`#${p}custom-address-fields`).toggle(val === '__other__');
    });

    // Show/hide save label field
    $container.find(`#${p}save-custom-addr`).on('change', function () {
        $container.find(`#${p}save-addr-label-group`).toggle($(this).is(':checked'));
    });
}

/**
 * Populate the address dropdown with saved addresses.
 *
 * @param {jQuery} $container
 * @param {Array} addresses
 * @param {string} prefix - ID prefix
 */
export function renderAddressDropdown($container, addresses, prefix = '') {
    const p = prefix;
    const $select = $container.find(`#${p}shipping-address-select`);
    let options = '';
    if (addresses.length === 0) {
        options = '<option value="__other__">Enter address...</option>';
        $container.find(`#${p}custom-address-fields`).show();
    } else {
        for (const addr of addresses) {
            const summary = `${addr.label} \u2014 ${addr.name}, ${addr.street1}, ${addr.city}`;
            const selected = addr.is_default ? 'selected' : '';
            options += `<option value="${escapeHtml(addr.id)}" ${selected} data-addr='${escapeHtml(JSON.stringify(addr))}'>${escapeHtml(summary)}</option>`;
        }
        options += '<option value="__other__">Other (enter new address)</option>';
    }
    $select.html(options);
    console.log('[AddressPicker] Dropdown populated with', addresses.length, 'saved addresses');

    // Show custom fields if "Other" is already selected (no saved addresses)
    if ($select.val() === '__other__') {
        $container.find(`#${p}custom-address-fields`).show();
    }
}

/**
 * Extract the currently selected/entered shipping address as a structured object.
 *
 * @param {jQuery} $container
 * @param {object} [opts]
 * @param {string} [opts.idPrefix='']
 * @returns {{ name: string, street1: string, street2: string, city: string, state: string, postal_code: string, country: string, phone_number: string }}
 */
export function getSelectedShippingAddress($container, opts = {}) {
    const p = opts.idPrefix || '';
    const selectVal = $container.find(`#${p}shipping-address-select`).val();
    console.log('[AddressPicker] getSelectedShippingAddress, selectVal=', selectVal);

    if (selectVal === '__other__' || !selectVal) {
        return {
            name: $container.find(`#${p}custom-addr-name`).val().trim(),
            street1: $container.find(`#${p}custom-addr-street1`).val().trim(),
            street2: $container.find(`#${p}custom-addr-street2`).val().trim() || '',
            city: $container.find(`#${p}custom-addr-city`).val().trim(),
            state: $container.find(`#${p}custom-addr-state`).val().trim() || '',
            postal_code: $container.find(`#${p}custom-addr-postal`).val().trim(),
            country: $container.find(`#${p}custom-addr-country`).val().trim().toUpperCase() || 'US',
            phone_number: $container.find(`#${p}custom-addr-phone`).val().trim() || '',
        };
    }

    // Find the selected saved address from the option's data attribute
    const $option = $container.find(`#${p}shipping-address-select option[value="${selectVal}"]`);
    const addrData = JSON.parse($option.attr('data-addr'));
    return {
        name: addrData.name,
        street1: addrData.street1,
        street2: addrData.street2 || '',
        city: addrData.city,
        state: addrData.state || '',
        postal_code: addrData.postal_code,
        country: addrData.country,
        phone_number: addrData.phone_number || '',
    };
}

/**
 * If the user selected "Other" and checked "Save this address", persist it.
 * Call this before submitting an order.
 *
 * @param {jQuery} $container
 * @param {object} [opts]
 * @param {string} [opts.idPrefix='']
 * @returns {Promise<void>}
 */
export async function saveCustomAddressIfRequested($container, opts = {}) {
    const p = opts.idPrefix || '';
    const selectVal = $container.find(`#${p}shipping-address-select`).val();
    if (selectVal !== '__other__') return;
    if (!$container.find(`#${p}save-custom-addr`).is(':checked')) return;

    const label = $container.find(`#${p}custom-addr-label`).val().trim() || 'Saved Address';
    const newAddr = {
        label,
        name: $container.find(`#${p}custom-addr-name`).val().trim(),
        street1: $container.find(`#${p}custom-addr-street1`).val().trim(),
        street2: $container.find(`#${p}custom-addr-street2`).val().trim() || null,
        city: $container.find(`#${p}custom-addr-city`).val().trim(),
        state: $container.find(`#${p}custom-addr-state`).val().trim() || null,
        postal_code: $container.find(`#${p}custom-addr-postal`).val().trim(),
        country: $container.find(`#${p}custom-addr-country`).val().trim().toUpperCase() || 'US',
        phone_number: $container.find(`#${p}custom-addr-phone`).val().trim() || null,
        is_default: false,
    };
    console.log('[AddressPicker] Saving new address before order:', newAddr);
    try {
        await api.post('/user/shipping-addresses', newAddr);
        console.log('[AddressPicker] Address saved for future use');
    } catch (err) {
        console.warn('[AddressPicker] Could not save address (continuing with order):', err.message);
    }
}
