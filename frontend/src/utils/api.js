/**
 * Centralized API layer for all frontend fetch calls.
 * Implements automatic token refresh on 401 responses.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// In-memory access token (not in localStorage for security)
let accessToken = localStorage.getItem('djsce-token') || null;

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshSubscribers = [];

/**
 * Subscribe to the refresh event. When a refresh completes,
 * all queued requests are retried with the new token.
 */
function subscribeTokenRefresh(callback) {
  refreshSubscribers.push(callback);
}

function onRefreshed(newToken) {
  refreshSubscribers.forEach(cb => cb(newToken));
  refreshSubscribers = [];
}

/**
 * Sets the access token in memory and localStorage (for page reload persistence).
 */
export function setAccessToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem('djsce-token', token);
  } else {
    localStorage.removeItem('djsce-token');
  }
}

export function getAccessToken() {
  return accessToken;
}

/**
 * Attempts to refresh the access token using the httpOnly refresh cookie.
 * Returns the new access token or null if refresh failed.
 */
async function attemptTokenRefresh() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Send the httpOnly cookie
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.token) {
      setAccessToken(data.token);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Internal helper — performs a fetch with auth, handles 401 with auto-refresh.
 * @param {string} url - Full URL to fetch.
 * @param {object} [options] - Fetch options (method, headers, body, etc.).
 * @returns {Promise<any>} Parsed JSON response.
 */
async function request(url, options = {}) {
  // Attach access token to all requests if available
  if (accessToken) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    };
  }

  // Always include credentials so httpOnly cookies are sent
  options.credentials = 'include';

  let res = await fetch(url, options);

  // If 401 (token expired), attempt a silent refresh
  if (res.status === 401 && accessToken) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await attemptTokenRefresh();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(newToken);

        // Retry the original request with the new token
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`
        };
        res = await fetch(url, options);
      } else {
        // Refresh failed — user needs to log in again
        setAccessToken(null);
        localStorage.removeItem('djsce-auth-session');
        window.dispatchEvent(new Event('auth:session-expired'));
        throw new Error('Session expired. Please log in again.');
      }
    } else {
      // Another request is already refreshing; queue this one
      const retryToken = await new Promise(resolve => {
        subscribeTokenRefresh(resolve);
      });

      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${retryToken}`
      };
      res = await fetch(url, options);
    }
  }

  if (!res.ok) {
    let errMsg = res.statusText;
    try {
      const data = await res.json();
      if (data && data.message) {
        errMsg = data.message;
      } else if (data && data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        errMsg = data.errors.map(err => err.message || err.msg).join(', ');
      }
    } catch { /* ignore body parse error */ }
    throw new Error(errMsg);
  }
  return res.json();
}

// ═══════════════════════════════════
//  AUTH
// ═══════════════════════════════════

/** POST /api/auth/login */
export const loginUser = (email, password) =>
  request(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

/** POST /api/auth/register */
export const registerUser = (data) =>
  request(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

/** POST /api/auth/refresh */
export const refreshToken = () =>
  request(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
  });

/** POST /api/auth/logout */
export const logoutUser = () =>
  request(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
  });

// ═══════════════════════════════════
//  ADMIN
// ═══════════════════════════════════

/** GET /api/admin/profile/:adminId */
export const fetchAdminProfile = (adminId) =>
  request(`${API_BASE}/api/admin/profile/${adminId}`);

/** GET /api/admin/:adminId/uploads */
export const fetchAdminUploads = (adminId) =>
  request(`${API_BASE}/api/admin/${adminId}/uploads`);

/** GET /api/admin/faculty-count?adminId=... */
export const fetchFacultyCount = (adminId) =>
  request(`${API_BASE}/api/admin/faculty-count?adminId=${adminId}`);

/** GET /api/admin/faculty-all?adminId=... */
export const fetchAllFaculty = (adminId) =>
  request(`${API_BASE}/api/admin/faculty-all?adminId=${adminId}`);

/** POST /api/admin/clear-data */
export const clearAllData = (email, password, confirmPhrase) =>
  request(`${API_BASE}/api/admin/clear-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, confirmPhrase }),
  });

/** POST /api/admin/reset-database */
export const resetDatabase = (email, password, confirmPhrase) =>
  request(`${API_BASE}/api/admin/reset-database`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, confirmPhrase }),
  });

// ═══════════════════════════════════
//  REPORTS
// ═══════════════════════════════════

/** GET /api/report/consolidated?classYear=...&division=... */
export const fetchConsolidatedReport = (classYear, division) =>
  request(`${API_BASE}/api/report/consolidated?classYear=${classYear}&division=${division}`);

/** POST /api/report/generate/:uploadId */
export const generateUploadReport = (uploadId) =>
  request(`${API_BASE}/api/report/generate/${uploadId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });


// ═══════════════════════════════════
//  STUDENTS
// ═══════════════════════════════════

/** GET /api/students/list?classYear=...&division=... */
export const fetchStudentsList = (classYear, division) =>
  request(`${API_BASE}/api/students/list?classYear=${classYear}&division=${division}`);

/** POST /api/students/upload (multipart form data) */
export const uploadStudentList = (formData) =>
  request(`${API_BASE}/api/students/upload`, {
    method: 'POST',
    body: formData,
  });

// ═══════════════════════════════════
//  MASTER DATA
// ═══════════════════════════════════

/** GET /api/master/subjects */
export const fetchMasterSubjects = () =>
  request(`${API_BASE}/api/master/subjects`);

/** GET /api/master/classes */
export const fetchMasterClasses = () =>
  request(`${API_BASE}/api/master/classes`);

/** GET /api/master/oe-subjects */
export const fetchOESubjects = () =>
  request(`${API_BASE}/api/master/oe-subjects`);

/** GET /api/master/pe-subjects */
export const fetchPESubjects = () =>
  request(`${API_BASE}/api/master/pe-subjects`);

// ═══════════════════════════════════
//  FACULTY / UPLOADS
// ═══════════════════════════════════

/** GET /api/auth/profile/faculty/:id */
export const fetchFacultyProfile = (facultyId) =>
  request(`${API_BASE}/api/auth/profile/faculty/${facultyId}`);

/** GET /api/upload/faculty/:facultyId */
export const fetchFacultyUploads = (facultyId) =>
  request(`${API_BASE}/api/upload/faculty/${facultyId}`);

/** POST /api/upload (multipart form data) */
export const uploadAttendanceFile = (formData) =>
  request(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  });

/** DELETE /api/upload/:id */
export const deleteFacultyUpload = (fileId) =>
  request(`${API_BASE}/api/upload/${fileId}`, {
    method: 'DELETE',
  });

/** PUT /api/auth/profile */
export const updateProfile = (profileData) =>
  request(`${API_BASE}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileData),
  });

/** POST /api/auth/change-password */
export const changePassword = (passwordData) =>
  request(`${API_BASE}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(passwordData),
  });

/** POST /api/auth/forgot-password */
export const forgotPassword = (forgotData) =>
  request(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(forgotData),
  });

export const deleteAccount = (password) =>
  request(`${API_BASE}/api/auth/delete-account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
