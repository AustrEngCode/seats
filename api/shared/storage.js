// api/shared/storage.js
// Azure Table Storage helpers for SWA-managed Functions (Node 18)

const { TableClient, TableServiceClient } = require('@azure/data-tables');

const CONN = process.env.STORAGE_CONNECTION_STRING; // <-- set in SWA environment variables
const CLASS_PK = 'class1'; // single-class setup

const TABLES = {
  roster: 'Roster',
  tokens: 'Tokens',
  responses: 'SurveyResponses',
  settings: 'Settings'
};

function service() {
  if (!CONN) throw new Error('STORAGE_CONNECTION_STRING is not set');
  return TableServiceClient.fromConnectionString(CONN);
}

function client(tableName) {
  if (!CONN) throw new Error('STORAGE_CONNECTION_STRING is not set');
  return TableClient.fromConnectionString(CONN, tableName);
}

async function ensureTables() {
  const svc = service();
  for (const t of Object.values(TABLES)) {
    try {
      await svc.createTable(t);
    } catch (_) {
      // ignore if table already exists
    }
  }
}

async function listByPK(tableName) {
  const c = client(tableName);
  const out = [];
  const filter = `PartitionKey eq '${CLASS_PK}'`;
  for await (const ent of c.listEntities({ queryOptions: { filter } })) {
    out.push(ent);
  }
  return out;
}

async function upsert(tableName, entity, mode = 'Merge') {
  const c = client(tableName);
  await c.upsertEntity(entity, mode);
}

async function insertOrReplace(tableName, entity) {
  return upsert(tableName, entity, 'Replace');
}

async function del(tableName, pk, rk) {
  const c = client(tableName);
  try {
    await c.deleteEntity(pk, rk);
  } catch (_) {
    // ignore if not found
  }
}

module.exports = {
  TABLES,
  CLASS_PK,
  ensureTables,
  client,
  listByPK,
  upsert,
  insertOrReplace,
  del
};
``
