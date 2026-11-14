const { argon2, db, json, method, body, hashToken } = require("./_lib/auth");
module.exports = async (req, res) => {
  if (!method(req, res, "POST")) return;
  try {
    const input = body(req);
    const token = typeof input.token === "string" ? input.token : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!token || token.length > 200 || password.length < 8 || password.length > 128) {
      return json(res, 400, { error: "Use a valid reset link and a password of at least 8 characters." });
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const client = await db().connect();
    try {
      await client.query("begin");
      const found = await client.query(
        `select user_id from app_email_tokens where token_hash=$1 and purpose='password_reset'
         and consumed_at is null and expires_at>now() for update`,
        [hashToken(token)]
      );
      if (!found.rows[0]) {
        await client.query("rollback");
        return json(res, 400, { error: "This reset link is invalid, expired or already used." });
      }
      const userId = found.rows[0].user_id;
      await client.query("update app_users set password_hash=$1,updated_at=now() where id=$2", [passwordHash, userId]);
      await client.query("update app_email_tokens set consumed_at=now() where token_hash=$1", [hashToken(token)]);
      await client.query("delete from app_sessions where user_id=$1", [userId]);
      await client.query("commit");
      return json(res, 200, { message: "Password updated. Please sign in with your new password." });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("auth-reset-password:", error.message);
    return json(res, 500, { error: "Unable to reset your password right now." });
  }
};
