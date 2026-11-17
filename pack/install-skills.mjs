#!/usr/bin/env node
/**
 * Agent ShipKit Installer — Copies bundled skills into Claude Code, Cursor, Antigravity, or a custom skills directory.
 *
 * Usage:
 *   node install-skills.mjs --target claude      # installs to ./.claude/skills/
 *   node install-skills.mjs --target cursor      # installs to ./.cursor/skills/
 *   node install-skills.mjs --target antigravity # installs to ~/.gemini/config/skills/
 *   node install-skills.mjs --dest ./my-skills   # installs to custom directory
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--target") out.target = argv[++i];
    else if (argv[i] === "--dest") out.dest = argv[++i];
  }
  return out;
}

function resolveDest(opts) {
  if (opts.dest) return path.resolve(opts.dest);
  switch (opts.target || "claude") {
    case "antigravity":
      return path.join(os.homedir(), ".gemini", "config", "skills");
    case "cursor":
      return path.resolve(process.cwd(), ".cursor", "skills");
    case "claude":
    default:
      return path.resolve(process.cwd(), ".claude", "skills");
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const destRoot = resolveDest(opts);
  const skillsRoot = path.join(__dirname, "skills");

  if (!fs.existsSync(skillsRoot)) {
    console.error("Skills folder not found next to install-skills.mjs");
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(destRoot, { recursive: true });
  const entries = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const dir of entries) {
    const src = path.join(skillsRoot, dir.name);
    const dst = path.join(destRoot, dir.name);
    fs.cpSync(src, dst, { recursive: true, force: true });
    console.log(`✓ Installed skill: ${dir.name} -> ${dst}`);
  }
  console.log(`\nDone! Installed ${entries.length} skill(s).`);
}

main();
