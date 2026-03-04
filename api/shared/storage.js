
const { TableClient, TableServiceClient } = require('@azure/data-tables');

const CONN = process.env.STORAGE_CONNECTION_STRING;
const CLASS_PK = 'class1';
const TABLES = {
  roster: 'Roster',
  tokens: 'Tokens',
  responses: 'SurveyResponses',
  settings: 'Settings'
};

function service(){
  if(!CONN) throw new Error('AzureWebJobsStorage is not set');
  return TableServiceClient.fromConnectionString(CONN);
}

function client(table){
  if(!CONN) throw new Error('AzureWebJobsStorage is not set');
  return TableClient.fromConnectionString(CONN, table);
}

async function ensureTables(){
  const svc = service();
  for(const t of Object.values(TABLES)){
    try{ await svc.createTable(t); } catch(e){ /* already exists */ }
  }
}

async function listByPK(table){
  const c = client(table);
  const it = c.listEntities({ queryOptions: { filter: `PartitionKey eq '${CLASS_PK}'` } });
  const out=[]; for await (const e of it) out.push(e); return out;
}

async function upsert(table, entity){
  const c = client(table);
  await c.upsertEntity(entity, 'Merge');
}

async function insertOrReplace(table, entity){
  const c = client(table);
  await c.upsertEntity(entity, 'Replace');
}

async function del(table, pk, rk){
  const c = client(table);
  try{ await c.deleteEntity(pk, rk); }catch(e){ /* ignore */ }
}

module.exports = {
  CLASS_PK,
  TABLES,
  ensureTables,
  client,
  listByPK,
  upsert,
  insertOrReplace,
  del
};
