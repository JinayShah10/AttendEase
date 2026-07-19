/**
 * Shared helper utilities for backend controllers.
 */

/**
 * Sends a 404 Not Found response.
 * @param {object} res - Express response object.
 * @param {string} msg - Error message.
 * @returns {object} Express response.
 */
export function notFound(res, msg) {
  return res.status(404).json({ message: msg });
}

/**
 * Logs an error and sends a 500 Internal Server Error response.
 * @param {object} res - Express response object.
 * @param {Error} err - The caught error.
 * @param {string} [label='Server error'] - Label for logging context.
 * @returns {object} Express response.
 */
import fs from 'fs';

export function serverError(res, err, label = 'Server error') {
  console.error(`${label}:`, err);
  
  const LOG_FILE = process.env.ERROR_LOG_PATH || 'error.log';
  fs.appendFile(
    LOG_FILE, 
    `${new Date().toISOString()} ${label}: ${err.stack || err}\n`,
    (writeErr) => { if (writeErr) console.warn('Failed to write error log:', writeErr); }
  );

  return res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal server error' 
  });
}

/**
 * Finds a document by ID. Returns null and sends 404 if not found.
 * Caller should check: if (!doc) return;
 * @param {import('mongoose').Model} Model - Mongoose model.
 * @param {string} id - Document ID.
 * @param {object} res - Express response object.
 * @param {string} label - Human-readable label for the 404 message.
 * @returns {Promise<object|null>} The document, or null if not found (404 already sent).
 */
export async function findDocumentOrFail(Model, id, res, label) {
  const doc = await Model.findById(id);
  if (!doc) {
    notFound(res, `${label} not found`);
    return null;
  }
  return doc;
}
