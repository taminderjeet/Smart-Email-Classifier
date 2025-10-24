// src/services/api.js
// Centralized axios wrapper and API helpers for backend calls.
// Uses REACT_APP_API_URL as the base and sends cookies for session auth.

import axios from 'axios';

// Ensure cookies (like session_id) are sent with requests to the backend
axios.defaults.withCredentials = true;

// Normalize base URL (strip trailing slash) and provide sensible default for local dev
const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

// Axios instance
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  // Increased timeout for Gmail fetch + classification (2 minutes)
  timeout: 120000,
});

// Utility to read gmail token from localStorage
function getAuthToken() {
  try {
    return localStorage.getItem('gmailToken');
  } catch {
    return null;
  }
}

// Auth
export async function getAuthStatus() {
  const res = await api.get('/auth/status');
  return res.data;
}

// For login, callers should navigate the browser to this URL (redirects to Google OAuth)
export function startAuthLogin() {
  return `${API_BASE}/auth/login`;
}

export async function logout() {
  const res = await api.post('/auth/logout');
  return res.data;
}

// Clear user data on backend (processed IDs and emails) when logging out or switching accounts
export async function clearUserData() {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  try {
    const res = await api.post('/clear-user-data', null, { headers });
    return res.data;
  } catch (e) {
    // Best-effort; don't block logout on failure
    return { success: false };
  }
}

// Gmail/email actions
export async function fetchEmails() {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const res = await api.post('/fetch-emails', null, { headers });
  // Expected to return an array of newly classified emails
  return res.data;
}

export async function getAllProcessedEmails() {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const res = await api.get('/emails', { headers });
  return res.data;
}

// Fetch recent Gmail messages and classify only new ones on the backend
export async function fetchAndClassify(options = {}) {
  const { max_results = 15, q } = options || {}; // Reduced default to 15 for faster processing
  const token = getAuthToken();
  if (!token) {
    throw new Error('Missing Gmail token. Please connect Gmail.');
  }

  const headers = { Authorization: `Bearer ${token}` };
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('max_results', String(max_results));
  const url = `/fetch-and-classify?${params.toString()}`;

  try {
    const res = await api.post(url, null, { 
      headers,
      timeout: 300000, // 5 minutes for this specific request
    });
    return res.data; // { new_count, processed: [...] }
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401) {
      throw new Error('Unauthorized. Please reconnect Gmail.');
    }
    const msg = err?.response?.data?.detail || err?.message || 'Request failed';
    throw new Error(`Failed to fetch and classify: ${msg}`);
  }
}

// Classification: send one email to /predict and get top-2 categories
export async function predictEmail(subject, body) {
  const res = await api.post('/predict', { subject, body });
  // Expect an array of labels
  return Array.isArray(res.data) ? res.data : ['General', 'Information'];
}

// Useful exports for advanced consumers
export { api, API_BASE };

export default {
  getAuthStatus,
  startAuthLogin,
  fetchEmails,
  getAllProcessedEmails,
  fetchAndClassify,
  logout,
  clearUserData,
  predictEmail,
  api,
  API_BASE,
};
