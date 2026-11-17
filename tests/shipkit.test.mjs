import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { verifyShipkitLicense, SKILL_CATALOG, PUBLIC_SPKI_BASE64 } from "../src/verify.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("Ed25519 OPC1 license verifier validates agent-shipkit and rejects tampering", () => {
  assert.equal(PUBLIC_SPKI_BASE64, "MCowBQYDK2VwAyEAP5NCVP7CT0tgaGLSGMe4r87SjYRWTM6gN6igBZYSXys=");
  assert.equal(SKILL_CATALOG.length, 6);

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const spkiB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const now = Math.floor(Date.now() / 1000);

  const sign = (payload) => {
    const pB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sB64 = crypto.sign(null, Buffer.from(`OPC1.${pB64}`, "utf8"), privateKey).toString("base64url");
    return `OPC1.${pB64}.${sB64}`;
  };

  const valid = sign({ v: 1, p: "agent-shipkit", e: "dev@indie.io", plan: "pro", iat: now, exp: 0 });
  assert.equal(verifyShipkitLicense(valid, "agent-shipkit", spkiB64).valid, true);

  const wildcard = sign({ v: 1, p: "*", e: "vip@indie.io", plan: "bundle", iat: now, exp: 0 });
  assert.equal(verifyShipkitLicense(wildcard, "agent-shipkit", spkiB64).valid, true);

  const wrong = sign({ v: 1, p: "other-pack", e: "dev@indie.io", plan: "pro", iat: now, exp: 0 });
  assert.equal(verifyShipkitLicense(wrong, "agent-shipkit", spkiB64).reason, "PRODUCT_MISMATCH");

  const tampered = `${valid.slice(0, -3)}XYZ`;
  assert.equal(verifyShipkitLicense(tampered, "agent-shipkit", spkiB64).valid, false);
});

test("Starter Free zip has ONLY free skill #1 and .gitignore blocks Pro leakage", () => {
  const starterZip = path.join(ROOT, "dist", "agent-shipkit-starter-free.zip");
  assert.equal(fs.existsSync(starterZip), true);

  const listing = execFileSync("unzip", ["-l", starterZip], { encoding: "utf8" });
  assert.match(listing, /geo-llms-auditor\/SKILL\.md/);
  assert.match(listing, /geo-llms-auditor\/scripts\/audit-geo\.mjs/);
  assert.doesNotMatch(listing, /appstore-pain-miner/);
  assert.doesNotMatch(listing, /zero-server-ed25519-paywall/);
  assert.doesNotMatch(listing, /runaway-token-guard/);

  const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.match(gitignore, /pack\/pro\//);
  assert.match(gitignore, /\*pro-full\*\.zip/);
});

test("Free Skill #1 `geo-llms-auditor` CLI audits HTML and outputs llms.txt + schema.jsonld", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "geo-skill-test-"));
  const scriptPath = path.join(ROOT, "pack", "free", "geo-llms-auditor", "scripts", "audit-geo.mjs");
  const docsHtml = path.join(ROOT, "docs", "index.html");

  const out = execFileSync(
    process.execPath,
    [scriptPath, "--html", docsHtml, "--base-url", "https://a3152557994-ship-it.github.io/agent-shipkit/", "--out", tmpDir, "--json"],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(out);
  assert.ok(parsed.score >= 70);
  assert.equal(fs.existsSync(path.join(tmpDir, "llms.txt")), true);
  assert.equal(fs.existsSync(path.join(tmpDir, "schema.jsonld")), true);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("All 5 Pro Skills + Pro Full Zip execute cleanly when local `pack/pro` is present", () => {
  const proRoot = path.join(ROOT, "pack", "pro");
  if (!fs.existsSync(proRoot)) return;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skills-test-"));

  // Skill 2: appstore-pain-miner
  const s2Out = execFileSync(
    process.execPath,
    [path.join(proRoot, "appstore-pain-miner/scripts/mine-appstore.mjs"), "--country", "us", "--keyword", "teleprompter", "--offline", "--json"],
    { encoding: "utf8" },
  );
  assert.equal(JSON.parse(s2Out).competitorsAnalyzed, 3);

  // Skill 3: zero-server-ed25519-paywall
  const keysDir = path.join(tmpDir, "keys");
  execFileSync(process.execPath, [path.join(proRoot, "zero-server-ed25519-paywall/scripts/paywall-kit.mjs"), "keygen", "--out", keysDir]);
  const tok = execFileSync(
    process.execPath,
    [path.join(proRoot, "zero-server-ed25519-paywall/scripts/paywall-kit.mjs"), "issue", "--priv", path.join(keysDir, "private.pkcs8.b64"), "--product", "demo", "--email", "a@b.com"],
    { encoding: "utf8" },
  ).trim();
  const ver = JSON.parse(
    execFileSync(
      process.execPath,
      [path.join(proRoot, "zero-server-ed25519-paywall/scripts/paywall-kit.mjs"), "verify", "--pub", path.join(keysDir, "public.spki.b64"), "--token", tok, "--product", "demo"],
      { encoding: "utf8" },
    ),
  );
  assert.equal(ver.valid, true);

  // Skill 4: runaway-token-guard
  const sampleLog = path.join(tmpDir, "session.jsonl");
  fs.writeFileSync(
    sampleLog,
    [
      JSON.stringify({ model: "claude-sonnet", usage: { input_tokens: 1200, output_tokens: 300 }, tool_calls: [{ name: "bash", arguments: { cmd: "npm test" } }] }),
      JSON.stringify({ model: "claude-sonnet", usage: { input_tokens: 1400, output_tokens: 250 }, tool_calls: [{ name: "read", arguments: { file: "a.js" } }] }),
    ].join("\n"),
  );
  const guardOut = JSON.parse(
    execFileSync(
      process.execPath,
      [path.join(proRoot, "runaway-token-guard/scripts/token-guard.mjs"), "--log", sampleLog, "--budget-usd", "5.0", "--json"],
      { encoding: "utf8" },
    ),
  );
  assert.equal(guardOut.tripped, false);

  // Skill 5: sunk-cost-cro-landing
  const siteOut = path.join(tmpDir, "landing");
  execFileSync(process.execPath, [path.join(proRoot, "sunk-cost-cro-landing/scripts/scaffold-landing.mjs"), "--slug", "demo-app", "--out", siteOut]);
  assert.equal(fs.existsSync(path.join(siteOut, "index.html")), true);

  // Skill 6: cold-start-launch-pack
  const launchOut = path.join(tmpDir, "launch");
  execFileSync(process.execPath, [path.join(proRoot, "cold-start-launch-pack/scripts/generate-launch-pack.mjs"), "--name", "DemoTool", "--out", launchOut]);
  assert.equal(fs.existsSync(path.join(launchOut, "show-hn.md")), true);
  assert.equal(fs.existsSync(path.join(launchOut, "v2ex-create.md")), true);

  // Verify commercial Pro Full zip exists in ../ai-20-matrix/release/ and contains all 6 skills
  const proZip = path.resolve(ROOT, "..", "ai-20-matrix", "release", "agent-shipkit-pro-full.zip");
  assert.equal(fs.existsSync(proZip), true);
  const proListing = execFileSync("unzip", ["-l", proZip], { encoding: "utf8" });
  for (const s of SKILL_CATALOG) {
    assert.match(proListing, new RegExp(`${s.id}/SKILL\\.md`));
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
