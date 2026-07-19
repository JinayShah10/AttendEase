import AuditLog from '../models/AuditLog.js';

/**
 * Logs a sensitive action to the AuditLog collection.
 * 
 * @param {Object} req - Express request object (used to extract IP and user info).
 * @param {string} action - The action type (must match AuditLog enum).
 * @param {Object} details - Additional context for the log entry.
 * @param {string} [details.targetCollection] - The collection affected.
 * @param {number} [details.recordCount] - Number of records affected.
 * @param {string} [details.message] - Human-readable description.
 * @param {string} [details.userEmail] - Override email (e.g., for failed logins where req.user doesn't exist).
 * @param {string} [details.userId] - Override userId.
 */
export async function logAction(req, action, details = {}) {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    
    const entry = new AuditLog({
      userId: details.userId || req.user?.id || null,
      userEmail: details.userEmail || req.user?.email || 'unknown',
      action,
      details: details.message || '',
      targetCollection: details.targetCollection || null,
      recordCount: details.recordCount || 0,
      ipAddress,
      timestamp: new Date()
    });

    await entry.save();
  } catch (err) {
    // Audit logging should never crash the main request flow
    console.error('[AUDIT LOG ERROR]', err.message);
  }
}
