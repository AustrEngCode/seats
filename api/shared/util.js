// api/shared/util.js
// Generic helpers: admin auth, ids/tokens, JSON parsing, success/error responses

const { v4: uuidv4 } = require('uuid');

const ADMIN_KEY = process.env.ADMIN_KEY || 'ClassroomAdmin2026';

function requireAdmin(req) {
  const key = String(req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '');
  if (key !== ADMIN_KEY) {
    const e = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }
}

function makeStudentId(i) {
  // s001 … s028 etc.
  return 's' + String(i + 1).padStart(3, '0');
}

function makeToken() {
  // 12-hex token from UUID (no dashes)
  return uuidv4().replace(/-/g, '').slice(0, 12);
}

function nowIso() {
  return new Date().toISOString();
}

function parseBody(req) {
  if (req.body) return req.body;
  try {
    return JSON.parse(req.rawBody || '{}');
  } catch (_) {
    return {};
  }
}

function ok(body) {
  return { status: 200, body };
}

function err(e) {
  const status = e.status || 500;
  return { status, body: { ok: false, error: e.message || 'Server error' } };
}

module.exports = {
  ADMIN_KEY,
  requireAdmin,
  makeStudentId,
  makeToken,
  nowIso,
  parseBody,
  ok,
  err
};
