
const { TABLES, CLASS_PK, ensureTables, client, listByPK, insertOrReplace, del } = require('../shared/storage');
const { requireAdmin, makeStudentId, makeToken, nowIso, parseBody, ok, err, buildBaseUrl } = require('../shared/util');

module.exports = async function (context, req) {
  try{
    requireAdmin(req);
    await ensureTables();

    const body = parseBody(req) || {};
    const mode = body.mode || (req.query && req.query.mode);

    if(mode === 'saveRoster'){
      const names = Array.isArray(body.students) ? body.students : [];
      if(names.length===0) throw Object.assign(new Error('No students provided'), { status:400 });

      // Wipe old roster (for class1) and rebuild with stable IDs s001..sNN
      const rosterClient = client(TABLES.roster);
      const old = await listByPK(TABLES.roster);
      for(const e of old){ await del(TABLES.roster, e.partitionKey, e.rowKey); }

      let i=0; for(const name of names){
        const id = makeStudentId(i++);
        await rosterClient.upsertEntity({ partitionKey: CLASS_PK, rowKey: id, name, order: i });
      }
      return context.res = ok({ ok:true, count: names.length });
    }

    if(mode === 'generate'){
      // Create tokens for each roster student
      const roster = await listByPK(TABLES.roster);
      if(roster.length===0) throw Object.assign(new Error('Roster is empty'), { status:400 });
      const tokensClient = client(TABLES.tokens);

      // Remove existing tokens for class1
      const old = await listByPK(TABLES.tokens);
      for(const e of old){ await del(TABLES.tokens, e.partitionKey, e.rowKey); }

      for(const e of roster){
        const token = makeToken();
        await tokensClient.upsertEntity({
          partitionKey: CLASS_PK,
          rowKey: token,
          studentId: e.rowKey,
          name: e.name,
          used: false,
          createdAt: nowIso()
        });
      }

      return context.res = ok({ ok:true, count: roster.length });
    }

    if(mode === 'export'){
      // Export CSV-like rows: name + link
      const roster = await listByPK(TABLES.roster);
      const tokens = await listByPK(TABLES.tokens);
      const tokenByStudent = new Map(tokens.map(t=>[t.studentId, t]));
      const base = buildBaseUrl(req);
      const links = roster.map(r=>{
        const t = tokenByStudent.get(r.rowKey);
        const path = t ? `/s/${t.rowKey}` : '';
        const url = base ? `${base}${path}` : path;
        return { name: r.name, url };
      });
      return context.res = ok({ ok:true, links });
    }

    // Unknown mode
    throw Object.assign(new Error('Unknown mode'), { status:400 });

  }catch(e){
    context.res = err(e);
  }
}
