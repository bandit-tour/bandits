const { getDefaultConfig } = require("expo/metro-config");
const http = require("http");
const https = require("https");
const { URL } = require("url");

/**
 * Dev web: proxy Workspace through Metro so browser CORS cannot empty
 * Experiences / Shop / Bottle public inventories on localhost:8082.
 */
function workspaceTargetOrigin() {
  /**
   * Local Guest web QA must hit local Workspace treasury (:3000).
   * Vercel Stay Pass still fails with unconfirmable PaymentIntents (no Guest
   * Stripe Elements) — EXPO_PUBLIC_WORKSPACE_URL often points at vercel.app.
   * Opt into remote with EXPO_PUBLIC_WORKSPACE_FORCE_REMOTE=1.
   */
  const local = String(
    process.env.EXPO_PUBLIC_WORKSPACE_LOCAL_URL || "http://localhost:3000",
  ).replace(/\/$/, "");
  const forceRemote =
    String(process.env.EXPO_PUBLIC_WORKSPACE_FORCE_REMOTE || "").trim() === "1";
  const raw =
    process.env.EXPO_PUBLIC_WORKSPACE_URL ||
    process.env.EXPO_PUBLIC_ORCHESTRA_OS_URL ||
    "";
  if (!forceRemote && (!raw || /vercel\.app/i.test(raw))) {
    return local;
  }
  return String(raw || "https://banditour-workspace.vercel.app").replace(/\/$/, "");
}

function proxyWorkspace(req, res) {
  const targetOrigin = workspaceTargetOrigin();
  const incoming = req.url || "/__workspace/";
  const stripped = incoming.replace(/^\/__workspace/, "") || "/";
  let target;
  try {
    target = new URL(stripped, `${targetOrigin}/`);
  } catch {
    res.statusCode = 400;
    res.end("Bad workspace proxy path");
    return;
  }

  const lib = target.protocol === "http:" ? http : https;
  const headers = { ...req.headers, host: target.host };
  delete headers["origin"];
  delete headers["referer"];

  const upstream = lib.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "http:" ? 80 : 443),
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    },
    (upRes) => {
      const outHeaders = { ...upRes.headers };
      outHeaders["access-control-allow-origin"] = "*";
      outHeaders["access-control-allow-methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
      outHeaders["access-control-allow-headers"] =
        "Content-Type, Accept, Authorization, X-Guest-Email, X-Guest-Bridge, X-Guest-QA";
      res.writeHead(upRes.statusCode || 502, outHeaders);
      upRes.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    res.statusCode = 502;
    res.end(`Workspace proxy error: ${err.message}`);
  });
  req.pipe(upstream);
}

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
  };

  const blockList = [
    ...(Array.isArray(resolver.blockList)
      ? resolver.blockList
      : resolver.blockList
        ? [resolver.blockList]
        : []),
    /playwright-core[/\\]\.local-browsers/,
  ];
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...resolver.sourceExts, "svg"],
    blockList,
  };

  const prevEnhance = config.server?.enhanceMiddleware;
  config.server = {
    ...config.server,
    enhanceMiddleware: (metroMiddleware, server) => {
      const base = prevEnhance ? prevEnhance(metroMiddleware, server) : metroMiddleware;
      return (req, res, next) => {
        if (req.url && req.url.startsWith("/__workspace")) {
          if (req.method === "OPTIONS") {
            res.writeHead(204, {
              "access-control-allow-origin": "*",
              "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
              "access-control-allow-headers":
                "Content-Type, Accept, Authorization, X-Guest-Email, X-Guest-Bridge, X-Guest-QA",
              "access-control-max-age": "86400",
            });
            res.end();
            return;
          }
          return proxyWorkspace(req, res);
        }
        return base(req, res, next);
      };
    },
  };

  return config;
})();
