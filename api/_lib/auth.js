const crypto = require("crypto");
const argon2 = require("argon2");
const nodemailer = require("nodemailer");
const { db } = require("./db");

const SESSION_COOKIE = "ll_session";
const SESSION_DAYS = 14;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}
function cookieOptions(maxAge) {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ].join("; ");
}
function setSessionCookie(res, token, maxAge) {
  res.setHeader("Set-Cookie", cookieOptions(maxAge).replace("ll_session=", `ll_session=${token}`));
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", cookieOptions(0));
}
function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}
function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}
function method(req, res, expected) {
  if (req.method !== expected) {
    res.setHeader("Allow", expected);
    json(res, 405, { error: "Method not allowed." });
    return false;
  }
  return true;
}
function body(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}
function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function validEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function appOrigin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error("APP_ORIGIN is not configured.");
  return value.replace(/\/$/, "");
}
async function sendMail({ to, subject, text }) {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"];
  if (required.some((key) => !process.env[key])) {
    const error = new Error("Email delivery is not configured.");
    error.statusCode = 503;
    throw error;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
}
async function createEmailToken(userId, purpose, minutes) {
  const token = randomToken();
  await db().query(
    "insert into app_email_tokens(user_id,purpose,token_hash,expires_at) values($1,$2,$3,now()+($4 * interval '1 minute'))",
    [userId, purpose, hashToken(token), minutes]
  );
  return token;
}
async function createSession(userId, res) {
  const token = randomToken();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await db().query(
    "insert into app_sessions(user_id,token_hash,expires_at) values($1,$2,now()+($3 * interval '1 second'))",
    [userId, hashToken(token), maxAge]
  );
  setSessionCookie(res, token, maxAge);
}
async function currentUser(req) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const result = await db().query(
    `select u.id,u.email,u.full_name,u.account_type,u.owner_status,u.email_verified_at
     from app_sessions s join app_users u on u.id=s.user_id
     where s.token_hash=$1 and s.expires_at>now() and u.disabled_at is null
     limit 1`,
    [hashToken(token)]
  );
  if (!result.rows[0]) return null;
  await db().query("update app_sessions set last_seen_at=now() where token_hash=$1", [hashToken(token)]);
  return result.rows[0];
}
async function requireUser(req, res) {
  const user = await currentUser(req);
  if (!user) {
    json(res, 401, { error: "Please sign in to continue." });
    return null;
  }
  return user;
}
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    account_type: user.account_type,
    owner_status: user.owner_status,
    email_verified: Boolean(user.email_verified_at)
  };
}
module.exports = {
  argon2, db, hashToken, randomToken, json, method, body, normalizeEmail,
  validEmail, appOrigin, sendMail, createEmailToken, createSession,
  currentUser, requireUser, publicUser, getCookie, clearSessionCookie
};
