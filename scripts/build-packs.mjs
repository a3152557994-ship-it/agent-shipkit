/**
 * Builds:
 * 1. Public Free Lead-Magnet Archive: `dist/agent-shipkit-starter-free.zip` (+ `docs/downloads/...`)
 *    Contains ONLY Skill #1 (`geo-llms-auditor`) + cross-agent `install-skills.mjs`.
 * 2. Local Commercial Pro Archive (ONLY when `pack/pro/` exists locally; NEVER committed to public Git):
 *    `../ai-20-matrix/release/agent-shipkit-pro-full.zip`
 *    Contains ALL 6 production skills + executable CLI scripts + `install-skills.mjs`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function buildStarterZip() {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shipkit-starter-"));
  const pkgDir = path.join(stageRoot, "agent-shipkit-starter");
  const skillsDir = path.join(pkgDir, "skills");
  fs.mkdirSync(skillsDir, { recursive: true });

  fs.copyFileSync(path.join(ROOT, "pack", "install-skills.mjs"), path.join(pkgDir, "install-skills.mjs"));
  fs.chmodSync(path.join(pkgDir, "install-skills.mjs"), 0o755);

  fs.cpSync(
    path.join(ROOT, "pack", "free", "geo-llms-auditor"),
    path.join(skillsDir, "geo-llms-auditor"),
    { recursive: true },
  );

  fs.writeFileSync(
    path.join(pkgDir, "README.md"),
    `# Agent ShipKit — Starter Free Pack (1 of 6 Skills)\n\nIncludes \`geo-llms-auditor\` (SKILL.md + zero-dep \`audit-geo.mjs\` CLI).\n\n## Install in 1 Command\n\`\`\`bash\nnode install-skills.mjs --target claude      # or --target cursor / --target antigravity\n\`\`\`\n\nUpgrade to the Full 6-Skill Commercial Bundle ($29 / ¥99): https://a3152557994-ship-it.github.io/agent-shipkit/\n`,
    "utf8",
  );

  const distDir = path.join(ROOT, "dist");
  const docsDlDir = path.join(ROOT, "docs", "downloads");
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(docsDlDir, { recursive: true });

  const starterZip = path.join(distDir, "agent-shipkit-starter-free.zip");
  if (fs.existsSync(starterZip)) fs.unlinkSync(starterZip);

  execFileSync("zip", ["-r", "-q", starterZip, "agent-shipkit-starter"], { cwd: stageRoot });
  fs.copyFileSync(starterZip, path.join(docsDlDir, "agent-shipkit-starter-free.zip"));

  fs.rmSync(stageRoot, { recursive: true, force: true });
  console.log(`Built Starter Free zip: dist/agent-shipkit-starter-free.zip (${fs.statSync(starterZip).size} bytes)`);
}

function buildProFullZipIfPresent() {
  const proSrc = path.join(ROOT, "pack", "pro");
  if (!fs.existsSync(proSrc)) {
    console.log("pack/pro not present (public repo clone) — skipping Pro commercial bundle.");
    return;
  }

  const releaseDir = path.resolve(ROOT, "..", "ai-20-matrix", "release");
  fs.mkdirSync(releaseDir, { recursive: true });

  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shipkit-pro-"));
  const pkgDir = path.join(stageRoot, "agent-shipkit-pro");
  const skillsDir = path.join(pkgDir, "skills");
  fs.mkdirSync(skillsDir, { recursive: true });

  fs.copyFileSync(path.join(ROOT, "pack", "install-skills.mjs"), path.join(pkgDir, "install-skills.mjs"));
  fs.chmodSync(path.join(pkgDir, "install-skills.mjs"), 0o755);

  // Copy Free skill #1
  fs.cpSync(
    path.join(ROOT, "pack", "free", "geo-llms-auditor"),
    path.join(skillsDir, "geo-llms-auditor"),
    { recursive: true },
  );

  // Copy Pro skills #2–#6
  const proEntries = fs.readdirSync(proSrc, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of proEntries) {
    fs.cpSync(path.join(proSrc, dir.name), path.join(skillsDir, dir.name), { recursive: true });
  }

  fs.writeFileSync(
    path.join(pkgDir, "README-PRO.md"),
    `# Agent ShipKit Pro — Full 6-Skill Commercial Engineering Pack\n\nThank you for purchasing Agent ShipKit Pro!\n\n## Included Production Skills & Executable Scripts\n1. \`geo-llms-auditor\` — AI visibility audit + \`llms.txt\` & Schema.org JSON-LD generator\n2. \`appstore-pain-miner\` — Apple App Store 1–3★ review complaint miner & pricing anchor CLI\n3. \`zero-server-ed25519-paywall\` — Offline Ed25519 \`OPC1.\` keygen, issuer & WebCrypto paywall scaffolder\n4. \`runaway-token-guard\` — Agent JSONL token telemetry & retry-loop / USD budget circuit breaker\n5. \`sunk-cost-cro-landing\` — High-conversion bilingual static landing site generator\n6. \`cold-start-launch-pack\` — Show HN / Reddit / Product Hunt / V2EX native launch draft & UTM generator\n\n## One-Command Installation\n\`\`\`bash\nnode install-skills.mjs --target claude\nnode install-skills.mjs --target cursor\nnode install-skills.mjs --target antigravity\n\`\`\`\n`,
    "utf8",
  );

  const proZipPath = path.join(releaseDir, "agent-shipkit-pro-full.zip");
  if (fs.existsSync(proZipPath)) fs.unlinkSync(proZipPath);

  execFileSync("zip", ["-r", "-q", proZipPath, "agent-shipkit-pro"], { cwd: stageRoot });
  fs.rmSync(stageRoot, { recursive: true, force: true });
  console.log(`Built Pro Full commercial zip: ${path.basename(proZipPath)} (${fs.statSync(proZipPath).size} bytes)`);
}

buildStarterZip();
buildProFullZipIfPresent();
