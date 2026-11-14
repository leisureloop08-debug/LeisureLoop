const { db, json, method, body, normalizeEmail, validEmail, appOrigin, sendMail, createEmailToken } = require("./_lib/auth");
module.exports = async (req, res) => {
  if (!method(req, res, "POST")) return;
  try {
    const email = normalizeEmail(body(req).email);
    if (!validEmail(email)) return json(res, 400, { error: "Enter a valid email address." });
    const result = await db().query("select id,full_name from app_users where email=$1 and disabled_at is null limit 1", [email]);
    if (result.rows[0]) {
      const token = await createEmailToken(result.rows[0].id, "password_reset", 30);
      const link = `${appOrigin()}/reset-password.html?token=${encodeURIComponent(token)}`;
      await sendMail({
        to: email,
        subject: "Reset your LeisureLoop password",
        text: `Hi ${result.rows[0].full_name},\n\nReset your password using this one-time link:\n${link}\n\nIt expires in 30 minutes. If you did not request this, ignore this email.`
      });
    }
    return json(res, 200, { message: "If an account exists for that email, a reset link will be sent." });
  } catch (error) {
    console.error("auth-forgot-password:", error.message);
    return json(res, error.statusCode || 500, { error: "Unable to process the request right now." });
  }
};
