/**
 * Agent ShipKit — Ed25519 `OPC1.` License Verifier & Catalog Metadata
 * Zero external dependencies (`node:crypto` & WebCrypto compatible).
 */

import crypto from "node:crypto";

export const PRODUCT_SLUG = "agent-shipkit";
export const PUBLIC_SPKI_BASE64 = "MCowBQYDK2VwAyEAP5NCVP7CT0tgaGLSGMe4r87SjYRWTM6gN6igBZYSXys=";

export const SKILL_CATALOG = [
  {
    id: "geo-llms-auditor",
    tier: "free",
    titleEn: "GEO & llms.txt Site Auditor",
    titleZh: "网站 AI 可见度体检与 llms.txt 生成器",
    script: "scripts/audit-geo.mjs",
    summary: "Audits any URL or HTML file for ChatGPT/Perplexity/Claude citation readiness (0–100 score) and generates standard llms.txt + Schema.org JSON-LD.",
  },
  {
    id: "appstore-pain-miner",
    tier: "pro",
    titleEn: "App Store 1–3★ Pain Miner & Pricing Anchor",
    titleZh: "App Store 1–3★ 痛点挖掘与买断定价锚点",
    script: "scripts/mine-appstore.mjs",
    summary: "Mines Apple iTunes Search + Customer Reviews RSS, clusters 1–3★ user rage points, and outputs an anti-subscription buyout niche brief.",
  },
  {
    id: "zero-server-ed25519-paywall",
    tier: "pro",
    titleEn: "Zero-Server Ed25519 Offline Paywall Kit",
    titleZh: "零服务器 Ed25519 离线发码与前端验签付费墙",
    script: "scripts/paywall-kit.mjs",
    summary: "Generates Ed25519 keypairs, signs offline OPC1.<payload>.<sig> license keys, and scaffolds drop-in Node + WebCrypto browser paywalls with $0/mo backend cost.",
  },
  {
    id: "runaway-token-guard",
    tier: "pro",
    titleEn: "Runaway Token & Loop Circuit Breaker",
    titleZh: "AI 编程日志监控与死循环预算熔断器",
    script: "scripts/token-guard.mjs",
    summary: "Scans JSONL coding-agent logs for prompt-cache misses, repeated identical tool-call failure loops, and enforces hard USD budget thresholds.",
  },
  {
    id: "sunk-cost-cro-landing",
    tier: "pro",
    titleEn: "Sunk-Cost CRO Bilingual Landing Generator",
    titleZh: "沉没成本高转化双语落地页生成器",
    script: "scripts/scaffold-landing.mjs",
    summary: "Scaffolds a complete 'Tool-First, Paywall-After-Aha-Moment' bilingual static site (index.html, llms.txt, robots.txt, sitemap.xml) ready for GitHub Pages.",
  },
  {
    id: "cold-start-launch-pack",
    tier: "pro",
    titleEn: "Cold-Start Launch Matrix Generator",
    titleZh: "Show HN / Reddit / PH / V2EX 冷启动矩阵脚本",
    script: "scripts/generate-launch-pack.mjs",
    summary: "Generates non-promotional, platform-native launch posts, UTM tracking links, and a 72-hour launch execution checklist from your repo metadata.",
  },
];

function fromBase64Url(str) {
  const normalized = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + pad, "base64");
}

export function verifyShipkitLicense(
  token,
  expectedProduct = PRODUCT_SLUG,
  pubSpkiBase64 = PUBLIC_SPKI_BASE64,
) {
  if (typeof token !== "string" || !token.trim()) {
    return { valid: false, reason: "INVALID_TYPE" };
  }
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "OPC1" || !parts[1] || !parts[2]) {
    return { valid: false, reason: "BAD_FORMAT" };
  }

  try {
    const [, payloadB64, sigB64] = parts;
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(pubSpkiBase64, "base64"),
      format: "der",
      type: "spki",
    });
    const sigOk = crypto.verify(
      null,
      Buffer.from(`OPC1.${payloadB64}`, "utf8"),
      publicKey,
      fromBase64Url(sigB64),
    );
    if (!sigOk) {
      return { valid: false, reason: "BAD_SIGNATURE" };
    }

    const payload = JSON.parse(fromBase64Url(payloadB64).toString("utf8"));
    if (!payload || typeof payload !== "object" || !("p" in payload)) {
      return { valid: false, reason: "MISSING_FIELDS", payload };
    }
    if (expectedProduct && payload.p !== expectedProduct && payload.p !== "*") {
      return { valid: false, reason: "PRODUCT_MISMATCH", payload };
    }
    if (typeof payload.exp === "number" && payload.exp > 0) {
      if (Math.floor(Date.now() / 1000) > payload.exp) {
        return { valid: false, reason: "EXPIRED", payload };
      }
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: "VERIFY_ERROR", message: err.message };
  }
}
