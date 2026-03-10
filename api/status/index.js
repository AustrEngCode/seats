// api/status/index.js
// Requires your existing helpers:
//   api/shared/storage.js  -> exports: { TABLES, CLASS_PK, ensureTables, client, listByPK }
//   api/shared/util.js     -> exports: { ok, err, requireAdmin }

const { TABLES, CLASS_PK, ensureTables, client, listByPK } = require('../shared/storage');
const { ok, err, requireAdmin } = require('../shared/util');

module.exports = async function (context, req) {
  try {
    await ensureTables();

    const isAdminRequest =
      !!(req.headers['x-admin-key'] || req.headers['X-Admin-Key']);

    if (isAdminRequest) {
      // Will throw 401 if the key is wrong; caught below.
      requireAdmin(req);

      // Admin summary: roster + tokens + responses
      const [roster, tokens, responses] = await Promise.all([
        listByPK(TABLES.roster),
        listByPK(TABLES.tokens),
        listByPK(TABLES.responses)
      ]);

      const tokenByStudent = new Map(tokens.map(t => [t.studentId, t]));
      const responseByStudent = new Map(responses.map(r => [r.rowKey, r]));

      const students = roster.map(r => ({
        id: r.rowKey,
        name: r.name,
        submitted: !!responseByStudent.get(r.rowKey) || !!(tokenByStudent.get(r.rowKey)?.used)
      }));

      const submitted = students.filter(s => s.submitted).length;
      const total = students.length;

      context.res = ok({ ok: true, submitted, total, students });
      return;
    }

    // Student mode: require ?token=...
    const token = (req.query && req.query.token ? String(req.query.token) : '').trim();
    if (!token) {
      const e = new Error('Missing token');
      e.status = 400;
      throw e;
    }

    // Look up the token entity
    const tokensClient = client(TABLES.tokens);
    let tokenEnt = null;
    for await (const e of tokensClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${CLASS_PK}' and RowKey eq '${token}'` }
    })) {
      tokenEnt = e;
      break;
    }
    if (!tokenEnt) {
      const e = new Error('Invalid token');
      e.status = 401;
      throw e;
    }

    // Load roster and (optionally) existing response for this student
    const roster = await listByPK(TABLES.roster);
    const meId = tokenEnt.studentId;
    const me = roster.find(r => r.rowKey === meId);

    const responsesClient = client(TABLES.responses);
    let resp = null;
    for await (const e of responsesClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${CLASS_PK}' and RowKey eq '${meId}'` }
    })) {
      resp = e;
      break;
    }

    const students = roster.map(r => ({ id: r.rowKey, name: r.name }));
    const preselect = resp
      ? {
          seatWish: resp.seatWish || null,
          zone: { pref: resp.zonePref || 'any', must: !!resp.zoneMust }
        }
      : null;
    const alreadySubmitted = !!resp || !!tokenEnt.used;

    context.res = ok({
      ok: true,
      student: me ? { id: me.rowKey, name: me.name } : null,
      class: { students },
      preselect,
      alreadySubmitted
    });
  } catch (e) {
    context.res = err(e);
  }
};
