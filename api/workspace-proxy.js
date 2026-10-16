/**
 * Production web same-origin bridge → Workspace (CORS bypass for Guest App browser).
 * GET/POST /api/workspace-proxy?path=/api/public/experiences
 */
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, X-Guest-Email, X-Guest-Bridge",
  );
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const origin = String(
    process.env.EXPO_PUBLIC_WORKSPACE_URL ||
      process.env.EXPO_PUBLIC_ORCHESTRA_OS_URL ||
      "https://banditour-workspace.vercel.app",
  ).replace(/\/$/, "");

  const path = String(req.query.path || "").trim();
  if (!path.startsWith("/api/")) {
    return res.status(400).json({ ok: false, error: "path must start with /api/" });
  }

  try {
    const upstream = await fetch(`${origin}${path}`, {
      method: req.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Guest-Email": req.headers["x-guest-email"] || "guest@banditour.demo",
        "X-Guest-Bridge": req.headers["x-guest-bridge"] || "banditour-guest-bridge-2026",
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body || {}),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ ok: false, error: e instanceof Error ? e.message : "proxy failed" });
  }
};
