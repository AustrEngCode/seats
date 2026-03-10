// api/status/index.js /* (some schemas) */ ;
        if (sid) tokenByStudent.set(String(sid), t);
      }

      const responseByStudent = new Map();
      for (const r of responses) {
        if (!r) continue;
        const sid = r.rowKey || r.RowKey;
        if (sid) responseByStudent.set(String(sid), r);
      }

      const students = roster.map(r => {
        const id = r.rowKey || r.RowKey || '';
        const name = r.name || r.displayName || id || '(unknown)';
        const hadResponse = responseByStudent.has(String(id));
        const tok = tokenByStudent.get(String(id));
        const used = tok ? asBool(tok.used) : false;
        return { id, name, submitted: hadResponse || used };
      });

      const submitted = students.reduce((acc, s) => acc + (s.submitted ? 1 : 0), 0);
      const total = students.length;

      context.res = ok({ ok: true, submitted, total, students });
      return;
    }

    // --------------------------------------------------------------------
    // STUDENT MODE
    // --------------------------------------------------------------------
    const token = req.query && req.query.token ? String(req.query.token).trim() : '';
    if (!token) {
      const e = new Error('Missing token');
      e.status = 400;
      throw e;
    }

    // Point lookup the token (PK + RK)
    const tokensClient = client(TABLES.tokens);
    let tokenEnt = null;
    for await (const e of tokensClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${CLASS_PK}' and RowKey eq '${token}'` }
    })) {
      tokenEnt = e; break;
    }

    if (!tokenEnt) {
      const e = new Error('Invalid token');
      e.status = 401;
      throw e;
    }

    // Load roster; student id is stored on token
    const roster = await listByPK(TABLES.roster);
    const meId = tokenEnt.studentId || tokenEnt.studentID || tokenEnt.sid || '';
    const me = Array.isArray(roster)
      ? roster.find(r => (r.rowKey || r.RowKey) === meId)
      : null;

    // Prior response for this student
    const responsesClient = client(TABLES.responses);
    let resp = null;
    for await (const e of responsesClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${CLASS_PK}' and RowKey eq '${meId}'` }
    })) {
      resp = e; break;
    }

    const students = Array.isArray(roster)
      ? roster.map(r => ({
          id: r.rowKey || r.RowKey,
          name: r.name || r.displayName || (r.rowKey || r.RowKey) || '(unknown)'
        }))
      : [];

    const preselect = resp
      ? { seatWish: resp.seatWish || null, zone: { pref: resp.zonePref || 'any', must: !!resp.zoneMust } }
      : null;

    const alreadySubmitted = !!resp || asBool(tokenEnt.used);

    context.res = ok({
      ok: true,
      student: me
        ? { id: me.rowKey || me.RowKey, name: me.name || me.displayName || (me.rowKey || me.RowKey) }
        : null,
      class: { students },
      preselect,
      alreadySubmitted
    });
  } catch (e) {
    context.res = err(e);
  }
};
``
//   storage.js -> { TABLES, CLASS_PK, ensureTables, client, listByPK }
//   util.js    -> { ok, err, requireAdmin }

const { TABLES, CLASS_PK, ensureTables, client, listByPK } = require('../shared/storage');
const { ok, err, requireAdmin } = require('../shared/util');

// Coerce any "used" variant to a strict boolean
function asBool(val) {
  if (val === true) return true;
  if (val === false) return false;
  if (val === 1 || val === '1') return true;
  if (val === 0 || val === '0') return false;
  if (typeof val === 'string') return val.toLowerCase() === 'true';
  return !!val;
}

module.exports = async function (context, req) {
  try {
    await ensureTables();

    const adminHeader = req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '';
    const isAdminRequest = !!adminHeader;

    // --------------------------------------------------------------------
    // QUICK PROBE (no auth) — confirms header reaches the function:
    //   GET /api/status?echo=1 with x-admin-key
    // --------------------------------------------------------------------
    if (isAdminRequest && req.query && String(req.query.echo) === '1') {
      context.res = ok({ ok: true, mode: 'admin-preauth', sawHeader: true });
      return;
    }

    // --------------------------------------------------------------------
    // ADMIN MODE
    // --------------------------------------------------------------------
    if (isAdminRequest) {
      // Auth: make sure a bad/empty key never shows up as 500
      try {
        requireAdmin(req); // throws {status:401} on mismatch in your util
      } catch (e) {
        e.status = e.status || 401;
        throw e;
      }

      // ------------------------------------------------------------------
      // DIAG MODE — GET /api/status?diag=1 with admin key
      // Tells us exactly which table call fails (or returns counts).
      // ------------------------------------------------------------------
      if (req.query && String(req.query.diag) === '1') {
        const diag = {};
        try {
          const roster = await listByPK(TABLES.roster);
          diag.rosterCount = Array.isArray(roster) ? roster.length : -1;
        } catch (e) {
          diag.rosterError = e?.message || String(e);
        }
        try {
          const tokens = await listByPK(TABLES.tokens);
          diag.tokensCount = Array.isArray(tokens) ? tokens.length : -1;
        } catch (e) {
          diag.tokensError = e?.message || String(e);
        }
        try {
          const responses = await listByPK(TABLES.responses);
          diag.responsesCount = Array.isArray(responses) ? responses.length : -1;
        } catch (e) {
          diag.responsesError = e?.message || String(e);
        }
        // Also confirm STORAGE env presence w/o leaking values
        diag.storageConfigured = !!process.env.STORAGE_CONNECTION_STRING;
        context.res = ok({ ok: true, diag });
        return;
      }

      // ---------- Normal admin summary (hardened) ----------
      const [rosterRaw, tokensRaw, responsesRaw] = await Promise.all([
        listByPK(TABLES.roster),
        listByPK(TABLES.tokens),
        listByPK(TABLES.responses)
      ]);

      const roster = Array.isArray(rosterRaw) ? rosterRaw : [];
      const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];
      const responses = Array.isArray(responsesRaw) ? responsesRaw : [];

      const tokenByStudent = new Map();
      for (const t of tokens) {
        if (!t) continue;
