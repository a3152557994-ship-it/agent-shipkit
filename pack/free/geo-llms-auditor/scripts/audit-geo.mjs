#!/usr/bin/env node
/**
 * geo-llms-auditor — Deterministic AI Visibility (GEO/AEO) Auditor & `llms.txt` + JSON-LD Generator
 * Zero external dependencies (Node >= 20).
 *
 * Usage:
 *   node audit-geo.mjs --html ./docs/index.html --base-url https://mysite.dev --out ./geo-out
 *   node audit-geo.mjs --url https://example.com --out ./geo-out [--json]
 */

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function stripTags(html) {
  return String(html || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function auditHtmlDocument(html, baseUrl = "https://example.com", robotsTxt = "") {
  const checks = [];
  let score = 0;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  if (title.length >= 12 && title.length <= 90) {
    score += 15;
    checks.push({ id: "title", pass: true, pts: 15, detail: `Title (${title.length} chars): "${title}"` });
  } else {
    checks.push({ id: "title", pass: false, pts: 0, detail: `Missing or suboptimal <title> (${title.length} chars)` });
  }

  const descMatch =
    html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : "";
  if (description.length >= 40) {
    score += 15;
    checks.push({ id: "meta_description", pass: true, pts: 15, detail: `Meta description (${description.length} chars)` });
  } else {
    checks.push({ id: "meta_description", pass: false, pts: 0, detail: "Missing or short <meta name='description'> (<40 chars)" });
  }

  const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : baseUrl;
  if (canonicalMatch) {
    score += 10;
    checks.push({ id: "canonical", pass: true, pts: 10, detail: `Canonical URL declared: ${canonical}` });
  } else {
    checks.push({ id: "canonical", pass: false, pts: 0, detail: "No <link rel='canonical'> found" });
  }

  const jsonLdBlocks = [...html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (jsonLdBlocks.length > 0) {
    score += 25;
    checks.push({ id: "json_ld", pass: true, pts: 25, detail: `Found ${jsonLdBlocks.length} Schema.org JSON-LD block(s)` });
  } else {
    checks.push({ id: "json_ld", pass: false, pts: 0, detail: "Missing Schema.org application/ld+json structured data" });
  }

  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]));
  const h2Matches = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1]));
  if (h1Matches.length === 1 && h2Matches.length >= 1) {
    score += 15;
    checks.push({ id: "headings", pass: true, pts: 15, detail: `Clean hierarchy: 1 <h1> and ${h2Matches.length} <h2> sections` });
  } else {
    const partial = h1Matches.length >= 1 ? 8 : 0;
    score += partial;
    checks.push({ id: "headings", pass: false, pts: partial, detail: `Found ${h1Matches.length} <h1> and ${h2Matches.length} <h2> tags` });
  }

  const blocksAiBots = /User-agent:\s*(GPTBot|OAI-SearchBot|ClaudeBot|PerplexityBot)[\s\S]*?Disallow:\s*\/\s*$/im.test(robotsTxt);
  if (!blocksAiBots) {
    score += 20;
    checks.push({ id: "ai_bots", pass: true, pts: 20, detail: "AI search crawlers (OAI-SearchBot/ClaudeBot/PerplexityBot) are allowed" });
  } else {
    checks.push({ id: "ai_bots", pass: false, pts: 0, detail: "robots.txt blocks major AI answer crawlers!" });
  }

  const brandTitle = title || h1Matches[0] || "Website";
  const summaryText = description || stripTags(html).slice(0, 220);

  const llmsTxt = [
    `# ${brandTitle}`,
    "",
    `> ${summaryText}`,
    "",
    "## Key Sections",
    ...(h2Matches.length > 0 ? h2Matches.slice(0, 8).map((h) => `- ${h}`) : ["- Core Overview & Documentation"]),
    "",
    "## Canonical Links",
    `- Homepage: ${canonical}`,
    `- Machine Summary: ${canonical.replace(/\/$/, "")}/llms.txt`,
    "",
  ].join("\n");

  const schemaJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brandTitle,
    url: canonical,
    description: summaryText,
  };

  return {
    score,
    grade: score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D",
    title: brandTitle,
    description: summaryText,
    canonical,
    checks,
    llmsTxt,
    schemaJsonLd,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let html = "";
  let robots = "";
  let baseUrl = args["base-url"] || args.url || "https://example.com";

  if (args.html) {
    html = fs.readFileSync(path.resolve(args.html), "utf8");
  } else if (args.url) {
    const res = await fetch(args.url, { signal: AbortSignal.timeout(10000) });
    html = await res.text();
    try {
      const rUrl = new URL("/robots.txt", args.url).toString();
      const rRes = await fetch(rUrl, { signal: AbortSignal.timeout(5000) });
      if (rRes.ok) robots = await rRes.text();
    } catch {
      // ignore missing robots.txt
    }
  } else {
    console.error("Usage: node audit-geo.mjs --html <path> [--base-url <url>] [--out <dir>]");
    process.exitCode = 1;
    return;
  }

  const report = auditHtmlDocument(html, baseUrl, robots);

  if (args.out) {
    const outDir = path.resolve(args.out);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "llms.txt"), report.llmsTxt, "utf8");
    fs.writeFileSync(path.join(outDir, "schema.jsonld"), JSON.stringify(report.schemaJsonLd, null, 2) + "\n", "utf8");
    fs.writeFileSync(path.join(outDir, "geo-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`GEO Readiness Score: ${report.score}/100 (Grade ${report.grade}) — ${report.title}`);
    for (const c of report.checks) {
      console.log(`  [${c.pass ? "PASS" : "WARN"}] (+${c.pts}) ${c.detail}`);
    }
    if (args.out) {
      console.log(`Generated llms.txt & schema.jsonld -> ${path.resolve(args.out)}`);
    }
  }
}

main();
