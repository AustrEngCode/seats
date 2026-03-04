
const { v4: uuidv4 } = require('uuid');
const ADMIN_KEY = process.env.ADMIN_KEY || 'ClassroomAdmin2026';

function requireAdmin(req){
  const key = (req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '').toString();
  if(key !== ADMIN_KEY) throw Object.assign(new Error('Unauthorized'), { status: 401 });
}

function makeStudentId(i){
  return 's' + String(i+1).padStart(3,'0');
}

function makeToken(){
  return uuidv4().replace(/-/g,'').slice(0,12);
}

function nowIso(){ return new Date().toISOString(); }

function parseBody(req){
  if(req.body) return req.body;
  try{ return JSON.parse(req.rawBody||'{}'); }catch(_){ return {}; }
}

function ok(body){ return { status:200, body } }
function err(e){
  const status = e.status || 500;
  return { status, body: { ok:false, error: e.message || 'Server error' } };
}

function buildBaseUrl(req){
  const host = req.headers['x-forwarded-host'] || req.headers['host'];
  const proto = req.headers['x-forwarded-proto'] || 'https';
  if(!host) return '';
  return `${proto}://${host}`;
}

module.exports = { ADMIN_KEY, requireAdmin, makeStudentId, makeToken, nowIso, parseBody, ok, err, buildBaseUrl };
