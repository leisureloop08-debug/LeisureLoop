const { db, json, method, getCookie, hashToken, clearSessionCookie } = require("./_lib/auth");
module.exports = async (req, res) => {
  if (!method(req, res, "POST")) return;
  try {
    const token = getCookie(req, "ll_session");
    if (token) await db().query("delete from app_sessions where token_hash=$1", [hashToken(token)]);
    clearSessionCookie(res);
    return json(res, 200, { message: "Signed out." });
  } catch (error) {
    console.error("auth-logout:", error.message);
    clearSessionCookie(res);
    return json(res, 500, { error: "Unable to sign out cleanly." });
  }
};
