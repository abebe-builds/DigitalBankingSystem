/**
 * api.js — fetch wrapper for all API calls.
 * Automatically includes session cookie, handles 401 redirect,
 * and parses JSON responses.
 */

const BASE = '/api';

/**
 * Core fetch wrapper.
 * @param {string} path - relative path under /api (e.g. '/auth/me')
 * @param {RequestInit} options
 * @returns {Promise<any>} parsed JSON body
 */
async function request(path, options = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  // 401 → not authenticated → send back to login
  if (res.status === 401) {
    window.location.replace('/login.html');
    throw new Error('Unauthorized');
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: non-JSON response`);
  }

  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}

/**
 * GET /api{path}?{params}
 * @param {string} path
 * @param {Record<string,any>} [params] - query string parameters
 */
function get(path, params) {
  let fullPath = path;
  if (params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
      ),
    ).toString();
    fullPath = `${path}?${qs}`;
  }
  return request(fullPath, { method: 'GET' });
}

/**
 * POST /api{path} with JSON body
 */
function post(path, body) {
  return request(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT /api{path} with JSON body
 */
function put(path, body) {
  return request(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH /api{path} with JSON body
 */
function patch(path, body) {
  return request(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE /api{path}
 */
function del(path, body) {
  return request(path, {
    method: 'DELETE',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const api = { get, post, put, patch, del };
export default api;
