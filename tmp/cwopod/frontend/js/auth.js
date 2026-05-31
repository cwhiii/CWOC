/**
 * Authentication state management.
 * Checks session status, manages current user, handles logout.
 */

import { api } from './api.js';

let currentUser = null;
let authChangeCallbacks = [];

/**
 * Check authentication status by calling the profile endpoint.
 * @returns {Promise<boolean>} true if authenticated
 */
export async function checkAuth() {
    console.log('[Auth] Checking authentication status...');
    try {
        const profile = await api.get('/user/profile');
        currentUser = profile;
        console.log('[Auth] Authenticated as:', currentUser.email);
        fireAuthChange();
        return true;
    } catch (err) {
        currentUser = null;
        console.log('[Auth] Not authenticated:', err.message);
        fireAuthChange();
        return false;
    }
}

/**
 * Log out the current user.
 */
export async function logout() {
    console.log('[Auth] Logging out...');
    try {
        await api.post('/auth/logout');
        console.log('[Auth] Logout API call succeeded');
    } catch (err) {
        console.warn('[Auth] Logout API call failed (proceeding anyway):', err.message);
    }
    currentUser = null;
    fireAuthChange();
    window.location.href = '/login';
}

/**
 * @returns {boolean} Whether the user is currently authenticated
 */
export function isAuthenticated() {
    return currentUser !== null;
}

/**
 * @returns {boolean} Whether the current user is an admin
 */
export function isAdmin() {
    return currentUser !== null && currentUser.is_admin === true;
}

/**
 * Get the current user object.
 * @returns {object|null} User profile or null
 */
export function getUser() {
    return currentUser;
}

/**
 * Register a callback for auth state changes.
 * @param {Function} cb - Called with (currentUser) when auth state changes
 */
export function onAuthChange(cb) {
    authChangeCallbacks.push(cb);
}

function fireAuthChange() {
    for (const cb of authChangeCallbacks) {
        try {
            cb(currentUser);
        } catch (err) {
            console.error('[Auth] Auth change callback error:', err);
        }
    }
}
