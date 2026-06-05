#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const HOME = process.env.HOME || "/Users/sjp1212";
const CODEX_HOME = process.env.CODEX_HOME || path.join(HOME, ".codex");
const DEFAULT_REPO = path.join(CODEX_HOME, "subagents", "awesome-codex-subagents");
const DEFAULT_AGENTS_DIR = path.join(CODEX_HOME, "agents");
const REGISTRY_PATH = path.join(CODEX_HOME, "subagents", "registry.json");
const JUDGEMENT_SCHEMA_PATH = path.join(CODEX_HOME, "subagents", "judgement.schema.json");
const STRATEGY_CONFIG_PATH = path.join(CODEX_HOME, "subagents", "strategy-config.json");
const COMMUNITY_SKILLS_MANIFEST_PATH = path.join(CODEX_HOME, "subagents", "community-skills-manifest.json");
const JUDGEMENT_CACHE_PATH = path.join(CODEX_HOME, "subagents", "judgement-cache.json");
const EVAL_RESULTS_PATH = path.join(CODEX_HOME, "subagents", "last-eval-results.json");
const CODEX_CLI = "/Applications/Codex.app/Contents/Resources/codex";

const DEFAULT_COST_POLICY = {
  budgets: ["economy", "balanced", "premium", "critical"],
  highRiskIntents: ["security", "review", "planning", "devops", "data-ai"],
  volatileContextPattern: "current diff|当前\\s*diff|git diff|uncommitted|working tree|当前分支|日志|log\\b|stack trace|traceback|报错输出|失败输出|test output|文件\\s*:|/[\\w.-]+/|第\\s*\\d+\\s*行|line\\s+\\d+",
  candidateBudgets: {
    critical: { agents: 8, skills: 18 },
    premium: { agents: 6, skills: 16 },
    balanced: { agents: 5, skills: 12 },
    economy: { agents: 4, skills: 10 },
    economyLowRisk: { agents: 3, skills: 8 },
  },
  cache: {
    maxEntries: 200,
  },
};

const MODEL_MAP = new Map([
  ["gpt-5.3-codex-spark", "gpt-5.3-codex"],
  ["gpt-5.3-codex", "gpt-5.3-codex"],
  ["gpt-5.4", "gpt-5.4"],
  ["gpt-5.4-mini", "gpt-5.4-mini"],
  ["gpt-5.5", "gpt-5.5"],
]);

const MODEL_ORDER = new Map([
  ["gpt-5.4-mini", 1],
  ["gpt-5.3-codex", 2],
  ["gpt-5.4", 3],
  ["gpt-5.5", 4],
]);

const EFFORT_ORDER = new Map([
  ["low", 1],
  ["medium", 2],
  ["high", 3],
  ["xhigh", 4],
]);

const DEFAULT_SKILL_RULES = [
  {
    reason: "frontend implementation, UI behavior, or browser-facing debugging",
    confidence: "high",
    skills: ["build-web-apps:frontend-app-builder", "build-web-apps:frontend-testing-debugging", "compound-engineering:ce-frontend-design"],
    patterns: [/front[- ]?end|react|vue|angular|next\.?js|ui\b|css|tailwind|browser|页面|前端|组件|样式|交互|可访问/i],
  },
  {
    reason: "iOS, SwiftUI, Simulator, or Apple-platform work",
    confidence: "high",
    skills: ["build-ios-apps:swiftui-ui-patterns", "build-ios-apps:ios-debugger-agent", "build-ios-apps:ios-simulator-browser"],
    patterns: [/ios|iphone|ipad|swiftui|swift\b|xcode|simulator|app intent|苹果|移动端/i],
  },
  {
    reason: "GitHub, pull request, issue, or CI workflow work",
    confidence: "high",
    skills: ["github:github", "github:gh-fix-ci", "github:gh-address-comments"],
    patterns: [/github|pull request|\bpr\b|issue|ci\b|workflow|actions|review comment|合并请求|代码审查|流水线/i],
  },
  {
    reason: "code review, diff inspection, or risk-focused review",
    confidence: "high",
    skills: ["compound-engineering:ce-code-review", "github:gh-address-comments"],
    patterns: [/审查|代码审查|review|diff|pull request|\bpr\b/i],
  },
  {
    reason: "debugging, failure reproduction, or regression investigation",
    confidence: "high",
    skills: ["superpowers:systematic-debugging", "compound-engineering:ce-debug", "agyb-essentials:systematic-debugging"],
    patterns: [/debug|bug|error|exception|crash|fail|flaky|regression|报错|崩溃|失败|修复|问题/i],
  },
  {
    reason: "test automation, coverage, or verification workflow",
    confidence: "high",
    skills: ["superpowers:test-driven-development", "agyb-essentials:lint-and-validate", "build-web-apps:frontend-testing-debugging"],
    patterns: [/test|qa|coverage|pytest|vitest|jest|playwright|测试|用例|覆盖率|自动化测试/i],
  },
  {
    reason: "planning, written implementation plan execution, or multi-agent workflow",
    confidence: "medium",
    skills: ["superpowers:writing-plans", "superpowers:executing-plans", "superpowers:subagent-driven-development"],
    patterns: [/plan|implement this plan|roadmap|执行计划|实现方案|规划|计划|多代理/i],
  },
  {
    reason: "backend API, service boundary, persistence, or authentication work",
    confidence: "high",
    skills: ["agyb-full-stack-developer:api-patterns", "agyb-full-stack-developer:backend-dev-guidelines"],
    patterns: [/api|backend|server|auth|database|postgres|redis|queue|后端|接口|鉴权|数据库|服务端/i],
  },
  {
    reason: "security, privacy, permission, or threat-model risk",
    confidence: "high",
    skills: ["security-best-practices", "security-threat-model", "compound-engineering:ce-code-review"],
    patterns: [/security|vulnerability|auth|permission|secret|xss|csrf|sql injection|安全|漏洞|权限|隐私/i],
  },
];

let skillRegistryCache = null;
let availableSkillNameSetCache = null;

const INTENT_RULES = [
  {
    id: "review",
    label: "review and risk analysis",
    patterns: [[/审查|代码审查|review|diff|regression|correctness|security review|pr\b|pull request/i, 45]],
    preferredAgents: ["reviewer", "code-reviewer", "architect-reviewer"],
    categories: ["04-quality-security"],
    preferredSandbox: "read-only",
  },
  {
    id: "frontend",
    label: "frontend implementation or UI debugging",
    patterns: [[/front[- ]?end|react|vue|angular|next\.?js|ui\b|css|tailwind|browser|前端|页面|组件|样式|交互|布局/i, 45]],
    preferredAgents: ["frontend-developer", "react-specialist", "ui-fixer", "browser-debugger"],
    categories: ["01-core-development", "02-language-specialists", "04-quality-security"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "backend",
    label: "backend API, service, or persistence work",
    patterns: [[/api|backend|server|service|auth|authentication|billing|database|postgres|redis|queue|后端|接口|鉴权|认证|计费|数据库|服务端/i, 45]],
    preferredAgents: ["backend-developer", "api-designer", "security-engineer", "database-administrator"],
    categories: ["01-core-development", "02-language-specialists", "03-infrastructure", "05-data-ai"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "debug",
    label: "debugging or failure investigation",
    patterns: [[/debug|bug|error|exception|crash|fail|flaky|regression|报错|崩溃|失败|修复|问题/i, 35]],
    preferredAgents: ["debugger", "error-detective", "browser-debugger", "test-automator"],
    categories: ["04-quality-security"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "testing",
    label: "test automation or coverage",
    patterns: [[/test|qa|coverage|playwright|pytest|vitest|jest|测试|用例|覆盖率|自动化测试/i, 45]],
    preferredAgents: ["test-automator", "qa-expert", "ui-ux-tester"],
    categories: ["04-quality-security"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "security",
    label: "security, privacy, or permission risk",
    patterns: [[/security|vulnerability|permission|secret|xss|csrf|sql injection|threat model|安全|漏洞|权限|隐私|合规|威胁建模/i, 42]],
    preferredAgents: ["security-auditor", "security-engineer", "penetration-tester", "reviewer"],
    categories: ["03-infrastructure", "04-quality-security"],
    preferredSandbox: "read-only",
  },
  {
    id: "github",
    label: "GitHub, PR, issue, or CI workflow",
    patterns: [[/github|pull request|\bpr\b|issue|actions|workflow|ci\b|合并请求|代码审查|流水线/i, 42]],
    preferredAgents: ["github-expert", "ci-fixer", "reviewer", "deployment-engineer"],
    categories: ["06-developer-experience", "03-infrastructure", "04-quality-security"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "devops",
    label: "deployment, infrastructure, or operations",
    patterns: [[/deploy|docker|kubernetes|k8s|terraform|ci|cd|pipeline|infra|部署|容器|运维|流水线/i, 45]],
    preferredAgents: ["deployment-engineer", "devops-engineer", "docker-expert", "sre-engineer"],
    categories: ["03-infrastructure"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "ios",
    label: "iOS, SwiftUI, or Apple platform",
    patterns: [[/ios|swift|swiftui|xcode|iphone|ipad|simulator|app intent|苹果|移动端/i, 58]],
    preferredAgents: ["swift-expert", "mobile-developer", "expo-react-native-expert"],
    categories: ["02-language-specialists", "01-core-development"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "data-ai",
    label: "data, ML, or AI systems",
    patterns: [[/data|analytics|ml|machine learning|llm|rag|prompt|dataset|openai|responses api|agents sdk|langgraph|agent|数据|机器学习|大模型|向量|智能体/i, 42]],
    preferredAgents: ["ai-engineer", "llm-architect", "data-engineer", "data-analyst"],
    categories: ["05-data-ai"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "docs",
    label: "documentation or technical writing",
    patterns: [[/docs|documentation|readme|changelog|release note|文档|说明|教程|发布说明/i, 40]],
    preferredAgents: ["documentation-engineer", "docs-researcher", "technical-writer", "content-quality-editor"],
    categories: ["06-developer-experience", "12-content-localization"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "research",
    label: "documentation-backed research or source verification",
    patterns: [[/research|official docs|documentation|docs|verify|confirm|调研|官方文档|确认|查资料|资料/i, 52]],
    preferredAgents: ["docs-researcher", "search-specialist", "research-analyst", "api-designer"],
    categories: ["06-developer-experience", "11-specialized-domains", "01-core-development"],
    preferredSandbox: "read-only",
  },
  {
    id: "planning",
    label: "planning, architecture, or sequencing",
    patterns: [[/plan|roadmap|architecture|design|执行计划|实现方案|规划|计划|架构|设计/i, 36]],
    preferredAgents: ["project-manager", "architect-reviewer", "business-analyst", "code-mapper"],
    categories: ["08-business-product", "04-quality-security", "01-core-development"],
    preferredSandbox: "read-only",
  },
  {
    id: "product",
    label: "product, market, or user-impact analysis",
    patterns: [[/product|market|用户|产品|需求|商业|增长|定位|路线图/i, 38]],
    preferredAgents: ["product-manager", "risk-manager", "research-analyst", "market-researcher"],
    categories: ["08-business-product", "11-specialized-domains"],
    preferredSandbox: "read-only",
  },
];

function usage() {
  console.log(`Codex subagent router

Usage:
  router.mjs rebuild
  router.mjs list [query]
  router.mjs route [--json|--brief] <task>
  router.mjs judge [--json|--explain|--offline] [--budget economy|balanced|premium|critical] [--no-cache] [--force-model] <task>
  router.mjs prompt <agent-name> <task>
  router.mjs install-all
  router.mjs test
  router.mjs eval [--json]
  router.mjs test-recovery
  router.mjs test-handoff
  router.mjs test-judge
  router.mjs doctor [--json]
  router.mjs report [--json]

Environment:
  CODEX_HOME   Defaults to ~/.codex
`);
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function walkFiles(dir, filename, limit = 2000) {
  if (!fs.existsSync(dir) || limit <= 0) return [];
  const out = [];
  const stack = [dir];
  while (stack.length && out.length < limit) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory() && ![".git", "node_modules", "target", "dist", "build"].includes(entry.name)) {
        stack.push(full);
      } else if (entry.isFile() && entry.name === filename) {
        out.push(full);
      }
      if (out.length >= limit) break;
    }
  }
  return out.sort();
}

function walkToml(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkToml(full));
    if (entry.isFile() && entry.name.endsWith(".toml")) out.push(full);
  }
  return out.sort();
}

function captureTomlString(text, key) {
  const block = text.match(new RegExp(`(?:^|\\n)${key}\\s*=\\s*"""([\\s\\S]*?)"""`));
  if (block) return block[1].trim();
  const single = text.match(new RegExp(`(?:^|\\n)${key}\\s*=\\s*"([^"\\n]*)"`));
  return single ? single[1].trim() : "";
}

function parseSkill(file) {
  const text = readText(file);
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return null;
  const body = frontmatter[1];
  const name = body.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const description = body.match(/^description:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (!name || !description) return null;
  return { name, description, path: file };
}

function loadSkillRegistry() {
  if (skillRegistryCache) return skillRegistryCache;
  const roots = [
    path.join(CODEX_HOME, "skills"),
    path.join(HOME, ".agents", "skills"),
    path.join(CODEX_HOME, "plugins", "cache"),
  ];
  const byName = new Map();
  for (const root of roots) {
    for (const file of walkFiles(root, "SKILL.md")) {
      const skill = parseSkill(file);
      if (skill && !byName.has(skill.name)) byName.set(skill.name, skill);
    }
  }
  skillRegistryCache = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return skillRegistryCache;
}

function parseAgent(file, repoRoot = DEFAULT_REPO) {
  const text = readText(file);
  const rel = path.relative(repoRoot, file);
  const parts = rel.split(path.sep);
  const category = parts[0] === "categories" ? parts[1] : "global";
  const instructions = captureTomlString(text, "developer_instructions") || captureTomlString(text, "text");
  const name = captureTomlString(text, "name") || path.basename(file, ".toml");
  const description = captureTomlString(text, "description");
  const model = captureTomlString(text, "model");
  const sandboxMode = captureTomlString(text, "sandbox_mode") || "read-only";
  return {
    name,
    description,
    model,
    compatibleModel: MODEL_MAP.get(model) || "gpt-5.5",
    sandboxMode,
    runtimeRole: sandboxMode === "workspace-write" ? "worker" : "explorer",
    category,
    sourcePath: file,
    installedPath: path.join(DEFAULT_AGENTS_DIR, `${path.basename(file)}`),
    instructions,
  };
}

function buildRegistry() {
  const categoryRoot = path.join(DEFAULT_REPO, "categories");
  const agents = walkToml(categoryRoot).map((file) => parseAgent(file, DEFAULT_REPO));
  const registry = {
    generatedAt: new Date().toISOString(),
    source: DEFAULT_REPO,
    agentsDir: DEFAULT_AGENTS_DIR,
    count: agents.length,
    agents,
  };
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
  return registry;
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return buildRegistry();
  return JSON.parse(readText(REGISTRY_PATH));
}

function compileSkillRule(rule) {
  if (rule.patterns?.[0] instanceof RegExp) return rule;
  return {
    ...rule,
    phase: rule.phase || "implementation",
    priority: Number.isFinite(rule.priority) ? rule.priority : 50,
    patterns: (rule.patterns || []).map((pattern) => new RegExp(pattern, "i")),
  };
}

function loadStrategyConfig() {
  try {
    const raw = JSON.parse(readText(STRATEGY_CONFIG_PATH));
    const skillRules = Array.isArray(raw.skillRules) && raw.skillRules.length
      ? raw.skillRules.map(compileSkillRule)
      : DEFAULT_SKILL_RULES.map(compileSkillRule);
    return {
      version: raw.version || 1,
      skillRules,
      executionProfiles: raw.executionProfiles || {},
      costPolicy: {
        ...DEFAULT_COST_POLICY,
        ...(raw.costPolicy || {}),
        candidateBudgets: {
          ...DEFAULT_COST_POLICY.candidateBudgets,
          ...(raw.costPolicy?.candidateBudgets || {}),
        },
        cache: {
          ...DEFAULT_COST_POLICY.cache,
          ...(raw.costPolicy?.cache || {}),
        },
      },
      source: STRATEGY_CONFIG_PATH,
      configLoaded: true,
    };
  } catch {
    return {
      version: 0,
      skillRules: DEFAULT_SKILL_RULES.map(compileSkillRule),
      executionProfiles: {},
      costPolicy: DEFAULT_COST_POLICY,
      source: "built-in defaults",
      configLoaded: false,
    };
  }
}

function validateStrategyConfig(config = loadStrategyConfig()) {
  const errors = [];
  const warnings = [];
  if (!config.configLoaded) errors.push(`strategy config did not load from ${STRATEGY_CONFIG_PATH}`);
  if (!Array.isArray(config.skillRules) || config.skillRules.length === 0) errors.push("strategy config has no skill rules");
  const seenIds = new Set();
  for (const rule of config.skillRules || []) {
    if (!rule.id) warnings.push("skill rule without id");
    if (rule.id && seenIds.has(rule.id)) errors.push(`duplicate skill rule id: ${rule.id}`);
    if (rule.id) seenIds.add(rule.id);
    if (!Array.isArray(rule.skills) || rule.skills.length === 0) errors.push(`skill rule ${rule.id || "unknown"} has no skills`);
    if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) errors.push(`skill rule ${rule.id || "unknown"} has no patterns`);
  }
  for (const budget of DEFAULT_COST_POLICY.budgets) {
    const candidateBudget = config.costPolicy?.candidateBudgets?.[budget === "economy" ? "economy" : budget];
    if (!candidateBudget?.agents || !candidateBudget?.skills) errors.push(`missing candidate budget for ${budget}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

function loadCommunitySkillManifest() {
  try {
    const manifest = JSON.parse(readText(COMMUNITY_SKILLS_MANIFEST_PATH));
    const byName = new Map();
    for (const skill of manifest.installed || []) byName.set(skill.installedName, skill);
    return { loaded: true, count: manifest.count || 0, byName };
  } catch {
    return { loaded: false, count: 0, byName: new Map() };
  }
}

function installAll() {
  const registry = buildRegistry();
  fs.mkdirSync(DEFAULT_AGENTS_DIR, { recursive: true });
  for (const agent of registry.agents) {
    fs.copyFileSync(agent.sourcePath, agent.installedPath);
  }
  return registry;
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function cleanTask(task) {
  return normalize(task)
    .replace(/开启子代理|子代理|子agent|调用代理|多代理|自动选(?:择)?\s*agent/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function availableSkillNameSet() {
  if (!availableSkillNameSetCache) {
    availableSkillNameSetCache = new Set(loadSkillRegistry().flatMap((skill) => [skill.name, skill.name.split(":").at(-1)]));
  }
  return availableSkillNameSetCache;
}

function skillNameAvailable(name, skillNames = availableSkillNameSet()) {
  return skillNames.has(name) || skillNames.has(String(name).split(":").at(-1));
}

function classifyFailure(errorMessage = "") {
  const text = String(errorMessage);
  if (!text) return "none";
  if (/offline mode/i.test(text)) return "offline";
  if (/Invalid schema|invalid_json_schema|schema/i.test(text)) return "schema-error";
  if (/model|available models|unknown model|upstream_error/i.test(text)) return "model-unavailable";
  if (/JSON|parse|Unexpected token|output/i.test(text)) return "invalid-output";
  if (/ENOENT|not found|no such file/i.test(text)) return "missing-file";
  if (/timed out|timeout/i.test(text)) return "timeout";
  return "unknown";
}

function classifyIntents(task) {
  const cleaned = cleanTask(task);
  const matches = [];
  for (const rule of INTENT_RULES) {
    const matchedPatterns = [];
    let score = 0;
    for (const [pattern, weight] of rule.patterns) {
      if (pattern.test(cleaned)) {
        matchedPatterns.push(pattern.source);
        score += weight;
      }
    }
    if (score > 0) {
      matches.push({
        id: rule.id,
        label: rule.label,
        score,
        preferredAgents: rule.preferredAgents,
        categories: rule.categories,
        preferredSandbox: rule.preferredSandbox,
        matchedPatterns,
      });
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}

function tokenize(task) {
  return cleanTask(task)
    .split(/[^a-z0-9+#.]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !["the", "and", "with", "this", "that", "帮我"].includes(word));
}

function fieldMatchScore(field, words, weight) {
  const haystack = normalize(field);
  let score = 0;
  for (const word of words) {
    if (haystack.includes(word)) score += weight * (word.length > 8 ? 2 : 1);
  }
  return score;
}

function scoreAgent(agent, task, intents) {
  const words = tokenize(task);
  const breakdown = {
    explicitName: cleanTask(task).includes(agent.name) ? 180 : 0,
    intent: 0,
    category: 0,
    keyword: 0,
    sandbox: 0,
    penalty: 0,
  };
  const reasons = [];
  const primaryIntent = intents[0]?.id;
  const categoryMatches = new Set();

  for (const intent of intents) {
    const isPrimary = intent.id === primaryIntent;
    const preferredIndex = intent.preferredAgents.indexOf(agent.name);
    if (preferredIndex >= 0) {
      let points = 110 - preferredIndex * 14 + Math.min(intent.score, 50);
      if (isPrimary && preferredIndex === 0) points += 36;
      if (!isPrimary) points = Math.round(points * 0.35);
      breakdown.intent += points;
      reasons.push(`preferred for ${intent.id}`);
    }
    if (intent.categories.includes(agent.category)) {
      categoryMatches.add(intent.id);
      reasons.push(`category matches ${intent.id}`);
    }
    if (agent.sandboxMode === intent.preferredSandbox) {
      breakdown.sandbox += isPrimary ? 10 : 4;
    }
  }
  breakdown.category += Math.min(categoryMatches.size, 2) * 12;

  breakdown.keyword += fieldMatchScore(agent.name, words, 8);
  breakdown.keyword += fieldMatchScore(agent.description, words, 4);
  breakdown.keyword += fieldMatchScore(agent.category, words, 2);
  breakdown.keyword += Math.min(fieldMatchScore(agent.instructions, words, 1), 16);

  const writeTask = /fix|implement|build|create|edit|update|refactor|修复|实现|创建|修改|改|写|补齐|重构/i.test(task);
  const readTask = /review|audit|inspect|analy[sz]e|diff|审查|审核|分析|调研|检查/i.test(task);
  if (writeTask && agent.sandboxMode === "workspace-write") breakdown.sandbox += 18;
  if (readTask && agent.sandboxMode === "read-only") breakdown.sandbox += 18;
  if (writeTask && agent.sandboxMode === "read-only" && !/review|audit|审查|审核/.test(task)) breakdown.penalty -= 16;
  if (readTask && agent.sandboxMode === "workspace-write" && /review|audit|审查|审核/.test(task)) breakdown.penalty -= 22;

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { agent, score: total, breakdown, reasons: unique(reasons) };
}

function confidenceFor(ranked, intents) {
  const top = ranked[0]?.score || 0;
  const second = ranked[1]?.score || 0;
  const margin = top - second;
  if (intents.length === 0 || top < 55) return "low";
  if (top >= 135 && margin >= 24) return "high";
  if (top >= 78 && margin >= 8) return "medium";
  return "low";
}

function isVagueTask(task, ranked) {
  const cleaned = cleanTask(task);
  const vague = /奇怪|问题|情况|东西|这个|看看|帮我看|不对|something|thing|issue/i.test(cleaned);
  const concrete = /api|auth|database|react|vue|swift|docker|kubernetes|pytest|diff|error|stack|file|接口|鉴权|数据库|前端|页面|部署|测试|代码|文件|日志/i.test(cleaned);
  const topKeyword = ranked[0]?.breakdown?.keyword || 0;
  return vague && !concrete && topKeyword < 8;
}

function computeModelPolicy(task, agent, routeLike = {}) {
  const cleaned = cleanTask(task);
  const intentIds = (routeLike.matchedIntents || []).map((intent) => intent.id);
  const agentName = agent?.name || "";
  const agentText = normalize(`${agentName} ${agent?.description || ""} ${agent?.category || ""}`);
  const reasons = [];

  let importanceLevel = "normal";
  let selectedModel = "gpt-5.4";
  let reasoningEffort = "medium";

  const criticalSignals = [
    [/security|vulnerability|permission|secret|privacy|compliance|auth|oauth|token|安全|漏洞|权限|隐私|合规|鉴权|认证/i, "security/auth/privacy/compliance risk"],
    [/architecture|distributed|microservice|migration|data loss|rollback|transaction|架构|迁移|数据丢失|回滚|事务|分布式/i, "architecture, migration, or consistency risk"],
    [/production|incident|outage|sre|downtime|prod|线上|事故|故障|宕机|生产/i, "production or incident risk"],
    [/review|审查|代码审查|diff|pull request|\bpr\b/i, "risk-focused review work"],
    [/multi-agent|多代理|orchestrat|协调|计划书|执行计划/i, "coordination or planning complexity"],
  ];
  const simpleSignals = [
    [/docs|readme|changelog|typo|format|文档|说明|拼写|格式/i, "simple documentation or formatting task"],
    [/rename|copy|list|summarize|简单|小改|轻微/i, "small low-risk task"],
  ];

  for (const [pattern, reason] of criticalSignals) {
    if (pattern.test(cleaned)) reasons.push(reason);
  }

  if (routeLike.confidence === "low" || routeLike.needsParentChoice) {
    reasons.push("low confidence or ambiguous route");
  }

  if (intentIds.some((id) => ["security", "planning", "review", "devops", "data-ai"].includes(id))) {
    reasons.push(`important intent: ${intentIds.find((id) => ["security", "planning", "review", "devops", "data-ai"].includes(id))}`);
  }

  if (/architect|security|auditor|reviewer|incident|sre|compliance|penetration|risk|llm-architect|microservices/.test(agentName)) {
    reasons.push(`important specialist agent: ${agentName}`);
  }

  const hasSimpleSignal = simpleSignals.some(([pattern]) => pattern.test(cleaned));
  const hasCriticalSignal = reasons.length > 0;

  if (hasCriticalSignal) {
    importanceLevel = routeLike.confidence === "low" || /security|auth|production|incident|architecture|migration|review|审查|鉴权|安全|事故|架构|迁移/i.test(cleaned)
      ? "critical"
      : "high";
    selectedModel = "gpt-5.5";
    reasoningEffort = importanceLevel === "critical" ? "high" : "medium";
  } else if (hasSimpleSignal && agent?.runtimeRole === "explorer") {
    importanceLevel = "low";
    selectedModel = "gpt-5.4-mini";
    reasoningEffort = "low";
    reasons.push(simpleSignals.find(([pattern]) => pattern.test(cleaned))?.[1] || "low-risk task");
  } else if (hasSimpleSignal) {
    importanceLevel = "low";
    selectedModel = "gpt-5.4-mini";
    reasoningEffort = "medium";
    reasons.push(simpleSignals.find(([pattern]) => pattern.test(cleaned))?.[1] || "low-risk task");
  }

  if (agent?.runtimeRole === "worker" && importanceLevel === "normal") {
    selectedModel = "gpt-5.4";
    reasoningEffort = /bug|debug|fail|修复|失败|报错/i.test(cleaned) ? "high" : "medium";
    if (reasoningEffort === "high") reasons.push("implementation/debugging benefits from deeper reasoning");
  }

  return {
    importanceLevel,
    selectedModel,
    reasoningEffort,
    modelRationale: unique(reasons.length ? reasons : ["normal scoped task; use balanced model and reasoning"]),
  };
}

function computeTaskProfile(task, routeLike = {}) {
  const cleaned = cleanTask(task);
  const intentIds = (routeLike.matchedIntents || []).map((intent) => intent.id);
  const signals = [];
  const writeIntent = /fix|implement|build|create|edit|update|refactor|修复|实现|创建|修改|改|写|补齐|重构/i.test(cleaned)
    ? "expected"
    : /review|audit|analy[sz]e|审查|分析|调研|检查/i.test(cleaned)
      ? "none"
      : "possible";

  let risk = "low";
  let complexity = "low";
  let scope = "local";

  const highRisk = /security|auth|permission|secret|privacy|production|incident|migration|data loss|安全|鉴权|权限|隐私|生产|事故|迁移|数据丢失/i.test(cleaned);
  const crossSystem = /microservice|distributed|integration|cross[- ]?module|multiple|全局|跨模块|多服务|分布式|集成/i.test(cleaned);
  const broadPlan = /plan|architecture|roadmap|multi-agent|执行计划|架构|规划|多代理/i.test(cleaned);

  if (highRisk) {
    risk = /production|incident|data loss|生产|事故|数据丢失/i.test(cleaned) ? "critical" : "high";
    signals.push("high-risk domain signal");
  }
  if (routeLike.confidence === "low" || routeLike.needsParentChoice) {
    risk = risk === "critical" ? "critical" : "medium";
    scope = "unknown";
    signals.push("low routing confidence");
  }
  if (intentIds.some((id) => ["security", "review", "devops", "data-ai"].includes(id))) {
    risk = risk === "critical" ? "critical" : "high";
    signals.push(`important intent: ${intentIds.find((id) => ["security", "review", "devops", "data-ai"].includes(id))}`);
  }

  if (crossSystem || broadPlan) {
    complexity = "high";
    scope = crossSystem ? "cross-system" : "subsystem";
    signals.push(crossSystem ? "cross-system scope" : "planning/architecture scope");
  } else if (intentIds.length > 1 || writeIntent === "expected") {
    complexity = "medium";
    scope = "subsystem";
  }

  if (/readme|typo|format|拼写|格式/.test(cleaned) && !highRisk) {
    complexity = "low";
    risk = "low";
    scope = "local";
    signals.push("low-risk docs or formatting signal");
  }

  return { complexity, risk, scope, writeIntent, signals: unique(signals) };
}

function clampText(text, max = 180) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 3)}...` : compact;
}

function routeMargin(route) {
  const scores = route.candidates?.map((candidate) => candidate.score).sort((a, b) => b - a) || [];
  if (scores.length < 2) return scores[0] || 0;
  return scores[0] - scores[1];
}

function hasVolatileContext(task) {
  const policy = loadStrategyConfig().costPolicy || DEFAULT_COST_POLICY;
  return new RegExp(policy.volatileContextPattern || DEFAULT_COST_POLICY.volatileContextPattern, "i").test(task);
}

function computeCandidateBudget(taskProfile, modelPolicy, route, budget) {
  const budgets = loadStrategyConfig().costPolicy?.candidateBudgets || DEFAULT_COST_POLICY.candidateBudgets;
  const risk = taskProfile.risk;
  const complex = taskProfile.complexity === "high";
  const uncertain = route.confidence !== "high" || route.needsParentChoice;
  if (budget === "critical" || modelPolicy.importanceLevel === "critical" || risk === "critical") return budgets.critical;
  if (budget === "premium" || risk === "high" || complex || uncertain) return budgets.premium;
  if (budget === "economy" && modelPolicy.importanceLevel === "low") return budgets.economyLowRisk || budgets.economy;
  if (budget === "economy") return budgets.economy;
  return budgets.balanced;
}

function computeJudgePolicy(task, route, options = {}) {
  const budget = ["economy", "balanced", "premium", "critical"].includes(options.budget) ? options.budget : "balanced";
  const taskProfile = route.taskProfile || computeTaskProfile(task, route);
  const modelPolicy = route.modelPolicy || computeModelPolicy(task, route.recommended, route);
  const volatileContext = hasVolatileContext(task);
  const margin = routeMargin(route);
  const reasons = [];
  let judgeMode = "standard-judge";
  let judgeModel = "gpt-5.4";

  const highRisk = ["critical", "high"].includes(taskProfile.risk) || ["critical", "high"].includes(modelPolicy.importanceLevel);
  const ambiguous = route.confidence === "low" || route.needsParentChoice || taskProfile.scope === "unknown";
  const highRiskIntents = loadStrategyConfig().costPolicy?.highRiskIntents || DEFAULT_COST_POLICY.highRiskIntents;
  const importantIntent = route.matchedIntents?.some((intent) => highRiskIntents.includes(intent.id));
  const safeDeterministic =
    !options.forceModel &&
    !volatileContext &&
    route.confidence === "high" &&
    margin >= 24 &&
    taskProfile.risk === "low" &&
    taskProfile.complexity === "low" &&
    modelPolicy.importanceLevel === "low";

  if (safeDeterministic && ["economy", "balanced"].includes(budget)) {
    judgeMode = "deterministic";
    judgeModel = "none";
    reasons.push("low-risk, high-confidence route with clear candidate margin; skip model judge");
  } else if (budget === "critical" || highRisk || ambiguous || importantIntent) {
    judgeMode = "premium-judge";
    judgeModel = "gpt-5.5";
    if (highRisk) reasons.push("quality gate: high/critical risk keeps GPT-5.5 judge");
    if (ambiguous) reasons.push("quality gate: ambiguous route needs stronger judgement");
    if (importantIntent) reasons.push("quality gate: important intent detected");
  } else if (budget === "economy" && route.confidence === "high" && margin >= 18 && !volatileContext) {
    judgeMode = "mini-judge";
    judgeModel = "gpt-5.4-mini";
    reasons.push("economy budget with stable high-confidence route uses compact mini judge");
  } else if (budget === "premium") {
    judgeMode = "premium-judge";
    judgeModel = "gpt-5.5";
    reasons.push("premium budget requests strongest judge unless already deterministic-safe");
  } else {
    reasons.push("balanced route uses GPT-5.4 judge with compressed candidates");
  }

  if (options.forceModel && judgeMode === "deterministic") {
    judgeMode = budget === "critical" || budget === "premium" ? "premium-judge" : "standard-judge";
    judgeModel = judgeMode === "premium-judge" ? "gpt-5.5" : "gpt-5.4";
    reasons.push("force-model requested");
  }

  const candidateBudget = computeCandidateBudget(taskProfile, modelPolicy, route, budget);
  return {
    budget,
    judgeMode,
    judgeModel,
    costRationale: unique(reasons),
    candidateBudget,
    cacheEligible: !volatileContext,
    cacheBypassReason: volatileContext ? "volatile current-context task; avoid stale routing cache" : "",
    routeMargin: margin,
  };
}

function cacheKeyFor(task, policy, route, skillCandidates) {
  const registry = loadRegistry();
  const community = loadCommunitySkillManifest();
  const payload = {
    routerMetadataVersion: 8,
    task: cleanTask(task),
    budget: policy.budget,
    judgeMode: policy.judgeMode,
    judgeModel: policy.judgeModel,
    strategyVersion: route.strategyConfig?.version || 0,
    registryCount: registry.count || registry.agents?.length || 0,
    communitySkillCount: community.count || 0,
    skillCandidateNames: skillCandidates.map((skill) => skill.name),
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function readJudgementCache() {
  try {
    const cache = JSON.parse(readText(JUDGEMENT_CACHE_PATH));
    return cache && typeof cache === "object" ? cache : { version: 1, entries: {} };
  } catch (error) {
    if (fs.existsSync(JUDGEMENT_CACHE_PATH)) {
      const quarantinePath = `${JUDGEMENT_CACHE_PATH}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(JUDGEMENT_CACHE_PATH, quarantinePath);
      } catch {
        // If quarantine fails, continue with an empty cache.
      }
    }
    return { version: 1, entries: {} };
  }
}

function writeJudgementCache(cache) {
  fs.mkdirSync(path.dirname(JUDGEMENT_CACHE_PATH), { recursive: true });
  const maxEntries = loadStrategyConfig().costPolicy?.cache?.maxEntries || DEFAULT_COST_POLICY.cache.maxEntries;
  const entries = Object.entries(cache.entries || {})
    .sort((a, b) => (b[1].createdAt || "").localeCompare(a[1].createdAt || ""))
    .slice(0, maxEntries);
  fs.writeFileSync(JUDGEMENT_CACHE_PATH, `${JSON.stringify({ version: 1, entries: Object.fromEntries(entries) }, null, 2)}\n`);
}

function getCachedJudgement(key) {
  const cache = readJudgementCache();
  const entry = cache.entries?.[key];
  if (!entry?.result) return null;
  return {
    ...entry.result,
    cache: {
      hit: true,
      key,
      createdAt: entry.createdAt,
      eligible: true,
    },
  };
}

function putCachedJudgement(key, result) {
  const cache = readJudgementCache();
  cache.entries ||= {};
  cache.entries[key] = {
    createdAt: new Date().toISOString(),
    result: {
      ...result,
      cache: {
        hit: false,
        key,
        eligible: true,
        written: true,
      },
    },
  };
  writeJudgementCache(cache);
}

function groupSkillsByPhase(skillEntries) {
  const grouped = completeSkillPhases();
  for (const skill of skillEntries) {
    const phase = skill.phase || "implementation";
    grouped[phase] ||= [];
    if (!grouped[phase].includes(skill.name)) grouped[phase].push(skill.name);
  }
  return grouped;
}

function completeSkillPhases(groups = {}) {
  const phases = ["planning", "research", "design", "implementation", "debugging", "testing", "review", "deployment", "matched", "selected"];
  const complete = {};
  for (const phase of phases) complete[phase] = Array.isArray(groups[phase]) ? groups[phase] : [];
  return complete;
}

function buildExecutionPlan(task, routeLike, taskProfile, selectedSkillsByPhase) {
  const stages = [];
  let mode = "single-agent";
  let requiresReview = ["high", "critical"].includes(taskProfile.risk)
    || (taskProfile.complexity === "high" && taskProfile.writeIntent === "expected")
    || routeLike.matchedIntents?.some((intent) => intent.id === "review" || intent.id === "security");
  const requiresTests = taskProfile.writeIntent === "expected" || routeLike.matchedIntents?.some((intent) => intent.id === "testing" || intent.id === "debug");
  const requiresUserClarification = routeLike.confidence === "low" || routeLike.needsParentChoice;
  const parallelizable = taskProfile.complexity === "high" && !requiresUserClarification;

  if (requiresUserClarification) {
    mode = "clarify-first";
    stages.push("Ask one concise clarification question before spawning subagents.");
  } else if (taskProfile.complexity === "high" || /执行计划|implement this plan|multi-agent|多代理/i.test(task)) {
    mode = "staged";
    stages.push("Explorer maps scope, ownership boundaries, and likely risks.");
    stages.push("Worker implements the scoped change with selected skills.");
    if (requiresTests) stages.push("Worker or test-focused agent runs validation and adds/updates tests.");
    if (requiresReview) stages.push("Reviewer performs read-only risk review before final summary.");
  } else if (requiresReview && taskProfile.writeIntent === "expected") {
    mode = "parallel-review";
    stages.push("Worker performs the scoped implementation.");
    stages.push("Independent reviewer checks correctness, security, regressions, and missing tests.");
  } else {
    stages.push(`${routeLike.recommended?.runtimeRole || "worker"} handles the scoped task directly.`);
    if (requiresTests) stages.push("Run the nearest focused validation after the change.");
  }

  return {
    mode,
    primaryRole: routeLike.recommended?.runtimeRole || "worker",
    stages,
    parallelizable,
    requiresReview,
    requiresTests,
    requiresUserClarification,
    selectedSkillsByPhase,
  };
}

function splitSkillsForRole(skillsByPhase, phases) {
  return unique(phases.flatMap((phase) => skillsByPhase?.[phase] || []));
}

function clarificationQuestionFor(task, routeLike) {
  const intents = routeLike.matchedIntents?.map((intent) => intent.id).join(", ") || "unknown";
  return `请补充这次子代理任务的目标范围、相关文件/模块或失败现象；当前只识别到 ${intents}，不足以安全派发。`;
}

function buildHandoffPlan(task, routeLike, taskProfile, executionPlan, skillsByPhase) {
  const agentName = routeLike.recommended?.name || "selected-agent";
  const modelPolicy = routeLike.modelPolicy || computeModelPolicy(task, routeLike.recommended, routeLike);
  const baseStage = (id, agent, role, sandbox, phases, objective, acceptance) => ({
    id,
    agent,
    role,
    sandboxMode: sandbox,
    selectedModel: modelPolicy.selectedModel,
    reasoningEffort: modelPolicy.reasoningEffort,
    skills: splitSkillsForRole(skillsByPhase, phases),
    input: task,
    expectedOutput: objective,
    acceptanceCriteria: acceptance,
  });
  if (executionPlan.requiresUserClarification) {
    return {
      mode: "clarify-first",
      clarificationQuestion: clarificationQuestionFor(task, routeLike),
      stages: [
        baseStage("clarify", "parent-codex", "explorer", "read-only", ["planning"], "Collect the missing task boundary before delegating.", ["One concise clarification answer is available."]),
      ],
    };
  }
  const stages = [];
  if (executionPlan.mode === "staged") {
    stages.push(baseStage("explore", "code-mapper", "explorer", "read-only", ["planning", "research", "design"], "Map scope, risks, ownership boundaries, and implementation order.", ["Affected subsystems and risky files are named.", "Worker scope is bounded."]));
    stages.push(baseStage("implement", agentName, "worker", routeLike.recommended?.sandboxMode || "workspace-write", ["implementation", "debugging"], "Implement the scoped change without touching unrelated files.", ["Changed files match the scoped boundary.", "No unrelated user changes are overwritten."]));
  } else {
    stages.push(baseStage("primary", agentName, routeLike.recommended?.runtimeRole || "worker", routeLike.recommended?.sandboxMode || "workspace-write", ["planning", "research", "implementation", "debugging", "review"], "Complete the selected subagent task.", ["Result matches the user request.", "Residual risk is reported."]));
  }
  if (executionPlan.requiresTests) {
    stages.push(baseStage("validate", "test-automator", "worker", "workspace-write", ["testing"], "Run or define the nearest focused validation.", ["Validation command or reason for not running is reported.", "New or updated tests cover changed behavior when practical."]));
  }
  if (executionPlan.requiresReview) {
    stages.push(baseStage("review", "reviewer", "explorer", "read-only", ["review"], "Review correctness, security, regressions, and missing tests.", ["Findings are evidence-based.", "High-risk residuals are called out."]));
  }
  return {
    mode: executionPlan.mode,
    clarificationQuestion: "",
    stages,
  };
}

function qualityGatesFor(route, judgePolicy) {
  const gates = [];
  const risk = route.taskProfile?.risk || "unknown";
  const importance = route.modelPolicy?.importanceLevel || "normal";
  if (["high", "critical"].includes(risk) || ["high", "critical"].includes(importance)) {
    gates.push({ id: "high-risk-model-gate", passed: judgePolicy.judgeModel === "gpt-5.5", reason: "High/critical risk requires GPT-5.5 judgement and execution policy." });
  }
  if (route.executionPlan?.requiresUserClarification) {
    gates.push({ id: "clarify-first-gate", passed: route.executionPlan.mode === "clarify-first", reason: "Low confidence or vague tasks must clarify before spawning." });
  }
  if (hasVolatileContext(route.task)) {
    gates.push({ id: "volatile-cache-gate", passed: judgePolicy.cacheEligible === false, reason: "Current diff/log/file-specific context must bypass cache." });
  }
  if (route.modelPolicy?.importanceLevel === "low") {
    gates.push({ id: "low-risk-cost-gate", passed: ["deterministic", "mini-judge", "standard-judge"].includes(judgePolicy.judgeMode), reason: "Low-risk work may use cheaper routing when confidence is high." });
  }
  return gates;
}

function rejectedCandidatesFor(route) {
  const selected = route.recommended?.name;
  return (route.candidates || [])
    .filter((candidate) => candidate.name !== selected)
    .slice(0, 5)
    .map((candidate) => ({
      name: candidate.name,
      score: candidate.score,
      reason: candidate.sandboxMode !== route.recommended?.sandboxMode
        ? `lower score and sandbox ${candidate.sandboxMode} differs from selected ${route.recommended?.sandboxMode}`
        : `lower score margin versus selected ${selected}`,
    }));
}

function skillRationaleFor(selectedSkills, skillCandidates, route) {
  const selectedSet = new Set(selectedSkills || route.suggestedSkills || []);
  const directByName = new Map((route.skillMatches || []).map((skill) => [skill.name, skill]));
  return (skillCandidates || route.skillMatches || [])
    .slice(0, 18)
    .map((skill) => ({
      name: skill.name,
      selected: selectedSet.has(skill.name),
      phase: skill.phase || directByName.get(skill.name)?.phase || "matched",
      source: skill.source || "strategy",
      priority: skill.priority || null,
      community: String(skill.name).startsWith("community-"),
      reason: skill.reason || directByName.get(skill.name)?.reason || "matched skill metadata",
    }));
}

function decisionTraceFor(task, route, judgePolicy, result = {}) {
  return [
    `normalizedTask=${cleanTask(task)}`,
    `matchedIntents=${route.matchedIntents?.map((intent) => intent.id).join(",") || "none"}`,
    `selectedAgent=${result.finalAgent || route.recommended?.name}`,
    `confidence=${result.confidence || route.confidence}`,
    `routeMargin=${judgePolicy.routeMargin}`,
    `judgeMode=${judgePolicy.judgeMode}`,
    `judgeModel=${judgePolicy.judgeModel}`,
    `cacheEligible=${judgePolicy.cacheEligible}`,
  ];
}

function fallbackSafetyFor(route, errorMessage, judgePolicy) {
  const highRisk = ["high", "critical"].includes(route.taskProfile?.risk) || ["high", "critical"].includes(route.modelPolicy?.importanceLevel);
  const isIntentionalDeterministic = !errorMessage && judgePolicy?.judgeMode === "deterministic";
  if (isIntentionalDeterministic) return { fallbackReason: "", fallbackSafety: "safe-deterministic", requiresParentReview: false };
  const failureClass = classifyFailure(errorMessage);
  if (highRisk) return { fallbackReason: errorMessage || "high-risk fallback", failureClass, fallbackSafety: "conservative", requiresParentReview: true };
  if (route.confidence === "low" || route.needsParentChoice) return { fallbackReason: errorMessage || "low-confidence fallback", failureClass, fallbackSafety: "needs-parent-choice", requiresParentReview: true };
  return { fallbackReason: errorMessage || "deterministic fallback", failureClass, fallbackSafety: "acceptable", requiresParentReview: false };
}

function attachRoutingMetadata(result, route, skillCandidates = [], judgePolicy = {}, fallbackMeta = {}) {
  const skillsByPhase = completeSkillPhases(result.selectedSkillsByPhase || route.selectedSkillsByPhase || {});
  const executionPlan = {
    ...(result.executionPlan || route.executionPlan),
    selectedSkillsByPhase: skillsByPhase,
  };
  const handoffPlan = buildHandoffPlan(result.task || route.task, {
    ...route,
    recommended: route.candidates?.find((candidate) => candidate.name === result.finalAgent) || route.recommended,
    modelPolicy: {
      importanceLevel: result.importanceLevel,
      selectedModel: result.selectedModel,
      reasoningEffort: result.reasoningEffort,
      modelRationale: result.modelRationale,
    },
  }, result.taskProfile || route.taskProfile, executionPlan, skillsByPhase);
  const enrichedExecutionPlan = {
    ...executionPlan,
    stageDetails: handoffPlan.stages,
    clarificationQuestion: handoffPlan.clarificationQuestion,
  };
  return {
    ...result,
    executionPlan: enrichedExecutionPlan,
    handoffPlan,
    decisionTrace: decisionTraceFor(result.task || route.task, route, judgePolicy, result),
    qualityGates: qualityGatesFor(route, judgePolicy),
    rejectedCandidates: rejectedCandidatesFor(route),
    skillRationale: skillRationaleFor(result.selectedSkills, skillCandidates, route),
    fallbackReason: fallbackMeta.fallbackReason || "",
    failureClass: fallbackMeta.failureClass || classifyFailure(fallbackMeta.fallbackReason || ""),
    fallbackSafety: fallbackMeta.fallbackSafety || "not-fallback",
    requiresParentReview: Boolean(fallbackMeta.requiresParentReview),
    routingWarnings: unique([
      ...((result.routingWarnings || [])),
      ...missingConfiguredSkillsForTask(result.task || route.task).map((skill) => `configured skill unavailable and skipped: ${skill}`),
    ]),
  };
}

function skillMatches(task) {
  const strategy = loadStrategyConfig();
  const skillNames = availableSkillNameSet();
  return strategy.skillRules.flatMap((rule) => {
    const matched = rule.patterns.some((pattern) => pattern.test(task));
    if (!matched) return [];
    return rule.skills.map((name) => ({
      name,
      ruleId: rule.id || "unnamed",
      phase: rule.phase || "implementation",
      priority: rule.priority || 50,
      reason: rule.reason,
      confidence: rule.confidence,
    }));
  })
    .filter((entry) => skillNameAvailable(entry.name, skillNames))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
    .filter((entry, index, entries) => entries.findIndex((item) => item.name === entry.name) === index);
}

function missingConfiguredSkillsForTask(task) {
  const strategy = loadStrategyConfig();
  const skillNames = availableSkillNameSet();
  return unique(strategy.skillRules.flatMap((rule) => {
    const matched = rule.patterns.some((pattern) => pattern.test(task));
    if (!matched) return [];
    return (rule.skills || []).filter((name) => !skillNameAvailable(name, skillNames));
  }));
}

function skillCandidateScore(skill, task) {
  const words = tokenize(task);
  let score = fieldMatchScore(skill.name, words, 12);
  score += fieldMatchScore(skill.description, words, 5);
  return score;
}

function buildSkillCandidates(task, limit = 18) {
  const community = loadCommunitySkillManifest();
  const direct = skillMatches(task).map((entry) => ({
    name: entry.name,
    description: entry.reason,
    phase: entry.phase,
    ruleId: entry.ruleId,
    reason: entry.reason,
    confidence: entry.confidence,
    source: community.byName.get(entry.name)?.source || "strategy",
    flags: community.byName.get(entry.name)?.flags || [],
    score: (entry.confidence === "high" ? 120 : 80) + (entry.priority || 0),
  }));
  const directNames = new Set(direct.map((entry) => entry.name));
  const scanned = loadSkillRegistry()
    .map((skill) => {
      const communitySkill = community.byName.get(skill.name);
      const sourceBoost = communitySkill
        ? communitySkill.source === "openai" ? 28 : communitySkill.source === "spellbook" ? 24 : 18
        : 0;
      return {
        ...skill,
        source: communitySkill?.source || "local",
        flags: communitySkill?.flags || [],
        score: skillCandidateScore(skill, task) + sourceBoost,
        confidence: communitySkill ? "high" : "medium",
        reason: communitySkill ? `matched community skill metadata from ${communitySkill.source}` : "matched local skill metadata",
      };
    })
    .filter((skill) => skill.score > 8 && !directNames.has(skill.name))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, limit - direct.length))
    .map(({ name, description, score, confidence, reason, source, flags }) => ({ name, description, phase: "matched", score, confidence, reason, source, flags }));
  return [...direct, ...scanned].slice(0, limit);
}

function routeTask(task, options = {}) {
  const candidateLimit = options.candidateLimit || 3;
  const registry = loadRegistry();
  const intents = classifyIntents(task);
  const ranked = registry.agents
    .map((agent) => scoreAgent(agent, task, intents))
    .sort((a, b) => b.score - a.score || a.agent.name.localeCompare(b.agent.name))
    .slice(0, Math.max(5, candidateLimit));

  let best = ranked[0]?.agent || registry.agents.find((agent) => agent.name === "code-mapper") || registry.agents[0];
  const vagueTask = isVagueTask(task, ranked);
  let confidence = confidenceFor(ranked, intents);
  if (vagueTask) confidence = "low";
  const needsParentChoice = confidence === "low";
  const codebaseImplied = /code|repo|project|file|diff|代码|仓库|项目|文件/.test(cleanTask(task));
  if (confidence === "low" && codebaseImplied) {
    best = registry.agents.find((agent) => agent.name === "code-mapper") || best;
  }
  let skillEntries = skillMatches(task);
  if (vagueTask) {
    skillEntries = skillEntries.filter((entry) => !/debugging|failure|regression/i.test(entry.reason));
  }
  const skills = skillEntries.map((entry) => entry.name);
  const bestScore = ranked.find((entry) => entry.agent.name === best.name) || scoreAgent(best, task, intents);
  const selectedSkillsByPhase = groupSkillsByPhase(skillEntries);
  const strategy = loadStrategyConfig();
  const baseRoute = {
    task,
    confidence,
    needsParentChoice,
    matchedIntents: intents.map(({ id, label, score, preferredSandbox }) => ({ id, label, score, preferredSandbox })),
    recommended: summarizeAgent(best),
    scoreBreakdown: bestScore.breakdown,
    reasons: bestScore.reasons,
    candidates: ranked.slice(0, candidateLimit).map(({ agent, score, breakdown, reasons }) => ({ ...summarizeAgent(agent), score, breakdown, reasons })),
    skillMatches: skillEntries,
    selectedSkillsByPhase,
    suggestedSkills: skills,
  };
  const taskProfile = computeTaskProfile(task, baseRoute);
  const modelPolicy = computeModelPolicy(task, best, baseRoute);
  const executionPlan = buildExecutionPlan(task, baseRoute, taskProfile, selectedSkillsByPhase);
  return {
    ...baseRoute,
    strategyConfig: {
      source: strategy.source,
      loaded: strategy.configLoaded,
      version: strategy.version,
    },
    taskProfile,
    modelPolicy,
    executionPlan,
    delegationPrompt: buildPrompt(best, task, skills, { confidence, needsParentChoice, intents, modelPolicy }),
  };
}

function summarizeAgent(agent) {
  return {
    name: agent.name,
    description: agent.description,
    category: agent.category,
    sandboxMode: agent.sandboxMode,
    runtimeRole: agent.runtimeRole,
    model: agent.model,
    compatibleModel: agent.compatibleModel,
    sourcePath: agent.sourcePath,
  };
}

function findAgentByName(name) {
  return loadRegistry().agents.find((agent) => agent.name === name);
}

function buildPrompt(agent, task, skills = [], routing = {}) {
  return `You are acting as the VoltAgent Codex subagent "${agent.name}".

Description:
${agent.description}

Runtime:
- Use Codex runtime role: ${agent.runtimeRole}
- Requested sandbox mode: ${agent.sandboxMode}
- Preferred model from agent file: ${agent.model || "inherit parent"}
- Compatible local model fallback: ${agent.compatibleModel}
- Selected runtime model: ${routing.modelPolicy?.selectedModel || agent.compatibleModel || "inherit parent"}
- Selected reasoning effort: ${routing.modelPolicy?.reasoningEffort || "medium"}
- Importance level: ${routing.modelPolicy?.importanceLevel || "normal"}

Agent instructions:
${agent.instructions || "(No additional instructions found.)"}

Suggested Codex skills for the parent agent to load when applicable:
${skills.length ? skills.map((skill) => `- ${skill}`).join("\n") : "- None matched automatically"}

Routing confidence:
- confidence: ${routing.confidence || "unknown"}
- needs parent choice: ${routing.needsParentChoice ? "yes" : "no"}
- matched intents: ${routing.intents?.length ? routing.intents.map((intent) => intent.id).join(", ") : "none"}
- model rationale: ${routing.modelPolicy?.modelRationale?.length ? routing.modelPolicy.modelRationale.join("; ") : "none"}

Task:
${task}

Return:
- chosen scope
- files or areas inspected/changed
- result summary
- validation performed
- residual risk and follow-up needed`;
}

function buildJudgementPrompt(task, deterministic, agentCandidates, skillCandidates, judgePolicy = {}) {
  const packet = {
    task,
    judgePolicy: {
      budget: judgePolicy.budget,
      judgeMode: judgePolicy.judgeMode,
      judgeModel: judgePolicy.judgeModel,
      candidateBudget: judgePolicy.candidateBudget,
      costRationale: judgePolicy.costRationale,
    },
    deterministic: {
      recommended: deterministic.recommended,
      confidence: deterministic.confidence,
      needsParentChoice: deterministic.needsParentChoice,
      matchedIntents: deterministic.matchedIntents,
      scoreBreakdown: deterministic.scoreBreakdown,
      reasons: deterministic.reasons,
      modelPolicy: deterministic.modelPolicy,
      taskProfile: deterministic.taskProfile,
      executionPlan: deterministic.executionPlan,
      selectedSkillsByPhase: deterministic.selectedSkillsByPhase,
    },
    agentCandidates: agentCandidates.map((candidate) => ({
      name: candidate.name,
      description: clampText(candidate.description, 160),
      category: candidate.category,
      runtimeRole: candidate.runtimeRole,
      sandboxMode: candidate.sandboxMode,
      compatibleModel: candidate.compatibleModel,
      score: candidate.score,
      reasons: candidate.reasons,
      scoreBreakdown: candidate.breakdown,
    })),
    skillCandidates: skillCandidates.map((skill) => ({
      name: skill.name,
      description: clampText(skill.description, 140),
      reason: clampText(skill.reason, 140),
      phase: skill.phase,
      confidence: skill.confidence,
      score: skill.score,
      source: skill.source,
    })),
  };

  return `You are Codex acting only as a routing judge.

Choose the best VoltAgent subagent identity and Codex skills for the task.
Also choose the runtime model and reasoning effort for the subagent that will execute the task.
Confirm or refine the execution plan for how the parent Codex agent should delegate.

Hard rules:
- Do not solve, execute, inspect files, spawn agents, or modify anything.
- Choose finalAgent only from agentCandidates.
- Choose selectedSkills only from skillCandidates.
- Group selected skills by phase in selectedSkillsByPhase.
- Prefer narrow specialists over generic agents when the task is specific.
- Prefer explorer/read-only for review, audit, research, and analysis.
- Prefer worker/workspace-write for implementation, fixes, tests, and code edits.
- If the task is vague or lacks enough context, use confidence "low" and needsParentChoice true.
- Important work must use selectedModel "gpt-5.5": security, auth, privacy, compliance, architecture, production, incident, migration, cross-system changes, high-risk review, ambiguous tasks, and multi-agent coordination.
- Routine scoped implementation may use "gpt-5.4".
- Simple low-risk docs, formatting, or narrow chores may use "gpt-5.4-mini".
- Do not downgrade deterministic.modelPolicy when it marks importanceLevel "critical".
- Preserve clarify-first mode when deterministic.executionPlan.requiresUserClarification is true.
- Choose reasoningEffort "high" or "xhigh" for critical or deeply ambiguous tasks; "medium" for normal implementation; "low" only for simple low-risk tasks.
- Keep rationale short and operational.
- Respect judgePolicy: it controls judge cost only, never lower the execution model below task risk.
- Return judgeMode, judgeModel, costRationale, and candidateBudget exactly from judgePolicy.

Return JSON that matches the provided schema.

Routing packet:
${JSON.stringify(packet, null, 2)}`;
}

function fallbackJudgement(task, route, skillCandidates, errorMessage = "", meta = {}) {
  const selectedSkills = route.suggestedSkills;
  const fullAgent = findAgentByName(route.recommended.name) || route.recommended;
  const modelPolicy = route.modelPolicy || computeModelPolicy(task, route.recommended, route);
  const safety = fallbackSafetyFor(route, meta.modelError ?? errorMessage, meta);
  return attachRoutingMetadata({
    task,
    modelUsed: false,
    model: null,
    modelError: meta.modelError ?? errorMessage,
    judgeMode: meta.judgeMode || "deterministic",
    judgeModel: meta.judgeModel || "none",
    costRationale: meta.costRationale || ["deterministic fallback route"],
    candidateBudget: meta.candidateBudget || { agents: route.candidates?.length || 0, skills: skillCandidates.length },
    cache: meta.cache || { hit: false, eligible: false },
    finalAgent: route.recommended.name,
    runtimeRole: route.recommended.runtimeRole,
    sandboxMode: route.recommended.sandboxMode,
    selectedSkills,
    selectedSkillsByPhase: completeSkillPhases(route.selectedSkillsByPhase || groupSkillsByPhase(route.skillMatches || [])),
    importanceLevel: modelPolicy.importanceLevel,
    selectedModel: modelPolicy.selectedModel,
    reasoningEffort: modelPolicy.reasoningEffort,
    modelRationale: modelPolicy.modelRationale,
    taskProfile: route.taskProfile || computeTaskProfile(task, route),
    executionPlan: route.executionPlan || buildExecutionPlan(task, route, route.taskProfile || computeTaskProfile(task, route), route.selectedSkillsByPhase || {}),
    confidence: route.confidence,
    needsParentChoice: route.needsParentChoice,
    rationale: route.reasons.length ? route.reasons : ["deterministic fallback route"],
    riskNotes: route.needsParentChoice ? ["low confidence route; parent agent should choose from candidates"] : [],
    deterministic: route,
    delegationPrompt: buildPrompt(fullAgent, task, selectedSkills, {
      confidence: route.confidence,
      needsParentChoice: route.needsParentChoice,
      intents: route.matchedIntents,
      modelPolicy,
    }),
  }, route, skillCandidates, meta, safety);
}

function validateJudgement(judgement, route, skillCandidates) {
  const candidateNames = new Set(route.candidates.map((candidate) => candidate.name));
  const skillNames = new Set(skillCandidates.map((skill) => skill.name));
  if (!candidateNames.has(judgement.finalAgent)) {
    throw new Error(`model selected non-candidate agent: ${judgement.finalAgent}`);
  }
  for (const skill of judgement.selectedSkills || []) {
    if (!skillNames.has(skill)) throw new Error(`model selected non-candidate skill: ${skill}`);
  }
  const agent = route.candidates.find((candidate) => candidate.name === judgement.finalAgent);
  if (agent.runtimeRole !== judgement.runtimeRole) judgement.runtimeRole = agent.runtimeRole;
  if (agent.sandboxMode !== judgement.sandboxMode) judgement.sandboxMode = agent.sandboxMode;
  const fallbackPolicy = route.modelPolicy || computeModelPolicy(route.task, agent, route);
  if (!MODEL_ORDER.has(judgement.selectedModel)) throw new Error(`invalid selectedModel: ${judgement.selectedModel}`);
  if (!EFFORT_ORDER.has(judgement.reasoningEffort)) throw new Error(`invalid reasoningEffort: ${judgement.reasoningEffort}`);
  if (fallbackPolicy.importanceLevel === "critical" && MODEL_ORDER.get(judgement.selectedModel) < MODEL_ORDER.get(fallbackPolicy.selectedModel)) {
    judgement.selectedModel = fallbackPolicy.selectedModel;
    judgement.modelRationale = unique([...(judgement.modelRationale || []), "critical deterministic policy prevents model downgrade"]);
  }
  if (fallbackPolicy.importanceLevel === "critical" && EFFORT_ORDER.get(judgement.reasoningEffort) < EFFORT_ORDER.get("high")) {
    judgement.reasoningEffort = "high";
    judgement.modelRationale = unique([...(judgement.modelRationale || []), "critical deterministic policy requires high reasoning"]);
  }
  if (fallbackPolicy.importanceLevel === "critical" && judgement.importanceLevel !== "critical") {
    judgement.importanceLevel = "critical";
    judgement.modelRationale = unique([...(judgement.modelRationale || []), "critical deterministic policy preserved"]);
  }
  if (route.executionPlan?.requiresUserClarification && !judgement.executionPlan?.requiresUserClarification) {
    judgement.executionPlan = {
      ...route.executionPlan,
      requiresUserClarification: true,
      mode: "clarify-first",
    };
  }
  const selectedSet = new Set(judgement.selectedSkills || []);
  const phaseGroups = {};
  for (const skill of skillCandidates) {
    if (selectedSet.has(skill.name)) {
      const phase = skill.phase || "selected";
      phaseGroups[phase] ||= [];
      phaseGroups[phase].push(skill.name);
    }
  }
  const modelGroups = completeSkillPhases(judgement.selectedSkillsByPhase || {});
  for (const [phase, skills] of Object.entries(phaseGroups)) {
    modelGroups[phase] = unique([...(modelGroups[phase] || []), ...skills]);
  }
  judgement.selectedSkillsByPhase = completeSkillPhases(modelGroups);
  return { judgement, agent };
}

function runModelJudgement(task, options = {}) {
  const initialRoute = routeTask(task, { candidateLimit: options.candidateLimit || 8 });
  const judgePolicy = computeJudgePolicy(task, initialRoute, options);
  const route = initialRoute.candidates.length === judgePolicy.candidateBudget.agents
    ? initialRoute
    : routeTask(task, { candidateLimit: options.candidateLimit || judgePolicy.candidateBudget.agents });
  const skillCandidates = buildSkillCandidates(task, options.skillLimit || judgePolicy.candidateBudget.skills);
  const cacheMeta = {
    hit: false,
    eligible: judgePolicy.cacheEligible,
    bypassReason: judgePolicy.cacheBypassReason || undefined,
  };
  const cacheKey = judgePolicy.cacheEligible ? cacheKeyFor(task, judgePolicy, route, skillCandidates) : "";

  if (!options.noCache && cacheKey) {
    const cached = getCachedJudgement(cacheKey);
    if (cached) return cached;
  }

  if (options.offline) {
    const result = fallbackJudgement(task, route, skillCandidates, "offline mode", {
      ...judgePolicy,
      judgeMode: "deterministic",
      judgeModel: "none",
      cache: cacheMeta,
    });
    if (!options.noCache && cacheKey) putCachedJudgement(cacheKey, result);
    return result;
  }

  if (judgePolicy.judgeMode === "deterministic") {
    const result = fallbackJudgement(task, route, skillCandidates, "", {
      ...judgePolicy,
      modelError: "",
      cache: cacheMeta,
    });
    if (!options.noCache && cacheKey) putCachedJudgement(cacheKey, result);
    return result;
  }

  const prompt = buildJudgementPrompt(task, route, route.candidates, skillCandidates, judgePolicy);
  const outputPath = path.join(CODEX_HOME, "subagents", `.judgement-${process.pid}-${Date.now()}.json`);
  try {
    execFileSync(CODEX_CLI, [
      "exec",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "-m",
      judgePolicy.judgeModel,
      "--output-schema",
      JUDGEMENT_SCHEMA_PATH,
      "--output-last-message",
      outputPath,
      prompt,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: options.timeoutMs || 180000,
      maxBuffer: 1024 * 1024 * 4,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const jsonText = readText(outputPath).trim();
    const rawJudgement = JSON.parse(jsonText);
    const { judgement, agent } = validateJudgement(rawJudgement, route, skillCandidates);
    const fullAgent = findAgentByName(agent.name) || agent;
    const result = attachRoutingMetadata({
      task,
      modelUsed: true,
      model: judgePolicy.judgeModel,
      judgeMode: judgePolicy.judgeMode,
      judgeModel: judgePolicy.judgeModel,
      costRationale: judgePolicy.costRationale,
      candidateBudget: judgePolicy.candidateBudget,
      cache: cacheMeta,
      finalAgent: judgement.finalAgent,
      runtimeRole: judgement.runtimeRole,
      sandboxMode: judgement.sandboxMode,
      selectedSkills: judgement.selectedSkills,
      selectedSkillsByPhase: judgement.selectedSkillsByPhase,
      importanceLevel: judgement.importanceLevel,
      selectedModel: judgement.selectedModel,
      reasoningEffort: judgement.reasoningEffort,
      modelRationale: judgement.modelRationale,
      taskProfile: judgement.taskProfile,
      executionPlan: judgement.executionPlan,
      confidence: judgement.confidence,
      needsParentChoice: judgement.needsParentChoice,
      rationale: judgement.rationale,
      riskNotes: judgement.riskNotes,
      deterministic: route,
      skillCandidates,
      delegationPrompt: buildPrompt(fullAgent, task, judgement.selectedSkills, {
        confidence: judgement.confidence,
        needsParentChoice: judgement.needsParentChoice,
        intents: route.matchedIntents,
        modelPolicy: {
          importanceLevel: judgement.importanceLevel,
          selectedModel: judgement.selectedModel,
          reasoningEffort: judgement.reasoningEffort,
          modelRationale: judgement.modelRationale,
        },
      }),
    }, route, skillCandidates, judgePolicy);
    if (!options.noCache && cacheKey) putCachedJudgement(cacheKey, result);
    return result;
  } catch (error) {
    return fallbackJudgement(task, route, skillCandidates, error.message, {
      ...judgePolicy,
      cache: cacheMeta,
    });
  } finally {
    try {
      fs.rmSync(outputPath, { force: true });
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function printRoute(route, mode) {
  const json = mode === "json";
  const brief = mode === "brief";
  if (json) {
    console.log(JSON.stringify(route, null, 2));
    return;
  }
  console.log(`Recommended agent: ${route.recommended.name}`);
  console.log(`Confidence: ${route.confidence}${route.needsParentChoice ? " (parent choice recommended)" : ""}`);
  console.log(`Role: ${route.recommended.runtimeRole}`);
  console.log(`Sandbox: ${route.recommended.sandboxMode}`);
  console.log(`Model: ${route.modelPolicy?.selectedModel || route.recommended.compatibleModel}`);
  console.log(`Reasoning: ${route.modelPolicy?.reasoningEffort || "medium"}`);
  console.log(`Importance: ${route.modelPolicy?.importanceLevel || "normal"}`);
  console.log(`Execution: ${route.executionPlan?.mode || "single-agent"}`);
  if (brief) return;
  console.log("");
  console.log("Matched intents:");
  if (route.matchedIntents.length) {
    for (const intent of route.matchedIntents) console.log(`- ${intent.id}: ${intent.label} (${intent.score})`);
  } else {
    console.log("- none");
  }
  console.log("");
  console.log("Score breakdown:");
  for (const [key, value] of Object.entries(route.scoreBreakdown)) {
    console.log(`- ${key}: ${value}`);
  }
  console.log("");
  console.log("Reasons:");
  if (route.reasons.length) {
    for (const reason of route.reasons) console.log(`- ${reason}`);
  } else {
    console.log("- weak keyword-only or fallback match");
  }
  console.log("");
  console.log("Suggested skills:");
  if (route.skillMatches.length) {
    for (const skill of route.skillMatches) console.log(`- ${skill.name}: ${skill.reason} (${skill.confidence})`);
  } else {
    console.log("- none");
  }
  console.log("");
  console.log("Task profile:");
  for (const [key, value] of Object.entries(route.taskProfile || {})) {
    console.log(`- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
  }
  console.log("");
  console.log("Execution plan:");
  console.log(`- mode: ${route.executionPlan.mode}`);
  for (const stage of route.executionPlan.stages) console.log(`- ${stage}`);
  console.log("");
  console.log("Top candidates:");
  for (const candidate of route.candidates) {
    console.log(`- ${candidate.name} (${candidate.score})`);
  }
  console.log("");
  console.log("Delegation prompt:");
  console.log(route.delegationPrompt);
}

function printJudgement(result, mode) {
  if (mode === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (mode === "explain") {
    console.log(`Final agent: ${result.finalAgent}`);
    console.log(`Route: ${result.judgeMode} via ${result.judgeModel}`);
    console.log(`Runtime: ${result.runtimeRole} / ${result.sandboxMode} / ${result.selectedModel} / ${result.reasoningEffort}`);
    console.log(`Confidence: ${result.confidence}; cache: ${result.cache?.hit ? "hit" : result.cache?.eligible ? "miss" : "bypassed"}`);
    console.log("");
    console.log("Decision trace:");
    for (const item of result.decisionTrace || []) console.log(`- ${item}`);
    console.log("");
    console.log("Quality gates:");
    for (const gate of result.qualityGates || []) console.log(`- ${gate.id}: ${gate.passed ? "pass" : "fail"} - ${gate.reason}`);
    console.log("");
    console.log("Selected skills:");
    for (const skill of result.skillRationale?.filter((entry) => entry.selected) || []) console.log(`- ${skill.name}: ${skill.reason}`);
    console.log("");
    console.log("Rejected candidates:");
    for (const candidate of result.rejectedCandidates || []) console.log(`- ${candidate.name} (${candidate.score}): ${candidate.reason}`);
    console.log("");
    console.log("Handoff stages:");
    for (const stage of result.handoffPlan?.stages || []) console.log(`- ${stage.id}: ${stage.agent} as ${stage.role}, skills=${stage.skills.join(", ") || "none"}`);
    if (result.fallbackSafety !== "not-fallback") {
      console.log("");
      console.log(`Fallback: ${result.fallbackSafety}${result.requiresParentReview ? " (parent review required)" : ""}`);
      if (result.fallbackReason) console.log(`Reason: ${result.fallbackReason}`);
    }
    return;
  }
  console.log(`Final agent: ${result.finalAgent}`);
  console.log(`Model used: ${result.modelUsed ? result.model : "no"}`);
  console.log(`Judge mode: ${result.judgeMode || "unknown"}`);
  console.log(`Judge model: ${result.judgeModel || "unknown"}`);
  console.log(`Cache: ${result.cache?.hit ? "hit" : result.cache?.eligible ? "miss" : "bypassed"}`);
  console.log(`Confidence: ${result.confidence}${result.needsParentChoice ? " (parent choice recommended)" : ""}`);
  console.log(`Role: ${result.runtimeRole}`);
  console.log(`Sandbox: ${result.sandboxMode}`);
  console.log(`Subagent model: ${result.selectedModel}`);
  console.log(`Reasoning effort: ${result.reasoningEffort}`);
  console.log(`Importance: ${result.importanceLevel}`);
  console.log(`Execution mode: ${result.executionPlan?.mode || "single-agent"}`);
  console.log("");
  console.log("Selected skills:");
  if (result.selectedSkills.length) {
    for (const skill of result.selectedSkills) console.log(`- ${skill}`);
  } else {
    console.log("- none");
  }
  console.log("");
  console.log("Rationale:");
  for (const reason of result.rationale) console.log(`- ${reason}`);
  console.log("");
  console.log("Model rationale:");
  for (const reason of result.modelRationale) console.log(`- ${reason}`);
  if (result.costRationale?.length) {
    console.log("");
    console.log("Cost rationale:");
    for (const reason of result.costRationale) console.log(`- ${reason}`);
  }
  if (result.riskNotes.length) {
    console.log("");
    console.log("Risk notes:");
    for (const note of result.riskNotes) console.log(`- ${note}`);
  }
}

function cacheStats() {
  const cache = readJudgementCache();
  const entries = Object.values(cache.entries || {});
  return {
    path: JUDGEMENT_CACHE_PATH,
    entries: entries.length,
    newest: entries.map((entry) => entry.createdAt).filter(Boolean).sort().at(-1) || null,
  };
}

function runDoctor(mode = "text") {
  const registry = loadRegistry();
  const skills = loadSkillRegistry();
  const community = loadCommunitySkillManifest();
  const config = loadStrategyConfig();
  const configValidation = validateStrategyConfig(config);
  const skillNames = new Set(skills.flatMap((skill) => [skill.name, skill.name.split(":").at(-1)]));
  const missingSkillNames = unique(config.skillRules.flatMap((rule) => rule.skills || []))
    .filter((name) => !skillNames.has(name) && !skillNames.has(name.split(":").at(-1)));
  const checks = [
    { id: "agents-registry", ok: Boolean(registry.count || registry.agents?.length), detail: `${registry.count || registry.agents?.length || 0} agents` },
    { id: "skills-registry", ok: skills.length > 0, detail: `${skills.length} skills` },
    { id: "community-skills", ok: community.loaded && community.count > 0, detail: `${community.count} community skills` },
    { id: "strategy-config", ok: configValidation.ok, detail: configValidation.errors.join("; ") || "valid" },
    { id: "judgement-schema", ok: fs.existsSync(JUDGEMENT_SCHEMA_PATH), detail: JUDGEMENT_SCHEMA_PATH },
    { id: "codex-cli", ok: fs.existsSync(CODEX_CLI), detail: CODEX_CLI },
    { id: "configured-skills-exist", ok: missingSkillNames.length === 0, detail: missingSkillNames.length ? `missing: ${missingSkillNames.slice(0, 12).join(", ")}` : "all configured skills found" },
    { id: "cache-readable", ok: Boolean(readJudgementCache()), detail: `${cacheStats().entries} entries` },
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    ok: checks.every((check) => check.ok),
    checks,
    warnings: configValidation.warnings,
  };
  if (mode === "json") console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`DOCTOR ${report.ok ? "PASS" : "FAIL"}`);
    for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`);
    for (const warning of report.warnings) console.log(`WARN ${warning}`);
  }
  if (!report.ok) throw new Error("doctor failed");
}

function runReport(mode = "text") {
  const registry = loadRegistry();
  const skills = loadSkillRegistry();
  const community = loadCommunitySkillManifest();
  const config = loadStrategyConfig();
  let lastEval = null;
  try {
    const evalReport = JSON.parse(readText(EVAL_RESULTS_PATH));
    lastEval = {
      generatedAt: evalReport.generatedAt,
      total: evalReport.total,
      passed: evalReport.passed,
      failed: evalReport.failed,
      passRate: evalReport.passRate,
    };
  } catch {
    lastEval = null;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    agents: registry.count || registry.agents?.length || 0,
    skills: skills.length,
    communitySkills: community.count,
    strategyVersion: config.version,
    strategySource: config.source,
    cache: cacheStats(),
    lastEval,
  };
  if (mode === "json") console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Agents: ${report.agents}`);
    console.log(`Skills: ${report.skills} (${report.communitySkills} community)`);
    console.log(`Strategy: v${report.strategyVersion} from ${report.strategySource}`);
    console.log(`Cache: ${report.cache.entries} entries`);
    console.log(`Last eval: ${lastEval ? `${lastEval.passed}/${lastEval.total} (${lastEval.passRate}%)` : "not run"}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const EVAL_CASES = [
  { id: "frontend-bug-react", task: "开启子代理，修复 React 前端按钮点击 bug", expected: { intentIncludes: ["frontend", "debug"], role: "worker", skillsInclude: ["community-spellbook-react"], requiresTests: true } },
  { id: "frontend-layout-tailwind", task: "开启子代理，优化 Tailwind 页面布局和响应式样式", expected: { intentIncludes: ["frontend"], role: "worker", skillsInclude: ["community-spellbook-tailwind"] } },
  { id: "frontend-suspense", task: "开启子代理，构建 React Suspense 前端组件", expected: { intentIncludes: ["frontend"], skillsInclude: ["community-spellbook-react"] } },
  { id: "frontend-browser-debug", task: "开启子代理，排查浏览器页面交互失败", expected: { intentIncludes: ["frontend", "debug"], role: "worker" } },
  { id: "frontend-accessibility", task: "开启子代理，审查前端组件可访问性问题", expected: { intentIncludes: ["frontend", "review"], judgeModel: "gpt-5.5", requiresReview: true } },
  { id: "backend-api-auth", task: "开启子代理，修复 API 鉴权问题", expected: { intentIncludes: ["backend"], role: "worker", judgeModel: "gpt-5.5", selectedModel: "gpt-5.5", skillsInclude: ["agyb-full-stack-developer:api-patterns"] } },
  { id: "backend-fastapi", task: "开启子代理，设计 FastAPI 服务端接口", expected: { intentIncludes: ["backend"], skillsInclude: ["community-spellbook-fastapi"] } },
  { id: "backend-node-api", task: "开启子代理，重构 Node TypeScript 后端 API", expected: { intentIncludes: ["backend"], skillsInclude: ["community-spellbook-typescript"] } },
  { id: "backend-rate-limit", task: "开启子代理，实现接口限流和错误响应规范", expected: { intentIncludes: ["backend"], role: "worker" } },
  { id: "backend-queue", task: "开启子代理，修复 Redis queue 后端任务失败", expected: { intentIncludes: ["backend", "debug"], skillsInclude: ["community-spellbook-redis"], requiresTests: true } },
  { id: "security-secret", task: "开启子代理，审查 secret 泄露和权限风险", expected: { intentIncludes: ["security", "review"], role: "explorer", sandbox: "read-only", judgeModel: "gpt-5.5", selectedModel: "gpt-5.5", requiresReview: true } },
  { id: "security-xss", task: "开启子代理，检查 XSS 漏洞和输入校验", expected: { intentIncludes: ["security"], judgeModel: "gpt-5.5", skillsInclude: ["security-best-practices"] } },
  { id: "security-prod-auth", task: "开启子代理，审查当前 diff 里的生产鉴权漏洞", expected: { intentIncludes: ["review", "security"], judgeModel: "gpt-5.5", cacheEligible: false, selectedModel: "gpt-5.5" } },
  { id: "security-privacy", task: "开启子代理，评估用户隐私和合规风险", expected: { intentIncludes: ["security"], role: "explorer", judgeModel: "gpt-5.5" } },
  { id: "security-threat-model", task: "开启子代理，给支付流程做 threat model", expected: { intentIncludes: ["security"], judgeModel: "gpt-5.5", skillsInclude: ["security-threat-model"] } },
  { id: "review-current-diff", task: "开启子代理，审查当前 diff", expected: { agentIn: ["reviewer"], role: "explorer", sandbox: "read-only", judgeModel: "gpt-5.5", cacheEligible: false, requiresReview: true } },
  { id: "review-pr", task: "开启子代理，review 这个 pull request", expected: { intentIncludes: ["review"], judgeModel: "gpt-5.5", requiresReview: true } },
  { id: "review-regression", task: "开启子代理，审查回归风险和缺失测试", expected: { intentIncludes: ["review", "testing"], judgeModel: "gpt-5.5" } },
  { id: "debug-crash", task: "开启子代理，定位 crash 异常和 stack trace", expected: { intentIncludes: ["debug"], cacheEligible: false, requiresTests: true } },
  { id: "debug-flaky", task: "开启子代理，排查 flaky test 失败", expected: { intentIncludes: ["debug", "testing"], requiresTests: true } },
  { id: "debug-error-log", task: "开启子代理，根据日志修复后端报错", expected: { intentIncludes: ["debug", "backend"], cacheEligible: false } },
  { id: "testing-pytest", task: "开启子代理，补齐 pytest 覆盖率", options: { budget: "economy", forceModel: true }, expected: { agentIn: ["test-automator"], judgeMode: "mini-judge", judgeModel: "gpt-5.4-mini", skillsInclude: ["superpowers:test-driven-development"], requiresTests: true } },
  { id: "testing-playwright", task: "开启子代理，添加 Playwright 前端测试", expected: { intentIncludes: ["testing", "frontend"], skillsInclude: ["build-web-apps:frontend-testing-debugging"], requiresTests: true } },
  { id: "testing-jest", task: "开启子代理，修复 Jest 单元测试覆盖率", expected: { intentIncludes: ["testing", "debug"], requiresTests: true } },
  { id: "ios-swiftui", task: "开启子代理，修复 SwiftUI 页面布局", expected: { intentIncludes: ["ios"], role: "worker", skillsInclude: ["build-ios-apps:swiftui-ui-patterns"] } },
  { id: "ios-simulator", task: "开启子代理，在 iOS Simulator 复现崩溃", expected: { intentIncludes: ["ios", "debug"], skillsInclude: ["build-ios-apps:ios-debugger-agent"] } },
  { id: "ios-app-intents", task: "开启子代理，实现 App Intent 快捷操作", expected: { intentIncludes: ["ios"], skillsInclude: ["build-ios-apps:ios-app-intents"] } },
  { id: "devops-docker", task: "开启子代理，修复 Docker 部署失败", expected: { intentIncludes: ["devops", "debug"], role: "worker", skillsInclude: ["community-spellbook-docker"] } },
  { id: "devops-github-actions", task: "开启子代理，修复 Docker GitHub Actions 部署流水线", expected: { intentIncludes: ["devops", "github"], skillsInclude: ["community-spellbook-docker"] } },
  { id: "devops-terraform", task: "开启子代理，审查 Terraform 基础设施变更", expected: { intentIncludes: ["devops", "review"], judgeModel: "gpt-5.5", requiresReview: true } },
  { id: "devops-ci", task: "开启子代理，修复 CI workflow 失败", expected: { intentIncludes: ["devops", "github", "debug"], skillsInclude: ["github:gh-fix-ci"] } },
  { id: "openai-responses", task: "开启子代理，设计 OpenAI Responses API 调用封装", expected: { intentIncludes: ["backend", "data-ai"], skillsInclude: ["community-spellbook-openai-api"], judgeModel: "gpt-5.5" } },
  { id: "openai-agents", task: "开启子代理，规划 OpenAI Agents SDK 多代理架构", expected: { intentIncludes: ["data-ai", "planning"], skillsInclude: ["community-spellbook-openai-agents"], judgeModel: "gpt-5.5" } },
  { id: "ai-rag", task: "开启子代理，设计 RAG 向量检索流程", expected: { intentIncludes: ["data-ai"], judgeModel: "gpt-5.5" } },
  { id: "ai-langgraph", task: "开启子代理，实现 LangGraph agent 工作流", expected: { intentIncludes: ["data-ai"], skillsInclude: ["community-spellbook-langgraph"], judgeModel: "gpt-5.5" } },
  { id: "db-postgres-index", task: "开启子代理，优化 PostgreSQL 慢查询索引", expected: { intentIncludes: ["backend"], skillsInclude: ["community-spellbook-postgresql"] } },
  { id: "db-migration", task: "开启子代理，设计数据库迁移和回滚方案", expected: { intentIncludes: ["backend", "planning"], judgeModel: "gpt-5.5", skillsInclude: ["community-spellbook-database-design"] } },
  { id: "db-sqlalchemy", task: "开启子代理，优化 SQLAlchemy 查询性能", expected: { skillsInclude: ["community-spellbook-sqlalchemy"] } },
  { id: "docs-readme-typo", task: "开启子代理，修正 README 里的一个拼写错误", expected: { agentIn: ["documentation-engineer"], judgeMode: "deterministic", judgeModel: "none", selectedModel: "gpt-5.4-mini", cacheEligible: true } },
  { id: "docs-changelog", task: "开启子代理，整理 changelog 发布说明", expected: { intentIncludes: ["docs"], role: "worker" } },
  { id: "docs-official", task: "开启子代理，调研官方文档确认 OpenAI API 用法", expected: { agentIn: ["docs-researcher"], role: "explorer" } },
  { id: "docs-sync", task: "开启子代理，同步 docs 和 AGENTS.md 编码规范", expected: { intentIncludes: ["docs"], skillsInclude: ["community-jmerta-agents-md"] } },
  { id: "planning-cross-module", task: "开启子代理，按照执行计划跨模块重构认证和计费流程", expected: { intentIncludes: ["planning", "backend"], judgeModel: "gpt-5.5", executionMode: "staged" } },
  { id: "planning-architecture", task: "开启子代理，规划微服务架构迁移路线", expected: { intentIncludes: ["planning"], judgeModel: "gpt-5.5", executionMode: "staged" } },
  { id: "planning-product", task: "开启子代理，分析这个奇怪的产品问题", expected: { intentIncludes: ["product"], executionMode: "clarify-first", needsParentChoice: true, judgeModel: "gpt-5.5" } },
  { id: "ambiguous-issue", task: "开启子代理，帮我看看这个东西哪里不对", expected: { executionMode: "clarify-first", needsParentChoice: true, judgeModel: "gpt-5.5" } },
  { id: "cache-volatile-file", task: "开启子代理，修复 /tmp/app/auth.ts 第 42 行报错", expected: { cacheEligible: false } },
  { id: "budget-premium", task: "开启子代理，高质量审查 API 兼容性", options: { budget: "premium" }, expected: { judgeModel: "gpt-5.5" } },
  { id: "budget-critical", task: "开启子代理，critical 模式审查生产事故回滚方案", options: { budget: "critical" }, expected: { judgeModel: "gpt-5.5", selectedModel: "gpt-5.5" } },
  { id: "budget-economy-mini", task: "开启子代理，补齐单元测试覆盖率", options: { budget: "economy", forceModel: true }, expected: { judgeMode: "mini-judge", judgeModel: "gpt-5.4-mini" } },
  { id: "community-figma", task: "开启子代理，根据 Figma 设计稿实现页面", expected: { skillsInclude: ["community-openai-figma-implement-design"] } },
  { id: "community-release", task: "开启子代理，生成 release notes 和 changelog", expected: { skillsInclude: ["community-jmerta-release-notes"] } },
];

function evaluateCase(testCase) {
  const route = routeTask(testCase.task, { candidateLimit: 8 });
  const policy = computeJudgePolicy(testCase.task, route, testCase.options || {});
  const failures = [];
  const expected = testCase.expected || {};
  const agentNames = route.candidates.map((candidate) => candidate.name);
  const intentIds = route.matchedIntents.map((intent) => intent.id);
  const skills = buildSkillCandidates(testCase.task, policy.candidateBudget.skills).map((skill) => skill.name);
  const suggested = unique([...(route.suggestedSkills || []), ...skills]);
  const check = (condition, message) => { if (!condition) failures.push(message); };
  if (expected.agentIn) check(expected.agentIn.includes(route.recommended.name) || expected.agentIn.some((name) => agentNames.includes(name)), `expected agent in ${expected.agentIn.join(", ")}, got ${route.recommended.name}`);
  if (expected.intentIncludes) for (const intent of expected.intentIncludes) check(intentIds.includes(intent), `missing intent ${intent}`);
  if (expected.role) check(route.recommended.runtimeRole === expected.role, `expected role ${expected.role}, got ${route.recommended.runtimeRole}`);
  if (expected.sandbox) check(route.recommended.sandboxMode === expected.sandbox, `expected sandbox ${expected.sandbox}, got ${route.recommended.sandboxMode}`);
  if (expected.skillsInclude) for (const skill of expected.skillsInclude) check(suggested.includes(skill), `missing skill ${skill}`);
  if (expected.selectedModel) check(route.modelPolicy.selectedModel === expected.selectedModel, `expected selectedModel ${expected.selectedModel}, got ${route.modelPolicy.selectedModel}`);
  if (expected.judgeMode) check(policy.judgeMode === expected.judgeMode, `expected judgeMode ${expected.judgeMode}, got ${policy.judgeMode}`);
  if (expected.judgeModel) check(policy.judgeModel === expected.judgeModel, `expected judgeModel ${expected.judgeModel}, got ${policy.judgeModel}`);
  if (expected.cacheEligible !== undefined) check(policy.cacheEligible === expected.cacheEligible, `expected cacheEligible ${expected.cacheEligible}, got ${policy.cacheEligible}`);
  if (expected.executionMode) check(route.executionPlan.mode === expected.executionMode, `expected executionMode ${expected.executionMode}, got ${route.executionPlan.mode}`);
  if (expected.requiresTests !== undefined) check(route.executionPlan.requiresTests === expected.requiresTests, `expected requiresTests ${expected.requiresTests}, got ${route.executionPlan.requiresTests}`);
  if (expected.requiresReview !== undefined) check(route.executionPlan.requiresReview === expected.requiresReview, `expected requiresReview ${expected.requiresReview}, got ${route.executionPlan.requiresReview}`);
  if (expected.needsParentChoice !== undefined) check(route.needsParentChoice === expected.needsParentChoice, `expected needsParentChoice ${expected.needsParentChoice}, got ${route.needsParentChoice}`);
  const highRisk = ["high", "critical"].includes(route.taskProfile.risk) || ["high", "critical"].includes(route.modelPolicy.importanceLevel);
  if (highRisk) check(policy.judgeModel === "gpt-5.5", `high-risk policy must use gpt-5.5, got ${policy.judgeModel}`);
  return {
    id: testCase.id,
    pass: failures.length === 0,
    failures,
    summary: {
      finalAgent: route.recommended.name,
      intents: intentIds,
      judgeMode: policy.judgeMode,
      judgeModel: policy.judgeModel,
      selectedModel: route.modelPolicy.selectedModel,
      cacheEligible: policy.cacheEligible,
      executionMode: route.executionPlan.mode,
      skills: suggested.slice(0, 8),
    },
  };
}

function runEval(mode = "text") {
  const started = Date.now();
  const results = EVAL_CASES.map(evaluateCase);
  const failed = results.filter((result) => !result.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    passRate: results.length ? Number((((results.length - failed.length) / results.length) * 100).toFixed(2)) : 0,
    elapsedMs: Date.now() - started,
    qualityRiskSummary: failed.map((result) => ({ id: result.id, failures: result.failures })),
    results,
  };
  fs.writeFileSync(EVAL_RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`);
  if (mode === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`EVAL ${report.passed}/${report.total} passed in ${report.elapsedMs}ms`);
    if (failed.length) {
      for (const result of failed) console.log(`FAIL ${result.id}: ${result.failures.join("; ")}`);
    }
  }
  if (failed.length) throw new Error(`eval failed: ${failed.length}/${results.length} cases failed`);
}

function runTests() {
  const cases = [
    {
      task: "开启子代理，帮我修前端 bug",
      expectedAgent: "frontend-developer",
      expectedRole: "worker",
      expectedSkills: ["build-web-apps:frontend-app-builder"],
      expectedModel: "gpt-5.4",
      minConfidence: "medium",
    },
    {
      task: "开启子代理，审查当前 diff",
      expectedAgent: "reviewer",
      expectedRole: "explorer",
      expectedSandbox: "read-only",
      expectedModel: "gpt-5.5",
      expectedExecutionMode: "single-agent",
      requiresReview: true,
      minConfidence: "medium",
    },
    {
      task: "开启子代理，修复 API 鉴权问题",
      expectedCandidates: ["backend-developer", "security-engineer"],
      expectedRole: "worker",
      expectedSkills: ["agyb-full-stack-developer:api-patterns"],
      expectedModel: "gpt-5.5",
      requiresTests: true,
      minConfidence: "medium",
    },
    {
      task: "开启子代理，补齐 pytest 覆盖率",
      expectedAgent: "test-automator",
      expectedRole: "worker",
      expectedSkills: ["superpowers:test-driven-development"],
      expectedModel: "gpt-5.4",
      minConfidence: "medium",
    },
    {
      task: "开启子代理，修复 SwiftUI 页面布局",
      expectedCandidates: ["swift-expert", "mobile-developer", "frontend-developer"],
      expectedRole: "worker",
      expectedSkills: ["build-ios-apps:swiftui-ui-patterns"],
      minConfidence: "medium",
    },
    {
      task: "开启子代理，修复 Docker 部署失败",
      expectedCandidates: ["deployment-engineer", "devops-engineer", "docker-expert"],
      expectedRole: "worker",
      minConfidence: "medium",
    },
    {
      task: "开启子代理，分析这个奇怪的产品问题",
      expectedCandidates: ["product-manager", "risk-manager", "research-analyst"],
      expectedLowOrChoice: true,
      expectedModel: "gpt-5.5",
      expectedExecutionMode: "clarify-first",
    },
    {
      task: "开启子代理，修正 README 里的一个拼写错误",
      expectedModel: "gpt-5.4-mini",
    },
    {
      task: "开启子代理，按照执行计划跨模块重构认证和计费流程",
      expectedModel: "gpt-5.5",
      expectedExecutionMode: "staged",
    },
    {
      task: "开启子代理，调研官方文档确认 OpenAI API 用法",
      expectedAgent: "docs-researcher",
      expectedRole: "explorer",
    },
    {
      task: "开启子代理，构建 React Suspense 前端组件",
      expectedCommunitySkill: "community-spellbook-react",
    },
    {
      task: "开启子代理，设计 OpenAI Responses API 调用封装",
      expectedCommunitySkill: "community-spellbook-openai-api",
    },
    {
      task: "开启子代理，优化 PostgreSQL 慢查询索引",
      expectedCommunitySkill: "community-spellbook-postgresql",
    },
    {
      task: "开启子代理，修复 Docker GitHub Actions 部署流水线",
      expectedCommunitySkill: "community-spellbook-docker",
    },
    {
      task: "开启子代理，修正 README 里的一个拼写错误",
      expectedModel: "gpt-5.4-mini",
      expectedJudgeMode: "deterministic",
    },
    {
      task: "开启子代理，审查当前 diff 里的生产鉴权漏洞",
      expectedJudgeModel: "gpt-5.5",
      expectedCacheEligible: false,
    },
  ];
  const rank = { low: 0, medium: 1, high: 2 };
  const started = Date.now();
  for (const testCase of cases) {
    const route = routeTask(testCase.task);
    if (testCase.expectedAgent) {
      assert(route.recommended.name === testCase.expectedAgent, `${testCase.task}: expected ${testCase.expectedAgent}, got ${route.recommended.name}`);
    }
    if (testCase.expectedCandidates) {
      const names = route.candidates.map((candidate) => candidate.name);
      assert(testCase.expectedCandidates.some((name) => names.includes(name) || route.recommended.name === name), `${testCase.task}: expected one of ${testCase.expectedCandidates.join(", ")}, got ${names.join(", ")}`);
    }
    if (testCase.expectedRole) {
      assert(route.recommended.runtimeRole === testCase.expectedRole, `${testCase.task}: expected role ${testCase.expectedRole}, got ${route.recommended.runtimeRole}`);
    }
    if (testCase.expectedSandbox) {
      assert(route.recommended.sandboxMode === testCase.expectedSandbox, `${testCase.task}: expected sandbox ${testCase.expectedSandbox}, got ${route.recommended.sandboxMode}`);
    }
    if (testCase.expectedSkills) {
      for (const skill of testCase.expectedSkills) {
        assert(route.suggestedSkills.includes(skill), `${testCase.task}: expected skill ${skill}`);
      }
    }
    if (testCase.expectedCommunitySkill) {
      assert(route.suggestedSkills.includes(testCase.expectedCommunitySkill), `${testCase.task}: expected community skill ${testCase.expectedCommunitySkill}`);
    }
    if (testCase.expectedModel) {
      assert(route.modelPolicy.selectedModel === testCase.expectedModel, `${testCase.task}: expected model ${testCase.expectedModel}, got ${route.modelPolicy.selectedModel}`);
    }
    if (testCase.expectedExecutionMode) {
      assert(route.executionPlan.mode === testCase.expectedExecutionMode, `${testCase.task}: expected execution mode ${testCase.expectedExecutionMode}, got ${route.executionPlan.mode}`);
    }
    if (testCase.expectedJudgeMode || testCase.expectedJudgeModel || testCase.expectedCacheEligible !== undefined) {
      const policy = computeJudgePolicy(testCase.task, route);
      if (testCase.expectedJudgeMode) {
        assert(policy.judgeMode === testCase.expectedJudgeMode, `${testCase.task}: expected judge mode ${testCase.expectedJudgeMode}, got ${policy.judgeMode}`);
      }
      if (testCase.expectedJudgeModel) {
        assert(policy.judgeModel === testCase.expectedJudgeModel, `${testCase.task}: expected judge model ${testCase.expectedJudgeModel}, got ${policy.judgeModel}`);
      }
      if (testCase.expectedCacheEligible !== undefined) {
        assert(policy.cacheEligible === testCase.expectedCacheEligible, `${testCase.task}: expected cache eligible ${testCase.expectedCacheEligible}, got ${policy.cacheEligible}`);
      }
    }
    if (testCase.requiresReview) {
      assert(route.executionPlan.requiresReview, `${testCase.task}: expected review requirement`);
    }
    if (testCase.requiresTests) {
      assert(route.executionPlan.requiresTests, `${testCase.task}: expected tests requirement`);
    }
    assert(route.strategyConfig.loaded, `${testCase.task}: strategy config should load`);
    assert(route.taskProfile?.complexity, `${testCase.task}: missing task profile`);
    assert(route.executionPlan?.stages?.length, `${testCase.task}: missing execution stages`);
    assert(route.selectedSkillsByPhase && typeof route.selectedSkillsByPhase === "object", `${testCase.task}: missing skills by phase`);
    assert(route.modelPolicy.selectedModel, `${testCase.task}: missing model policy`);
    assert(route.modelPolicy.reasoningEffort, `${testCase.task}: missing reasoning effort`);
    if (testCase.minConfidence) {
      assert(rank[route.confidence] >= rank[testCase.minConfidence], `${testCase.task}: expected confidence >= ${testCase.minConfidence}, got ${route.confidence}`);
    }
    if (testCase.expectedLowOrChoice) {
      assert(route.confidence === "low" || route.needsParentChoice, `${testCase.task}: expected low confidence or parent choice`);
    }
    assert(route.delegationPrompt.includes(route.recommended.name), `${testCase.task}: delegation prompt missing agent name`);
  }
  const elapsed = Date.now() - started;
  assert(elapsed < 250, `routing tests took ${elapsed}ms, expected under 250ms`);
  console.log(`PASS ${cases.length} routing tests in ${elapsed}ms`);
}

function runJudgeSmokeTest() {
  const result = runModelJudgement("开启子代理，审查当前 diff", { timeoutMs: 240000 });
  assert(result.finalAgent, "judge result missing finalAgent");
  assert(result.modelUsed, `judge smoke test fell back instead of using model judge: ${result.modelError || "unknown error"}`);
  assert(result.judgeModel === "gpt-5.5", `review/current diff should use gpt-5.5 judge, got ${result.judgeModel}`);
  assert(["explorer", "worker"].includes(result.runtimeRole), "judge result has invalid runtimeRole");
  assert(["read-only", "workspace-write", "danger-full-access"].includes(result.sandboxMode), "judge result has invalid sandboxMode");
  assert(Array.isArray(result.selectedSkills), "judge result selectedSkills must be array");
  assert(result.selectedModel, "judge result missing selectedModel");
  assert(result.reasoningEffort, "judge result missing reasoningEffort");
  assert(result.importanceLevel, "judge result missing importanceLevel");
  assert(result.taskProfile?.complexity, "judge result missing taskProfile");
  assert(result.executionPlan?.mode, "judge result missing executionPlan");
  assert(result.selectedSkillsByPhase?.review, "judge result missing selectedSkillsByPhase");
  assert(Array.isArray(result.modelRationale) && result.modelRationale.length > 0, "judge result needs modelRationale");
  assert(Array.isArray(result.rationale) && result.rationale.length > 0, "judge result needs rationale");
  assert(result.delegationPrompt.includes(result.finalAgent), "judge delegation prompt missing final agent");
  console.log(JSON.stringify({
    pass: true,
    modelUsed: result.modelUsed,
    modelError: result.modelError || null,
    judgeMode: result.judgeMode,
    judgeModel: result.judgeModel,
    cache: result.cache || null,
    finalAgent: result.finalAgent,
    runtimeRole: result.runtimeRole,
    sandboxMode: result.sandboxMode,
    selectedModel: result.selectedModel,
    reasoningEffort: result.reasoningEffort,
    importanceLevel: result.importanceLevel,
    executionMode: result.executionPlan.mode,
    confidence: result.confidence,
  }, null, 2));
}

function runRecoveryTests() {
  const highRisk = runModelJudgement("开启子代理，审查当前 diff 里的生产鉴权漏洞", { offline: true, noCache: true });
  assert(highRisk.requiresParentReview, "high-risk offline fallback must require parent review");
  assert(highRisk.fallbackSafety === "conservative", `expected conservative fallback, got ${highRisk.fallbackSafety}`);
  assert(highRisk.failureClass === "offline", `expected offline failure class, got ${highRisk.failureClass}`);

  const lowRisk = runModelJudgement("开启子代理，修正 README 里的一个拼写错误", { noCache: true });
  assert(!lowRisk.requiresParentReview, "low-risk deterministic route should not require parent review");
  assert(lowRisk.fallbackSafety === "safe-deterministic", `expected safe deterministic fallback, got ${lowRisk.fallbackSafety}`);
  assert(lowRisk.failureClass === "none", `expected no failure class, got ${lowRisk.failureClass}`);

  const originalCache = fs.existsSync(JUDGEMENT_CACHE_PATH) ? readText(JUDGEMENT_CACHE_PATH) : "";
  fs.writeFileSync(JUDGEMENT_CACHE_PATH, "{ bad json");
  const cache = readJudgementCache();
  assert(cache && typeof cache === "object", "bad cache should recover to object");
  assert(Object.keys(cache.entries || {}).length === 0, "bad cache should recover to empty entries");
  if (originalCache) fs.writeFileSync(JUDGEMENT_CACHE_PATH, originalCache);

  const candidates = buildSkillCandidates("开启子代理，修复 React 前端 bug", 18);
  assert(candidates.every((skill) => skillNameAvailable(skill.name)), "skill candidates should only include available skills");

  console.log(JSON.stringify({
    pass: true,
    highRisk: {
      fallbackSafety: highRisk.fallbackSafety,
      failureClass: highRisk.failureClass,
      requiresParentReview: highRisk.requiresParentReview,
    },
    lowRisk: {
      fallbackSafety: lowRisk.fallbackSafety,
      failureClass: lowRisk.failureClass,
      requiresParentReview: lowRisk.requiresParentReview,
    },
    cacheRecovery: true,
    availableSkillFiltering: true,
  }, null, 2));
}

function runHandoffTests() {
  const cases = [
    { id: "cross-module", task: "开启子代理，按照执行计划跨模块重构认证和计费流程", needsStage: ["explore", "implement", "validate", "review"] },
    { id: "security-fix", task: "开启子代理，修复 API 鉴权问题", needsStage: ["primary", "validate", "review"] },
    { id: "frontend-bug", task: "开启子代理，帮我修前端 bug", needsStage: ["primary", "validate"] },
    { id: "ci-failure", task: "开启子代理，修复 CI workflow 失败", needsStage: ["primary", "validate"] },
    { id: "openai-api", task: "开启子代理，设计 OpenAI Responses API 调用封装", needsStage: ["primary", "review"] },
    { id: "ambiguous", task: "开启子代理，帮我看看这个东西哪里不对", needsStage: ["clarify"], clarify: true },
  ];
  const results = [];
  for (const testCase of cases) {
    const result = runModelJudgement(testCase.task, { offline: true, noCache: true });
    const stageIds = result.handoffPlan.stages.map((stage) => stage.id);
    for (const stage of testCase.needsStage) assert(stageIds.includes(stage), `${testCase.id}: missing handoff stage ${stage}; got ${stageIds.join(", ")}`);
    for (const stage of result.handoffPlan.stages) {
      assert(stage.agent, `${testCase.id}: stage ${stage.id} missing agent`);
      assert(stage.role, `${testCase.id}: stage ${stage.id} missing role`);
      assert(stage.sandboxMode, `${testCase.id}: stage ${stage.id} missing sandbox`);
      assert(stage.selectedModel, `${testCase.id}: stage ${stage.id} missing selectedModel`);
      assert(Array.isArray(stage.skills), `${testCase.id}: stage ${stage.id} skills must be array`);
      assert(stage.expectedOutput, `${testCase.id}: stage ${stage.id} missing expectedOutput`);
      assert(stage.acceptanceCriteria?.length, `${testCase.id}: stage ${stage.id} missing acceptanceCriteria`);
    }
    if (result.taskProfile.writeIntent === "expected") assert(result.handoffPlan.stages.some((stage) => stage.id === "validate"), `${testCase.id}: write task missing validation stage`);
    if (["high", "critical"].includes(result.taskProfile.risk) && result.taskProfile.writeIntent === "expected") assert(result.handoffPlan.stages.some((stage) => stage.id === "review"), `${testCase.id}: high-risk write task missing review stage`);
    if (testCase.clarify) {
      assert(result.executionPlan.mode === "clarify-first", `${testCase.id}: expected clarify-first`);
      assert(result.handoffPlan.clarificationQuestion, `${testCase.id}: missing clarification question`);
    }
    assert(Array.isArray(result.executionPlan.stageDetails), `${testCase.id}: executionPlan missing stageDetails`);
    results.push({ id: testCase.id, stages: stageIds, mode: result.executionPlan.mode });
  }
  console.log(JSON.stringify({ pass: true, results }, null, 2));
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }
  if (command === "rebuild") {
    const registry = buildRegistry();
    console.log(`Rebuilt ${REGISTRY_PATH} with ${registry.count} agents.`);
    return;
  }
  if (command === "install-all") {
    const registry = installAll();
    console.log(`Installed ${registry.count} agents into ${DEFAULT_AGENTS_DIR}.`);
    return;
  }
  if (command === "list") {
    const query = normalize(rest.join(" "));
    const registry = loadRegistry();
    const agents = query
      ? registry.agents.filter((agent) => normalize(`${agent.name} ${agent.description} ${agent.category}`).includes(query))
      : registry.agents;
    for (const agent of agents) {
      console.log(`${agent.name}\t${agent.runtimeRole}\t${agent.sandboxMode}\t${agent.description}`);
    }
    return;
  }
  if (command === "route") {
    let mode = "full";
    let args = rest;
    if (rest[0] === "--json") {
      mode = "json";
      args = rest.slice(1);
    } else if (rest[0] === "--brief") {
      mode = "brief";
      args = rest.slice(1);
    }
    const task = args.join(" ").trim();
    if (!task) throw new Error("route requires a task string");
    printRoute(routeTask(task), mode);
    return;
  }
  if (command === "judge") {
    let mode = "full";
    let offline = false;
    let noCache = false;
    let forceModel = false;
    let budget = "balanced";
    const args = [];
    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index];
      if (arg === "--json") mode = "json";
      else if (arg === "--explain") mode = "explain";
      else if (arg === "--offline") offline = true;
      else if (arg === "--no-cache") noCache = true;
      else if (arg === "--force-model") forceModel = true;
      else if (arg === "--budget") {
        budget = rest[index + 1] || "";
        index += 1;
        if (!["economy", "balanced", "premium", "critical"].includes(budget)) {
          throw new Error("--budget must be one of economy, balanced, premium, critical");
        }
      } else args.push(arg);
    }
    const task = args.join(" ").trim();
    if (!task) throw new Error("judge requires a task string");
    printJudgement(runModelJudgement(task, { offline, noCache, forceModel, budget }), mode);
    return;
  }
  if (command === "prompt") {
    const [name, ...taskParts] = rest;
    const task = taskParts.join(" ").trim();
    if (!name || !task) throw new Error("prompt requires <agent-name> <task>");
    const registry = loadRegistry();
    const agent = registry.agents.find((entry) => entry.name === name);
    if (!agent) throw new Error(`Unknown agent: ${name}`);
    const skills = skillMatches(task).map((entry) => entry.name);
    console.log(buildPrompt(agent, task, skills));
    return;
  }
  if (command === "test") {
    runTests();
    return;
  }
  if (command === "eval") {
    const mode = rest.includes("--json") ? "json" : "text";
    runEval(mode);
    return;
  }
  if (command === "test-judge") {
    runJudgeSmokeTest();
    return;
  }
  if (command === "test-recovery") {
    runRecoveryTests();
    return;
  }
  if (command === "test-handoff") {
    runHandoffTests();
    return;
  }
  if (command === "doctor") {
    const mode = rest.includes("--json") ? "json" : "text";
    runDoctor(mode);
    return;
  }
  if (command === "report") {
    const mode = rest.includes("--json") ? "json" : "text";
    runReport(mode);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
