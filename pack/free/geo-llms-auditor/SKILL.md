---
name: geo-llms-auditor
description: Audit any website or HTML page for AI Search visibility (ChatGPT, Perplexity, Claude, Google AI Overviews) and automatically generate ready-to-deploy `llms.txt` and Schema.org `JSON-LD` files. Activate when the user asks for GEO/AEO optimization, AI citation readiness, or `llms.txt` generation.
---

# GEO & `llms.txt` Site Auditor (`geo-llms-auditor`)

Make any SaaS, indie tool, documentation site, or e-commerce storefront **citation-ready** for LLM answer engines (ChatGPT Search, Perplexity, Claude Web Search, Google AI Overviews) without guesswork.

## Core Workflow

1. **Run Deterministic Baseline Audit First**:
   Execute the bundled zero-dependency auditor against either a live URL or a local HTML build file:
   ```bash
   node <skill_dir>/scripts/audit-geo.mjs --url https://example.com --out ./geo-fix
   # Or against a local HTML file:
   node <skill_dir>/scripts/audit-geo.mjs --html ./docs/index.html --base-url https://example.com --out ./geo-fix
   ```
2. **Inspect the 5 Citation Readiness Pillars (100-Point Rubric)**:
   - **Entity Identity (25 pts)**: Clear `<title>`, `<meta name="description">`, `<link rel="canonical">`, and unambiguous category positioning in the first 200 words.
   - **Structured Facts / JSON-LD (25 pts)**: Valid `<script type="application/ld+json">` (`SoftwareApplication`, `Product`, `FAQPage`, or `Organization`) with explicit pricing/offer facts.
   - **Crawler Access & `llms.txt` (20 pts)**: `robots.txt` does NOT block `OAI-SearchBot`, `GPTBot`, `ClaudeBot`, or `PerplexityBot`, and `/llms.txt` provides a clean Markdown summary of core pages and pricing.
   - **Semantic Hierarchy (15 pts)**: Exactly one `<h1>`, scannable `<h2>`/`<h3>` question-and-answer sections, and factual comparison tables.
   - **Verifiable Specificity (15 pts)**: Concrete numbers (pricing, OS support, latency, offline guarantees) instead of vague marketing fluff ("revolutionary AI synergy").
3. **Apply Generated Artifacts**:
   - Copy generated `llms.txt` to the web root (`/public/llms.txt` or `/docs/llms.txt`).
   - Inject generated `schema.jsonld` inside `<head>` if missing or incomplete, verifying every field matches factual page content (never fabricate ratings or reviews).

## Guardrails & Anti-Patterns

- **Never fake `AggregateRating`**: Only include rating schema when real, user-visible review counts exist on the page.
- **Keep `llms.txt` concise (< 4 KB)**: Answer engines truncate bloated dumps. State what the product does, who it is for, exact pricing, technical constraints, and canonical URLs.
