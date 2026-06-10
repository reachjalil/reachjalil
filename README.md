<h1 align="center">Hey, I'm Jalil 👋</h1>

<p align="center">
  Senior software engineer in <b>San Francisco</b> building production agentic systems —<br/>
  tool calling, orchestration, evals, and realtime voice — and the full-stack TypeScript products around them.
</p>

<p align="center">
  <a href="https://reachjalil.github.io">🌐 reachjalil.github.io</a> ·
  <a href="https://www.harnessconfig.dev/">⚙️ harnessconfig.dev</a> ·
  <a href="https://linkedin.com/in/reachjalil">💼 LinkedIn</a> ·
  <a href="mailto:reachjalil@gmail.com">✉️ reachjalil@gmail.com</a>
</p>

---

## ⚙️ Harness Config — my flagship open source

[![Website](https://img.shields.io/badge/website-harnessconfig.dev-111827)](https://www.harnessconfig.dev/)
[![Specification](https://img.shields.io/badge/spec-v1%20proposal-111827)](https://www.harnessconfig.dev/specifications/v1/)
[![npm harnessc](https://img.shields.io/npm/v/harnessc?label=harnessc)](https://www.npmjs.com/package/harnessc)
[![npm @harnessconfig/core](https://img.shields.io/npm/v/@harnessconfig/core?label=%40harnessconfig%2Fcore)](https://www.npmjs.com/package/@harnessconfig/core)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](https://github.com/reachjalil/harness-config/blob/main/LICENSE)

Modern repos carry `AGENTS.md`, `CLAUDE.md`, `.cursor/`, Copilot instructions, and more — the same prompt
copied five places, and only one copy ever changes. **[Harness Config](https://github.com/reachjalil/harness-config)**
is an open specification + TypeScript reference CLI that keeps durable agent configuration in one reviewed
source root and projects it one-way into every surface each tool reads.

```text
.harness/ source  →  validate  →  preview activation  →  live surfaces

AGENTS.md   .agents/   .claude/   .cursor/   custom targets
```

```bash
npx harnessc init && npx harnessc validate && npx harnessc project
```

Works across **Claude Code, Codex, Cursor, Gemini CLI, and GitHub Copilot** — spec-first, with a manifest
schema, projection model, ignore grammar, and conformance contract.

## 🛠 More things I've built

| Project | What it is |
| --- | --- |
| [skills-kit](https://github.com/reachjalil/skills-kit) | Repo-local skill switchboard for AI agent skill libraries — `@skills-kit/cli` on npm |
| [speechglow-mac](https://github.com/reachjalil/speechglow-mac) | macOS menu-bar app with on-device speech detection (Silero VAD) — no recording, no upload |
| [web-seek](https://github.com/reachjalil/web-seek) | Browser QA automation briefs: demonstrate flows in headed Chrome, hand validated briefs to QA agents |
| [prettui](https://github.com/reachjalil/prettui) | Composable terminal-UI packages for exact-frame TUIs — `@prettui/kit` on npm |
| [betterformula](https://github.com/reachjalil/betterformula) | IDE-like experience for Salesforce formulas — browser extension with 13k+ users |

Also in private beta: **VibeExchange**, an agent-orchestration platform on Cloudflare Durable Objects —
virtual filesystem, WebSocket sync, tool execution, run tracing, and usage budgeting.

## 🧰 Stack

`TypeScript` `Node.js` `React` `Astro` `Cloudflare Workers` `Durable Objects` `Hono` `WebSockets`
`OpenAI / Anthropic / Gemini` `OpenAI Realtime` `VAD / realtime STT` `Vitest` `Playwright` `GitHub Actions` `pnpm / Turbo`

---

<p align="center">
  📍 Downtown San Francisco · on-site five days a week · open to senior AI product engineering roles
</p>
