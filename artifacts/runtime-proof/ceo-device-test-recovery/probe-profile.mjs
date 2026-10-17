import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const url = "https://bandits-two.vercel.app/profile";
const outDir = path.dirname(fileURLToPath(import.meta.url));

const res = await fetch(url, {
  redirect: "follow",
  headers: { "user-agent": "ceo-device-test-probe" },
});
const html = await res.text();
const markers = {
  status: res.status,
  finalUrl: res.url,
  hasProfileStayError: /PROFILE_STAY is not defined/i.test(html),
  hasReactError: /Minified React error|Something went wrong|Application error/i.test(html),
  hasProfileText: /Profile|Travel score|Guest|bandiTour/i.test(html),
  bodySnippet: html.replace(/\s+/g, " ").slice(0, 500),
};

const jsMatch = html.match(/_expo\/static\/js\/web\/entry-[^"']+\.js/);
let bundle = {};
if (jsMatch) {
  const jsUrl = new URL(jsMatch[0], url).href;
  const jr = await fetch(jsUrl);
  const js = await jr.text();
  bundle = {
    entry: jsMatch[0],
    hasPROFILE_STAY: js.includes("PROFILE_STAY"),
    hasTravelScoreSample: js.includes("Travel score (sample)"),
    hasProfileStayNotDefinedLiteral: js.includes("PROFILE_STAY is not defined"),
  };
}

const out = {
  at: new Date().toISOString(),
  url,
  deployAlias: "https://bandits-two.vercel.app",
  html: markers,
  bundle,
  browserStatus:
    res.status === 200 && !markers.hasProfileStayError && bundle.hasPROFILE_STAY
      ? "PASS"
      : "FAIL_OR_INCONCLUSIVE",
};

fs.writeFileSync(path.join(outDir, "profile-probe.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
