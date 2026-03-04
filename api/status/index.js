
const { TABLES, CLASS_PK, ensureTables, client, listByPK } = require('../shared/storage');
const { ok, err, requireAdmin } = require('../shared/util');

module.exports = async function (context, req) {
  try{
    await ensureTables();
    const q = req.query || {};

    const adminHeader = req.headers['x-admin-key'] || req.headers['X-Admin-Key'];
    const isAdmin = !!adminHeader;

    if(isAdmin){
      try{ requireAdmin(req); }catch(e){ throw e; }
      const roster = await listByPK(TABLES.roster);
      const tokens = await listByPK(TABLES.tokens);
      const responses = await listByPK(TABLES.responses);
      const tokenByStudent = new Map(tokens.map(t=>[t.studentId, t]));
      const responseByStudent = new Map(responses.map(r=>[r.rowKey, r]));

      const students = roster.map(r=>({
        id: r.rowKey,
        name: r.name,
        submitted: !!responseByStudent.get(r.rowKey) || !!(tokenByStudent.get(r.rowKey)?.used)
      }));

      const submitted = students.filter(s=>s.submitted).length;
      const total = students.length;
      return context.res = ok({ ok:true, submitted, total, students });
    }

    // Student mode via token
    const token = (q.token||'').trim();
    if(!token) throw Object.assign(new Error('Missing token'), { status:400 });

    const tokensClient = client(TABLES.tokens);
    let tokenEnt = null;
    for await (const e of tokensClient.listEntities({ queryOptions:{ filter: `PartitionKey eq '${CLASS_PK}' and RowKey eq '${token}'`}})) { tokenEnt = e; break; }
    if(!tokenEnt) throw Object.assign(new Error('Invalid token'), { status:401 });

    const roster = await listByPK(TABLES.roster);

    // Build response structure
    const meId = tokenEnt.studentId;
    const me = roster.find(r=>r.rowKey===meId);
    const students = roster.map(r=>({ id: r.rowKey, name: r.name }));

    const responsesClient = client(TABLES.responses);
    let resp = null;
    for await (const e of responsesClient.listEntities({ queryOptions:{ filter: `PartitionKey eq '${CLASS_PK}' and RowKey eq '${meId}'`}})) { resp = e; break; }

    const preselect = resp ? {
      seatWish: resp.seatWish || null,
      zone: { pref: resp.zonePref || 'any', must: !!resp.zoneMust }
    } : null;

    const alreadySubmitted = !!resp || !!tokenEnt.used;

    return context.res = ok({
      ok:true,
      student: { id: me.rowKey, name: me.name },
      class: { students },
      preselect,
      alreadySubmitted
    });

  }catch(e){
    context.res = err(e);
  }
}
