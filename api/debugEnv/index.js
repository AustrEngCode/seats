
module.exports = async function (context, req) {
  const hasConn  = !!process.env.STORAGE_CONNECTION_STRING;
  const hasAdmin = !!process.env.ADMIN_KEY;
  context.res = {
    status: 200,
    body: {
      ok: true,
      hasConn,
      hasAdmin,
      node: process.version
    }
  };
};
