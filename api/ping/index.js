module.exports = async function (context, req) {
  const adminHeader = req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '';
  const sawHeader = !!adminHeader;
  context.res = {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      route: 'ping',
      sawHeader,
      echo: req.query && req.query.echo ? String(req.query.echo) : null,
      build: new Date().toISOString(),
      // Do NOT read storage here; just tell us whether the setting exists:
      storageConfigured: !!process.env.STORAGE_CONNECTION_STRING
    })
  };
};
