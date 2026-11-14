const { db, json, method, body, hashToken } = require("./_lib/auth");
module.exports = async (req, res) => {
  if (!method(req, res, "POST")) return;
  try {
    const token = typeof body(req).token === "string" ? body(req).token : "";
    if (!token || token.length > 200) return json(res, 400, { error: "Invalid verification link." });
    const result = await db().query(
      `update app_users u set email_verified_at=coalesce(email_verified_at,now()),updated_at=now()
       from app_email_tokens t
       where t.user_id=u.id and t.token_hash=$1 and t.purpose='email_verification'
         and t.consumed_at is null and t.expires_at>now()
       returning u.id`,
      [hashToken(token)]
    );
    if (!result.rows[0]) return json(res, 400, { error: "This verification link is invalid, expired or already used." });
    await db().query("update app_email_tokens set consumed_at=now() where token_hash=$1", [hashToken(token)]);
    return json(res, 200, { message: "Email verified. You can now sign in." });
  } catch (error) {
    console.error("auth-verify-email:", error.message);
    return json(res, 500, { error: "Unable to verify this email right now." });
  }
};
