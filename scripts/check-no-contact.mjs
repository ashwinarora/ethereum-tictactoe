// Starts the server with NO_CONTACT=true and fails if anything that leads to me is in a
// response. Run it with `npm run check:no-contact`. See README "No-contact mode".
//
// It requests the pages, every file under public/, the routes, an unknown path and a set of
// path tricks that try to reach the unprocessed source, and scans every response (headers
// and body) for the forbidden patterns below. It also plays a Socket.IO round trip through
// the proxy, over long-polling and over WebSocket.
//
// The game server is a stub started here, so the check never touches production. It uses
// two free local ports, searched upwards from CHECK_PORT (default 4841).
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import net from "node:net";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const socketIo = require("socket.io");
const socketIoClient = require("socket.io-client");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// A normal-deployment domain of any of my sites. "showcase.ethtactoe.com" contains
// "ethtactoe.com", so the match excludes that prefix.
const normalDomains = [
  "ashwinarora.com",
  "ashdex.app",
  "lizardpoisonspock.com",
  "hltools.tech",
  "ethtactoe.com",
  "ethtictactoe.com",
  "socialnetwrk.in",
  "ethhousie.com",
];
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const FORBIDDEN = [
  { name: "email address", pattern: /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi },
  { name: "mailto:", pattern: /mailto:/gi },
  { name: "tel:", pattern: /\btel:\+?\d/gi },
  { name: "calendly", pattern: /calendly/gi },
  { name: "t.me link", pattern: /(?<![a-z0-9.-])t\.me\//gi },
  { name: "wa.me link", pattern: /(?<![a-z0-9.-])wa\.me\//gi },
  { name: "telegram", pattern: /telegram/gi },
  { name: "whatsapp", pattern: /whatsapp/gi },
  { name: "linkedin", pattern: /linkedin/gi },
  { name: "x.com / twitter.com", pattern: /(?<![a-z0-9.-])(?:x|twitter)\.com/gi },
  { name: "github.com", pattern: /github\.com/gi },
  { name: "my handles", pattern: /@ashwin|ashwin-arora|ashwinarora|ashwins-projects/gi },
  { name: "flickr", pattern: /flickr/gi },
  { name: "youtube", pattern: /youtube|youtu\.be/gi },
  { name: "discord", pattern: /discord/gi },
  { name: "vercel.app", pattern: /vercel\.app/gi },
  { name: "railway.app", pattern: /railway\.app/gi },
  { name: "herokuapp.com", pattern: /herokuapp\.com/gi },
  { name: "hire", pattern: /hire/gi },
  { name: "portfolio", pattern: /portfolio/gi },
  { name: "unprocessed source", pattern: /nc:normal-only|nc:no-contact-only|\{\{nc:/gi },
  ...normalDomains.map((domain) => ({
    name: `normal domain ${domain}`,
    pattern: new RegExp(`(?<!showcase\\.)(?<![a-z0-9-])${escape(domain)}`, "gi"),
  })),
];

// Matches that are known not to be contact details. Keep this list short and specific:
// every entry is a hole in the check. An entry covers one exact match in one URL.
const ALLOWED = [
  // Both are runs of characters inside the compressed BIP-39 English word list of the
  // vendored ethers bundle (`const words="0erleonalorensein..."`) that happen to have the
  // shape of an email address. They are not addresses.
  { url: "/javascripts/ethersjsV6.min.js", what: "email address", match: "Rfe@Rm.Rs" },
  { url: "/javascripts/ethersjsV6.min.js", what: "email address", match: "0Bje@Bm.BwayC" },
];

// Requests that try to reach the source files in public/, or the copy built for the other
// mode, instead of the copy built for this one.
const RAW_FILE_PROBES = [
  "/index.html/",
  "/howToPlay.html/",
  "/javascripts/index.js/",
  "/INDEX.HTML",
  "/HowToPlay.HTML",
  "/howtoplay.html",
  "/JavaScripts/Index.JS",
  "//index.html",
  "//javascripts//index.js",
  "/./index.html",
  "/public/index.html",
  "/public/howToPlay.html",
  "/public/javascripts/index.js",
  "/../public/index.html",
  "/%2e%2e/public/index.html",
  "/%2E%2E/public/javascripts/index.js",
  "/..%2fpublic%2findex.html",
  "/%2e%2e%2fpublic%2fhowToPlay.html",
  "/javascripts/%2e%2e/%2e%2e/public/index.html",
  "/javascripts/..%2f..%2fpublic%2fjavascripts%2findex.js",
  "/..%5cpublic%5cindex.html",
  "/%2e%2e/%2e%2e/public/index.html",
  "/%2e%2e/normal/index.html",
  "/.served/normal/index.html",
  "/index.html%00",
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function isFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

async function freePorts(count) {
  const first = Number(process.env.CHECK_PORT || 4841);
  const found = [];
  for (let port = first; port < first + 9 && found.length < count; port += 1) {
    if (await isFree(port)) found.push(port);
  }
  if (found.length < count) throw new Error(`no ${count} free ports in ${first}-${first + 8}; set CHECK_PORT`);
  return found;
}

/**
 * A GET that sends the path exactly as written (fetch would normalise the path tricks).
 * With `webSocket`, it asks for the WebSocket upgrade and resolves with the 101 response.
 */
function get(port, path, webSocket = false) {
  return new Promise((resolve, reject) => {
    const headers = webSocket
      ? { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": randomBytes(16).toString("base64") }
      : {};
    const request = http.request({ host: "127.0.0.1", port, path, method: "GET", headers }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ response, body: Buffer.concat(chunks).toString("latin1") }));
    });
    request.on("upgrade", (response, socket) => {
      socket.destroy();
      resolve({ response, body: "" });
    });
    request.on("error", reject);
    request.end();
  });
}

const findings = [];
const scanned = [];
const allowedUsed = new Set();

async function scan(port, path, forbidden, { expect, webSocket } = {}) {
  const { response, body } = await get(port, path, webSocket);
  const headers = response.rawHeaders.reduce((text, part, i) => text + part + (i % 2 ? "\n" : ": "), "");
  scanned.push(`${response.statusCode} ${String(body.length).padStart(7)} bytes  ${path}${webSocket ? "  (WebSocket upgrade)" : ""}`);
  if (expect && response.statusCode !== expect) {
    findings.push({ url: path, what: `expected status ${expect}`, match: String(response.statusCode) });
  }

  for (const [part, text] of [["headers", headers], ["body", body]]) {
    for (const { name: what, pattern } of forbidden) {
      for (const hit of text.matchAll(pattern)) {
        const allowed = ALLOWED.find((entry) => entry.url === path && entry.what === what && entry.match === hit[0]);
        if (allowed) {
          allowedUsed.add(allowed);
          continue;
        }
        const from = Math.max(0, hit.index - 40);
        const context = text.slice(from, hit.index + hit[0].length + 40).replace(/\s+/g, " ");
        findings.push({ url: path, what: `${what} in ${part}`, match: hit[0], context });
      }
    }
  }

  // A 101 is written by the game server itself, so it is the one response without the header.
  if (!webSocket && !/noindex/i.test(response.headers["x-robots-tag"] ?? "")) {
    findings.push({ url: path, what: "missing header", match: "X-Robots-Tag: noindex, nofollow" });
  }
  const isHtmlPage = /text\/html/i.test(response.headers["content-type"] ?? "") && /<html/i.test(body);
  if (isHtmlPage && !/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(body)) {
    findings.push({ url: path, what: "missing noindex", match: '<meta name="robots" content="noindex, nofollow">' });
  }
}

/** One game request through the proxy, answered by the stub. Resolves with the transport the stub saw. */
function roundTrip(port, transports, waitForUpgrade) {
  return new Promise((resolve, reject) => {
    const socket = socketIoClient(`http://127.0.0.1:${port}`, { transports, reconnection: false, forceNew: true });
    const fail = (reason) => {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`Socket.IO through the proxy (${transports.join(" then ")}): ${reason}`));
    };
    const timer = setTimeout(() => fail("no reply in 8s"), 8000);
    const ask = () => socket.emit("request-contract-data");
    socket.on("connect", () => (waitForUpgrade ? socket.io.engine.once("upgrade", ask) : ask()));
    socket.on("connect_error", (error) => fail(error.message));
    socket.on("create-new-game", (reply) => {
      clearTimeout(timer);
      socket.close();
      resolve(reply.transport);
    });
  });
}

let server;
let stub;
let serverLog = "";

try {
  const [port, stubPort] = await freePorts(2);

  // The stand-in for the production game server: Socket.IO 2, like the real one.
  const stubHttp = http.createServer((request, response) => response.writeHead(404).end());
  stub = socketIo(stubHttp);
  stub.on("connection", (socket) => {
    socket.on("request-contract-data", () => {
      socket.emit("create-new-game", { transport: socket.conn.transport.name });
    });
  });
  await new Promise((resolve) => stubHttp.listen(stubPort, "127.0.0.1", resolve));

  // The server must start with no key: in no-contact mode it has no wallet and no engine.
  const env = { ...process.env, NO_CONTACT: "true", PORT: String(port), NO_CONTACT_BACKEND_URL: `http://127.0.0.1:${stubPort}` };
  delete env.PRIVATE_KEY;
  server = spawn(process.execPath, ["app.js"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => (serverLog += chunk));
  server.stderr.on("data", (chunk) => (serverLog += chunk));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the server did not start in 15s")), 15000);
    server.once("exit", (code) => reject(new Error(`the server exited with code ${code} before it was ready`)));
    server.stdout.on("data", () => {
      if (!serverLog.includes("Listening on PORT")) return;
      clearTimeout(timer);
      resolve();
    });
  });

  // Nothing served may name the game server either. In production that is a railway.app
  // host (already forbidden above); here it is the stub.
  const forbidden = [...FORBIDDEN, { name: "game server address", pattern: new RegExp(`(?:127\\.0\\.0\\.1|localhost):${stubPort}`, "gi") }];

  const publicFiles = walk(join(root, "public")).map((file) => "/" + relative(join(root, "public"), file).split(sep).join("/"));
  const served = new Set(["/", "/index.html", "/howToPlay.html", "/javascripts/index.js", ...publicFiles]);
  for (const url of served) await scan(port, url, forbidden, { expect: 200 });
  await scan(port, "/users", forbidden, { expect: 200 });
  await scan(port, "/this-page-does-not-exist", forbidden, { expect: 404 });
  await scan(port, "/socket.io/socket.io.js", forbidden, { expect: 200 });
  await scan(port, "/socket.io/?EIO=3&transport=polling", forbidden, { expect: 200 });
  await scan(port, "/socket.io/?EIO=3&transport=websocket", forbidden, { expect: 101, webSocket: true });
  for (const url of RAW_FILE_PROBES) await scan(port, url, forbidden);

  const sawPolling = await roundTrip(port, ["polling"]);
  const sawWebSocket = await roundTrip(port, ["websocket"]);
  const sawUpgrade = await roundTrip(port, ["polling", "websocket"], true);
  const transports = `polling: ${sawPolling}, websocket: ${sawWebSocket}, polling then upgrade: ${sawUpgrade}`;
  if (sawPolling !== "polling" || sawWebSocket !== "websocket" || sawUpgrade !== "websocket") {
    findings.push({ url: "/socket.io/", what: "proxy did not carry the transport", match: transports });
  }

  // With the game server down, the proxy's own error must not name it.
  await new Promise((resolve) => stub.close(resolve));
  stub = null;
  await scan(port, "/socket.io/?EIO=3&transport=polling&game-server=down", forbidden, { expect: 502 });

  if (/privateKey|gameNumber/.test(serverLog)) {
    findings.push({ url: "(server log)", what: "the game engine ran in no-contact mode", match: "privateKey / gameNumber" });
  }
  for (const entry of ALLOWED) {
    if (!allowedUsed.has(entry)) findings.push({ url: entry.url, what: "allowlist entry matched nothing, remove it", match: entry.match });
  }

  console.log(`Scanned on http://127.0.0.1:${port} (stub game server on ${stubPort}):\n`);
  for (const line of scanned) console.log(`  ${line}`);
  console.log(`\nSocket.IO through the proxy, transport seen by the stub: ${transports}`);

  if (findings.length > 0) {
    console.error(`\ncheck:no-contact FAILED: ${findings.length} finding(s)\n`);
    for (const finding of findings) {
      console.error(`  ${finding.url}: ${finding.what}: ${JSON.stringify(finding.match)}`);
      if (finding.context) console.error(`      ...${finding.context}...`);
    }
    console.error("\nPut contact content in an nc:normal-only block and site URLs in noContact.js. See README \"No-contact mode\".");
    process.exitCode = 1;
  } else {
    console.log(`\ncheck:no-contact passed: ${scanned.length} responses scanned, ${ALLOWED.length} allowlisted match(es)`);
  }
} catch (error) {
  console.error(`\ncheck:no-contact FAILED: ${error.message}`);
  if (serverLog) console.error(`\nServer log:\n${serverLog}`);
  process.exitCode = 1;
} finally {
  if (server) server.kill();
  if (stub) stub.close();
}
