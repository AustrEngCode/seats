// api/generateTokens/index.js
// Requires the shared helpers you already added:
//   api/shared/storage.js -> { TABLES, CLASS_PK, ensureTables, client, listByPK, del }
//   api/shared/util.js    -> { requireAdmin, parseBody, ok, err, makeStudentId, makeToken, nowIso }

const { TABLES, CLASS_PK, ensureTables, client, listByPK, del } = require('../shared/storage');
const { requireAdmin, parseBody, ok, err, makeStudentId, makeToken, nowIso } = require('../shared/util');

module.exports = async function (context, req) {
  try {
    // Only admins may use these endpoints
    requireAdmin(req);

    await ensureTables();

    const body = parseBody(req) || {};
    const mode = (body.mode || req.query?.mode || '').trim();

    if (mode === 'saveRoster') {
      // Expect body.students = [ "26-PS", "27-GS", ... ]
      const names = Array.isArray(body.students) ? body.students.map(s => String(s).trim()).filter(Boolean) : [];
      if (names.length === 0) {
        const e = new Error('No students provided');
        e.status = 400;
        throw e;
      }

      // Wipe old roster for class1 and rebuild with stable IDs s001..sNN
      const rosterClient = client(TABLES.roster);
      const old = await listByPK(TABLES.roster);
      for (const ent of old) {
        await del(TABLES.roster, ent.partitionKey, ent.rowKey);
      }

      let i = 0;
      for (const name of names) {
        const id = makeStudentId(i++);
        await rosterClient.upsertEntity({
          partitionKey: CLASS_PK,
          rowKey: id,
          name,
          order: i
        }, 'Merge');
      }

      context.res = ok({ ok: true, count: names.length });
      return;
    }

    if (mode === 'generate') {
      // Create fresh tokens for each roster entry
      const roster = await listByPK(TABLES.roster);
      if (roster.length === 0) {
        const e = new Error('Roster is empty');
        e.status = 400;
        throw e;
      }

      const tokensClient = client(TABLES.tokens);
      const old = await listByPK(TABLES.tokens);
      for (const ent of old) {
        await del(TABLES.tokens, ent.partitionKey, ent.rowKey);
      }

      for (const r of roster) {
        const token = makeToken();
        await tokensClient.upsertEntity({
          partitionKey: CLASS_PK,
          rowKey: token,
          studentId: r.rowKey,
          name: r.name,
          used: false,
          createdAt: nowIso()
        }, 'Merge');
      }

      context.res = ok({ ok: true, count: roster.length });
      return;
    }

    if (mode === 'export') {
      // Return link list for CSV
      const roster = await listByPK(TABLES.roster);
      const tokens = await listByPK(TABLES.tokens);
      const tokenByStudent = new Map(tokens.map(t => [t.studentId, t]));

      const host = req.headers['x-forwarded-host'] || req.headers['host'];
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const base = host ? `${proto}://${host}` : '';

      const links = roster.map(r => {
        const t = tokenByStudent.get(r.rowKey);
        const url = t ? `${base}/s/${t.rowKey}` : '';
        return { name: r.name, url };
      });

      context.res = ok({ ok: true, links });
      return;
    }

    // If no mode matched
    {
      const e = new Error('Unknown mode');
      e.status = 400;
      throw e;
    }

  } catch (e) {
    context.res = err(e);
  }
};
``
