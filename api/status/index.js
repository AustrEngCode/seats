module.exports = async function (context, req) {
  try {
    const now = new Date().toISOString();

    // Optional: check a few env vars that the app commonly depends on.
    const vars = [
      "ADMIN_PASSWORD",
      "X_ADMIN_KEY",
      "STORAGE_CONNECTION_STRING",
      "S3_ENDPOINT",
      "S3_BUCKET",
      "S3_ACCESS_KEY",
      "S3_SECRET_KEY"
    ];

    const envReport = {};
    for (const v of vars) {
      envReport[v] = process.env[v] ? "present" : "missing";
    }

    context.res = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: {
        ok: true,
        route: "status",
        time: now,
        env: envReport
      }
    };
  } catch (err) {
    context.log.error("Status error:", err);
    context.res = {
      status: 500,
      body: { ok: false, error: String(err && err.message || err) }
    };
  }
};
