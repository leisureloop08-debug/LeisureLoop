const { argon2, db, json, method, body, normalizeEmail, validEmail, appOrigin, sendMail, createEmailToken } = require("./_lib/auth");

module.exports = async (req, res) => {
  if (!method(req, res, "POST")) return;
  try {
    const input = body(req);
    const email = normalizeEmail(input.email);
    const fullName = typeof input.full_name === "string" ? input.full_name.trim().slice(0, 100) : "";
    const password = typeof input.password === "string" ? input.password : "";
    const accountType = input.account_type === "owner" ? "owner" : "buyer";
    if (!validEmail(email) || !fullName || password.length < 8 || password.length > 128) {
      return json(res, 400, { error: "Enter a valid email, name and password of at least 8 characters." });
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const inserted = await db().query(
      `insert into app_users(email,password_hash,full_name,account_type,owner_status)
       values($1,$2,$3,$4,$5) returning id,email`,
      [email, passwordHash, fullName, accountType, accountType === "owner" ? "pending" : "not_applicable"]
    );
    const user = inserted.rows[0];
    const token = await createEmailToken(user.id, "email_verification", 60 * 24);
    const link = `${appOrigin()}/verify-email.html?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: email,
      subject: "Verify your LeisureLoop account",
      text: `Hi ${fullName},\n\nVerify your email address by opening this link:\n${link}\n\nThis link expires in 24 hours. If you did not create this account, ignore this email.`
    });
    return json(res, 201, { message: "Account created. Check your email to verify your address." });
  } catch (error) {
    if (error.code === "23505") return json(res, 409, { error: "An account with this email already exists." });
    console.error("auth-register:", error.message);
    return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : "Unable to create your account right now." });
  }
};
