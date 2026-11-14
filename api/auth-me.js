const { json, method, requireUser, publicUser } = require("./_lib/auth");
module.exports = async (req, res) => {
  if (!method(req, res, "GET")) return;
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    return json(res, 200, { user: publicUser(user) });
  } catch (error) {
    console.error("auth-me:", error.message);
    return json(res, 500, { error: "Unable to read your session." });
  }
};
