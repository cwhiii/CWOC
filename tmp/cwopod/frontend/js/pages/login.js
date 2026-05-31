/**
 * Login page — sign in or register.
 */

import { api } from '../api.js';
import { showError, clearMessages, setLoading, escapeHtml } from '../dom.js';

export async function render($container, params) {
    console.log('[Login] Rendering login page');

    let mode = 'login'; // 'login' or 'register'
    let registrationOpen = true; // default to true until we check

    // Check if public registration is allowed
    try {
        const status = await api.get('/auth/registration-status');
        registrationOpen = status.registration_open;
        console.log('[Login] Registration open:', registrationOpen);
    } catch (err) {
        console.warn('[Login] Could not check registration status:', err.message);
    }

    function renderForm() {
        const title = mode === 'login' ? 'Sign In' : 'Create Account';
        const btnText = mode === 'login' ? 'Sign In' : 'Register';
        const toggleText = mode === 'login' && registrationOpen
            ? 'Don\'t have an account? <a id="toggle-mode">Register</a>'
            : mode === 'register'
                ? 'Already have an account? <a id="toggle-mode">Sign In</a>'
                : '';

        $container.html(`
            <div class="login-container">
                <div class="panel">
                    <h1 style="text-align:center;">${title}</h1>
                    <form id="login-form" style="margin-top:1.5rem;">
                        <div class="form-group">
                            <label for="email">Username</label>
                            <input type="text" id="email" name="email" maxlength="254" required autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label for="password">Password</label>
                            <input type="password" id="password" name="password" maxlength="128" required autocomplete="current-password">
                        </div>
                        <button type="submit" class="btn primary" style="width:100%;" id="submit-btn">${btnText}</button>
                    </form>
                    <p class="login-toggle">${toggleText}</p>
                </div>
            </div>
        `);

        // Bind toggle
        $(document).off('click.logintoggle');
        $(document).on('click.logintoggle', '#toggle-mode', (e) => {
            e.preventDefault();
            mode = mode === 'login' ? 'register' : 'login';
            console.log('[Login] Mode toggled to:', mode);
            renderForm();
        });

        // Bind form submit via document delegation
        $(document).off('submit.loginform');
        $(document).on('submit.loginform', '#login-form', handleSubmit);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const $form = $container.find('#login-form');
        const email = $form.find('#email').val().trim();
        const password = $form.find('#password').val();

        console.log(`[Login] Attempting ${mode} for:`, email);
        clearMessages($container.find('.panel'));

        // Client-side validation for registration
        if (mode === 'register' && password.length < 8) {
            showError($container.find('.panel'), 'Password must be at least 8 characters.');
            return;
        }

        const $btn = $container.find('#submit-btn');
        setLoading($btn, true, mode === 'login' ? 'Signing in...' : 'Registering...');

        try {
            const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
            await api.post(endpoint, { email, password });
            console.log(`[Login] ${mode} succeeded for:`, email);
            // Full page reload to home
            window.location.href = '/';
        } catch (err) {
            console.error(`[Login] ${mode} failed:`, err.message);
            showError($container.find('.panel'), err.message);
            setLoading($btn, false);
        }
    }

    renderForm();
}
