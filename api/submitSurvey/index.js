
const { TABLES, CLASS_PK, ensureTables, client } = require('../shared/storage');
const { parseBody, ok, err, nowIso } = require('../shared/util');

module.exports = async function (context, req) {
  try{
    await ensureTables();
    const body = parseBody(req);

    const token = (body && body.token || '').trim();
    if(!token) throw Object.assign(new Error('Missing token'), { status:400 });

    const tokensClient = client(TABLES.tokens);
    const rosterClient = client(TABLES.roster);
    const responsesClient = client(TABLES.responses);

    // find token entity
    let tokenEnt = null;
    for await (const e of tokensClient.listEntities({ queryOptions:{ filter: `PartitionKey eq '${CLASS_PK}' and RowKey eq '${token}'`}})) { tokenEnt = e; break; }
    if(!tokenEnt) throw Object.assign(new Error('Invalid token'), { status:401 });

    if(tokenEnt.used){
      throw Object.assign(new Error('Token already used'), { status:409 });
    }

    // Validate/normalize payload
    const zone = body.zone || { pref:'any', must:false };
    const seatWish = body.seatWish || null;
    const like = Array.isArray(body.like)? body.like : [];
    const ratherNot = Array.isArray(body.ratherNot)? body.ratherNot : [];
    const mustNot = Array.isArray(body.mustNot)? body.mustNot : [];
    const ratings = Array.isArray(body.ratings)? body.ratings : [];

    // Persist response
    const studentId = tokenEnt.studentId;
    await responsesClient.upsertEntity({
      partitionKey: CLASS_PK,
      rowKey: studentId,
      token,
      seatWish,
      zonePref: zone.pref||'any',
      zoneMust: !!zone.must,
      like: JSON.stringify(like),
      ratherNot: JSON.stringify(ratherNot),
      mustNot: JSON.stringify(mustNot),
      ratings: JSON.stringify(ratings),
      submittedAt: nowIso()
    }, 'Merge');

    // Mark token as used
    await tokensClient.upsertEntity({
      partitionKey: CLASS_PK,
      rowKey: token,
      used: true,
      usedAt: nowIso()
    }, 'Merge');

    context.res = ok({ ok:true });
  }catch(e){
    context.res = err(e);
  }
}
