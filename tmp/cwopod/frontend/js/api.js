/**
 * API client for communicating with the CWOPOD backend.
 * EXHAUSTIVE LOGGING — every step is logged to browser console.
 */

const BASE_URL = '/api';

function generateRequestId() {
    return Math.random().toString(36).substring(2, 8);
}

async function request(path, options = {}) {
    const { method = 'GET', body, noRedirectOn401 = false } = options;
    const url = `${BASE_URL}${path}`;
    const requestId = generateRequestId();

    console.log(`[API][${requestId}] >>> ${method} ${url} — STARTING`);
    if (body) {
        console.log(`[API][${requestId}] Request body:`, JSON.stringify(body));
    }

    const config = {
        method,
        credentials: 'include',
        headers: {}
    };

    if (body !== undefined && body !== null) {
        config.headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(body);
    }

    const startTime = performance.now();
    let response;

    try {
        response = await fetch(url, config);
    } catch (err) {
        const elapsed = Math.round(performance.now() - startTime);
        console.error(`[API][${requestId}] NETWORK ERROR after ${elapsed}ms:`, err.message, err);
        console.error(`[API][${requestId}] This means the request never got a response — DNS failure, connection refused, CORS block, or server unreachable`);
        throw err;
    }

    const elapsed = Math.round(performance.now() - startTime);
    console.log(`[API][${requestId}] Got response: status=${response.status}, elapsed=${elapsed}ms`);

    if (!response.ok) {
        console.error(`[API][${requestId}] HTTP ERROR: status=${response.status}`);
        const text = await response.text();
        console.error(`[API][${requestId}] Error response body (raw):`, text);

        // Handle session expiry — redirect to login on 401
        // Skip redirect for auth-checking endpoints (profile check on page load)
        // Skip redirect for background/fire-and-forget calls (noRedirectOn401=true)
        if (response.status === 401 && !path.startsWith('/auth/') && path !== '/user/profile' && !noRedirectOn401) {
            console.warn(`[API][${requestId}] Session expired — redirecting to login`);
            window.location.href = '/login';
            throw new Error('Session expired');
        }
        if (response.status === 401 && noRedirectOn401) {
            console.warn(`[API][${requestId}] Session expired — noRedirectOn401=true, skipping redirect (background call)`);
        }

        let detail = `HTTP ${response.status}`;
        let errorData = {};
        try {
            const parsed = JSON.parse(text);
            errorData = parsed;
            if (Array.isArray(parsed.detail)) {
                detail = parsed.detail.map(d => d.msg || JSON.stringify(d)).join('; ');
            } else if (parsed.detail && typeof parsed.detail === 'object') {
                detail = parsed.detail.error || parsed.detail.message || JSON.stringify(parsed.detail);
            } else {
                detail = parsed.detail || detail;
            }
            if (parsed.traceback) {
                console.error(`[API][${requestId}] SERVER TRACEBACK:\n${parsed.traceback}`);
            }
            if (parsed.path) {
                console.error(`[API][${requestId}] Server error on: ${parsed.method} ${parsed.path}`);
            }
        } catch {
            detail = text || detail;
        }
        console.error(`[API][${requestId}] Throwing error: "${detail}"`);
        const error = new Error(detail);
        error.data = errorData;
        error.status = response.status;
        throw error;
    }

    // Handle 204 No Content
    if (response.status === 204) {
        console.log(`[API][${requestId}] 204 No Content — returning undefined`);
        return undefined;
    }

    const text = await response.text();
    
    // Handle empty body (some 200/201 responses may have no body)
    if (!text || !text.trim()) {
        console.log(`[API][${requestId}] <<< ${method} ${url} — SUCCESS with empty body (${elapsed}ms)`);
        return undefined;
    }
    
    console.log(`[API][${requestId}] Response body (first 300 chars):`, text.substring(0, 300));

    try {
        const parsed = JSON.parse(text);
        console.log(`[API][${requestId}] <<< ${method} ${url} — SUCCESS (${elapsed}ms)`);
        return parsed;
    } catch (err) {
        console.error(`[API][${requestId}] JSON PARSE FAILED. Raw response:`, text.substring(0, 500));
        console.error(`[API][${requestId}] Parse error:`, err.message);
        throw err;
    }
}

export const api = {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path) => request(path, { method: 'DELETE' }),
    // Background variant — 401 does NOT redirect to login (for fire-and-forget calls like render-preview)
    postBackground: (path, body) => request(path, { method: 'POST', body, noRedirectOn401: true })
};
