const { argon2, db, json, method, body, normalizeEmail, validEmail, createSession, publicUser } = require("./_lib/auth");

module.exports = async (req, res) => {
  if (!method(req, res, "POST")) return;
  try {
    const input = body(req);
    const email = normalizeEmail(input.email);
    const password = typeof input.password === "string" ? input.password : "";
    if (!validEmail(email) || !password || password.length > 128) {
      return json(res, 400, { error: "Enter your email and password." });
    }
    const result = await db().query(
      "select * from app_users where email=$1 and disabled_at is null limit 1",
      [email]
    );
    const user = result.rows[0];
    const valid = user ? await argon2.verify(user.password_hash, password).catch(() => false) : false;
    if (!valid) return json(res, 401, { error: "Incorrect email or password." });
    if (!user.email_verified_at) return json(res, 403, { error: "Please verify your email before signing in." });
    await createSession(user.id, res);
    return json(res, 200, { user: publicUser(user) });
  } catch (error) {
    console.error("auth-login:", error.message);
    return json(res, error.statusCode || 500, { error: "Unable to sign in right now." });
  }
};
