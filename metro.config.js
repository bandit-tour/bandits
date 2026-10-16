const { getDefaultConfig } = require("expo/metro-config");
const http = require("http");
const https = require("https");
const { URL } = require("url");

/**
 * Dev web: proxy Workspace through Metro so browser CORS cannot empty
 * Experiences / Shop / Bottle public inventories on localhost:8082.
 */
function workspaceTargetOrigin() {
  const raw =
    process.env.EXPO_PUBLIC_WORKSPACE_URL ||
    process.env.EXPO_PUBLIC_ORCHESTRA_OS_URL ||
    "https://banditour-workspace.vercel.app";
  return String(raw).replace(/\/$/, "");
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
        "Content-Type, Accept, Authorization, X-Guest-Email, X-Guest-Bridge";
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

  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...resolver.sourceExts, "svg"],
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
                "Content-Type, Accept, Authorization, X-Guest-Email, X-Guest-Bridge",
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
