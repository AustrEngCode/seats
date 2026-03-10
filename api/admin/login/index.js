const crypto = require("crypto");

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

module.exports = async function (context, req) {
  try {
    const expected = process.env.ADMIN_PASSWORD || "";
    if (!expected) {
      context.res = { status: 500, body: { ok: false, error: "ADMIN_PASSWORD not set" } };
      return;
    }

    const body = req.body || {};
    const input = body.password ? String(body.password) : "";

    if (!timingSafeEqualStr(input, expected)) {
      context.res = { status: 401, body: { ok: false, error: "Invalid password" } };
      return;
    }

    const token = "admin-" + crypto.randomBytes(24).toString("base64url");

    context.res = {
      status: 200,
      headers: {
        "set-cookie": `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
        "content-type": "application/json"
      },
      body: { ok: true }
    };

  } catch (err) {
    context.log.error("admin/login error:", err);
    context.res = { status: 500, body: { ok: false, error: String(err) } };
  }
};
