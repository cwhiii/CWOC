/**
 * Home page — displays recent projects or sign-in prompt.
 */

import { api } from '../api.js';
import { isAuthenticated } from '../auth.js';
import { showError, renderStatusBadge, escapeHtml } from '../dom.js';
import { navigate } from '../router.js';

export async function render($container, params) {
    console.log('[Home] Rendering home page');

    if (!isAuthenticated()) {
        console.log('[Home] User not authenticated, showing sign-in prompt');
        $container.html(`
            <div class="panel" style="text-align:center; margin-top:3rem;">
                <h1>C.W.'s O-POD</h1>
                <p style="margin:1rem 0;">Open Print-On-Demand — turn public domain texts into printed books.</p>
                <p><a href="/login" class="btn primary">Sign In to Get Started</a></p>
            </div>
        `);
        return;
    }

    $container.html('<p class="loading">Loading your projects...</p>');

    try {
        const data = await api.get('/projects/');
        console.log('[Home] Projects loaded:', data.projects ? data.projects.length : 0);

        const projects = (data.projects || data || []).slice(0, 5);

        if (projects.length === 0) {
            $container.html(`
                <div class="panel">
                    <h1>Welcome to C.W.'s O-POD</h1>
                    <p>You don't have any projects yet.</p>
                    <p style="margin-top:1rem;"><a href="/search" class="btn primary">Search for a Book to Start</a></p>
                </div>
            `);
            return;
        }

        let html = `<h1>Recent Projects</h1><ul class="project-list">`;
        for (const p of projects) {
            html += `
                <li class="project-item" data-id="${escapeHtml(p.id)}">
                    <div>
                        <span class="project-item-title">${escapeHtml(p.title)}</span>
                        <span class="project-item-author">by ${escapeHtml(p.author || 'Unknown Author')}</span>
                    </div>
                    ${renderStatusBadge(p.status)}
                </li>
            `;
        }
        html += `</ul>`;
        html += `<p style="margin-top:1rem;"><a href="/bookshelf">View all projects →</a></p>`;
        $container.html(html);

        // Bind click events
        $container.find('.project-item').on('click', function () {
            const id = $(this).data('id');
            console.log('[Home] Project clicked:', id);
            navigate(`/projects/${id}`);
        });

    } catch (err) {
        console.error('[Home] Failed to load projects:', err.message);
        $container.empty();
        showError($container, 'Failed to load projects: ' + err.message);
    }
}
