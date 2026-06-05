#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROUTER_DIR = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME;
if (!HOME) throw new Error("HOME is required; set CODEX_HOME explicitly when running in a minimal environment.");
const CODEX_HOME = process.env.CODEX_HOME || path.join(HOME, ".codex");
const runtimePath = (filename) => path.join(CODEX_HOME, "subagents", filename);
const bundledPath = (filename) => {
  const local = path.join(ROUTER_DIR, filename);
  return fs.existsSync(local) ? local : runtimePath(filename);
};
const DEFAULT_REPO = path.join(CODEX_HOME, "subagents", "awesome-codex-subagents");
const DEFAULT_AGENTS_DIR = path.join(CODEX_HOME, "agents");
const REGISTRY_PATH = bundledPath("registry.json");
const JUDGEMENT_SCHEMA_PATH = bundledPath("judgement.schema.json");
const STRATEGY_CONFIG_PATH = bundledPath("strategy-config.json");
const COMMUNITY_SKILLS_MANIFEST_PATH = bundledPath("community-skills-manifest.json");
const JUDGEMENT_CACHE_PATH = runtimePath("judgement-cache.json");
const ROUTE_CACHE_PATH = runtimePath("route-cache.json");
const SKILL_REGISTRY_SNAPSHOT_PATH = runtimePath("skill-registry-snapshot.json");
const EVAL_RESULTS_PATH = runtimePath("last-eval-results.json");
const SKILL_REPAIR_RESULTS_PATH = runtimePath("last-skill-repair-results.json");
const CODEX_CLI = process.env.CODEX_CLI || "codex";

const DEFAULT_COST_POLICY = {
  budgets: ["economy", "balanced", "premium", "critical"],
  highRiskIntents: ["security", "review", "planning", "devops", "data-ai"],
  volatileContextPattern: "current diff|当前\\s*diff|git diff|uncommitted|working tree|当前分支|生产日志|线上日志|日志|\\blog\\b|stack trace|traceback|报错输出|失败输出|test output|文件\\s*:|/[\\w.-]+/|第\\s*\\d+\\s*行|line\\s+\\d+",
  candidateBudgets: {
    critical: { agents: 8, skills: 18 },
    premium: { agents: 6, skills: 16 },
    balanced: { agents: 5, skills: 12 },
    economy: { agents: 4, skills: 10 },
    economyLowRisk: { agents: 3, skills: 8 },
  },
  cache: {
    maxEntries: 200,
    routeMaxEntries: 300,
    stableRouteKinds: ["release-publishing", "repo-maintenance", "research-only", "product-analysis", "engineering-analysis"],
    snapshotMaxAgeHours: 168,
  },
};

const DEFAULT_TASK_KIND_POLICY = {
  "release-publishing": {
    keywords: [
      "readme|changelog|release notes?|release\\b|publish|publishing|public repo|github readme|installation steps|发布说明|发布|公开仓库|仓库说明|安装步骤|版本说明|致谢",
    ],
    preferredAgents: ["documentation-engineer", "technical-writer", "github-expert", "release-manager", "docs-researcher"],
    allowedPhases: ["planning", "research", "review", "deployment", "matched"],
  },
  "repo-maintenance": {
    keywords: [
      "doctor|report|config|configuration|cache|snapshot|registry|cleanup|maintenance|dependency|sync|健康状态|配置|缓存|快照|注册表|维护|清理|同步|依赖",
    ],
    preferredAgents: ["code-mapper", "architect-reviewer", "documentation-engineer", "devops-engineer"],
    allowedPhases: ["planning", "research", "design", "implementation", "testing", "review", "matched"],
  },
  "research-only": {
    keywords: [
      "research only|read[- ]?only research|only research|official docs|source verification|do not edit|do not write|no code changes|不要改代码|不要修改|只调研|仅调研|只读调研|官方文档|查资料|只读",
    ],
    preferredAgents: ["docs-researcher", "research-analyst", "code-mapper", "reviewer"],
    allowedPhases: ["planning", "research", "review", "matched"],
  },
  "incident-response": {
    keywords: [
      "incident|outage|production log|prod log|rollback|hotfix|sev[0-9]?|downtime|sre|线上事故|生产事故|线上故障|生产故障|线上日志|生产日志|回滚|紧急修复|宕机|告警",
    ],
    preferredAgents: ["sre-engineer", "incident-responder", "debugger", "security-engineer", "devops-engineer"],
    allowedPhases: ["planning", "research", "debugging", "testing", "review", "implementation", "matched"],
  },
  "orchestration-design": {
    keywords: [
      "subagent-router|router|routing|dispatch|scheduler|scheduling|handoff|fallback|quality gate|judge matrix|goal mode|agent routing|multi-agent|multiple subagents|调度|调度器|路由器|路由|调用速度|调用的速度|算法调度|质量门|回退|委派|编排|多代理|多智能体|多个子代理|goal 模式",
    ],
    preferredAgents: ["architect-reviewer", "project-manager", "multi-agent-coordinator", "code-mapper"],
    allowedPhases: ["planning", "research", "design", "review", "testing", "matched"],
  },
  "product-analysis": {
    keywords: [
      "adoption|churn|funnel|market|用户体验|用户问题|用户|产品|需求|商业|增长|定位|留存|转化|漏斗",
    ],
    preferredAgents: ["product-manager", "research-analyst", "risk-manager", "business-analyst"],
    allowedPhases: ["planning", "research", "review", "matched"],
  },
  "engineering-analysis": {
    keywords: [
      "review|audit|analy[sz]e|inspect|diagnose|map|评审|审查|审计|分析|检查|诊断",
    ],
    preferredAgents: ["reviewer", "architect-reviewer", "code-mapper", "debugger"],
    allowedPhases: ["planning", "research", "design", "debugging", "testing", "review", "matched"],
  },
  "engineering-execution": {
    keywords: [
      "fix|implement|build|create|edit|update|refactor|optimi[sz]e|improve|iterate|execute|修复|实现|创建|修改|改|写|补齐|重构|优化|完善|迭代|执行",
    ],
    preferredAgents: [],
    allowedPhases: ["planning", "research", "design", "implementation", "debugging", "testing", "review", "deployment", "matched"],
  },
};

const DEFAULT_HIGH_RISK_RULES = [
  { id: "security", pattern: "security|vulnerability|permission|secret|privacy|compliance|xss|csrf|sql injection|安全|漏洞|权限|隐私|合规|威胁" },
  { id: "auth", pattern: "auth|oauth|token|credential|鉴权|认证|凭证|令牌" },
  { id: "production", pattern: "production|prod\\b|线上|生产" },
  { id: "current-diff", pattern: "current diff|当前\\s*diff|git diff|uncommitted|working tree|当前分支" },
  { id: "incident", pattern: "incident|outage|rollback|downtime|线上事故|生产事故|故障|回滚|宕机" },
];

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
    patterns: [/plan|implement this plan|roadmap|goal|执行计划|实现方案|规划|计划|多代理|多智能体|持续迭代/i],
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
    patterns: [/security|vulnerability|auth|permission|secret|xss|csrf|sql injection|license|third[- ]party|\/Users|本机路径|安全|漏洞|权限|隐私|许可|许可证/i],
  },
];

let skillRegistryCache = null;
let availableSkillNameSetCache = null;
const routeTaskCache = new Map();

const INTENT_RULES = [
  {
    id: "review",
    label: "review and risk analysis",
    patterns: [[/审查|审计|检查|代码审查|review|audit|diff|regression|correctness|security review|pr\b|pull request/i, 45]],
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
    patterns: [[/debug|bug|error|exception|crash|fail|flaky|regression|unavailable|不可用|错误|报错|崩溃|失败|修复|问题/i, 35]],
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
    patterns: [[/security|vulnerability|permission|secret|xss|csrf|sql injection|threat model|license|third[- ]party|\/Users|本机路径|安全|漏洞|权限|隐私|合规|威胁建模|许可|许可证/i, 42]],
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
    patterns: [[/data|analytics|ml|machine learning|llm|rag|prompt|dataset|openai|responses api|agents sdk|langgraph|数据|机器学习|大模型|向量/i, 42]],
    preferredAgents: ["ai-engineer", "llm-architect", "data-engineer", "data-analyst"],
    categories: ["05-data-ai"],
    preferredSandbox: "workspace-write",
  },
  {
    id: "docs",
    label: "documentation or technical writing",
    patterns: [[/docs|documentation|readme|changelog|release note|report|status output|文档|说明|教程|发布说明|报告|健康状态|输出/i, 40]],
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
    patterns: [[/plan|roadmap|architecture|design|goal|multi-agent|multiple subagents|skills|skill-driven|orchestration|执行计划|实现方案|规划|计划|架构|设计|多代理|多智能体|多个子代理|持续迭代|完整优化|优化方向/i, 36]],
    preferredAgents: ["project-manager", "architect-reviewer", "business-analyst", "code-mapper"],
    categories: ["08-business-product", "04-quality-security", "01-core-development"],
    preferredSandbox: "read-only",
  },
  {
    id: "orchestration",
    label: "subagent routing, workflow orchestration, or router strategy",
    patterns: [[/subagent-router|router|routing|dispatch|scheduler|scheduling|handoff|fallback|quality gate|judge matrix|goal mode|agent routing|调度|调度器|路由器|路由|调用速度|调用的速度|算法调度|质量门|回退|委派|编排|goal 模式/i, 64]],
    preferredAgents: ["architect-reviewer", "project-manager", "multi-agent-coordinator", "code-mapper"],
    categories: ["04-quality-security", "08-business-product", "01-core-development"],
    preferredSandbox: "read-only",
  },
  {
    id: "product",
    label: "product, market, or user-impact analysis",
    patterns: [[/product|market|用户|产品|需求|商业|增长|产品定位|市场定位|路线图/i, 38]],
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
  router.mjs judge [--json|--verbose|--explain|--offline] [--budget economy|balanced|premium|critical] [--no-cache] [--force-model] <task>
  router.mjs managed [--json] <task>
  router.mjs prompt <agent-name> <task>
  router.mjs install-all
  router.mjs test
  router.mjs eval [--json]
  router.mjs test-performance
  router.mjs test-managed
  router.mjs test-skills-phase
  router.mjs test-judge-matrix
  router.mjs test-recovery
  router.mjs test-handoff
  router.mjs test-skill-repair
  router.mjs test-config
  router.mjs test-config-explain
  router.mjs test-route-cache
  router.mjs test-managed-contract
  router.mjs test-agent-roster
  router.mjs test-managed-readiness
  router.mjs test-cache-maintenance
  router.mjs cache-status [--json]
  router.mjs cache-prune [--json] [--all|--route|--judgement] [--older-than-hours N]
  router.mjs config-check [--json]
  router.mjs config-explain [--json] <task>
  router.mjs refresh-skills
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

function scanSkillRegistry() {
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
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function writeSkillRegistrySnapshot(skills) {
  fs.mkdirSync(path.dirname(SKILL_REGISTRY_SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SKILL_REGISTRY_SNAPSHOT_PATH, `${JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    count: skills.length,
    skills,
  }, null, 2)}\n`);
}

function readSkillRegistrySnapshot() {
  if (!fs.existsSync(SKILL_REGISTRY_SNAPSHOT_PATH)) return null;
  try {
    const snapshot = JSON.parse(readText(SKILL_REGISTRY_SNAPSHOT_PATH));
    if (!Array.isArray(snapshot.skills)) throw new Error("snapshot missing skills array");
    return snapshot.skills
      .filter((skill) => skill?.name && skill?.description)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    try {
      fs.renameSync(SKILL_REGISTRY_SNAPSHOT_PATH, `${SKILL_REGISTRY_SNAPSHOT_PATH}.corrupt-${Date.now()}`);
    } catch {
      // Best-effort quarantine only.
    }
    return null;
  }
}

function loadSkillRegistry() {
  if (skillRegistryCache) return skillRegistryCache;
  const snapshot = readSkillRegistrySnapshot();
  if (snapshot?.length) {
    skillRegistryCache = snapshot;
    return skillRegistryCache;
  }
  skillRegistryCache = scanSkillRegistry();
  writeSkillRegistrySnapshot(skillRegistryCache);
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
      taskKindPolicy: {
        ...DEFAULT_TASK_KIND_POLICY,
        ...(raw.taskKindPolicy || {}),
      },
      highRiskRules: Array.isArray(raw.highRiskRules) && raw.highRiskRules.length ? raw.highRiskRules : DEFAULT_HIGH_RISK_RULES,
      managedUX: {
        explanationStyle: "concise",
        maxClarifyingQuestions: 1,
        hideInternalFields: true,
        ...(raw.managedUX || {}),
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
      taskKindPolicy: DEFAULT_TASK_KIND_POLICY,
      highRiskRules: DEFAULT_HIGH_RISK_RULES,
      managedUX: {
        explanationStyle: "concise",
        maxClarifyingQuestions: 1,
        hideInternalFields: true,
      },
      source: "built-in defaults",
      configLoaded: false,
    };
  }
}

function validateStrategyConfig(config = loadStrategyConfig()) {
  const errors = [];
  const warnings = [];
  const validPhases = new Set(["planning", "research", "design", "implementation", "debugging", "testing", "review", "deployment", "matched", "selected"]);
  if (!config.configLoaded) errors.push(`strategy config did not load from ${STRATEGY_CONFIG_PATH}`);
  if (!Array.isArray(config.skillRules) || config.skillRules.length === 0) errors.push("strategy config has no skill rules");
  const seenIds = new Set();
  for (const rule of config.skillRules || []) {
    if (!rule.id) warnings.push("skill rule without id");
    if (rule.id && seenIds.has(rule.id)) errors.push(`duplicate skill rule id: ${rule.id}`);
    if (rule.id) seenIds.add(rule.id);
    if (!Array.isArray(rule.skills) || rule.skills.length === 0) errors.push(`skill rule ${rule.id || "unknown"} has no skills`);
    if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) errors.push(`skill rule ${rule.id || "unknown"} has no patterns`);
    if (rule.phase && !validPhases.has(rule.phase)) errors.push(`skill rule ${rule.id || "unknown"} has invalid phase: ${rule.phase}`);
  }
  const taskKinds = config.taskKindPolicy || {};
  for (const kind of Object.keys(DEFAULT_TASK_KIND_POLICY)) {
    const policy = taskKinds[kind];
    if (!policy) errors.push(`missing taskKind policy: ${kind}`);
    if (policy && !Array.isArray(policy.preferredAgents)) errors.push(`taskKind ${kind} missing preferredAgents array`);
    if (policy && !Array.isArray(policy.allowedPhases)) errors.push(`taskKind ${kind} missing allowedPhases array`);
    for (const phase of policy?.allowedPhases || []) {
      if (!validPhases.has(phase)) errors.push(`taskKind ${kind} has invalid phase: ${phase}`);
    }
  }
  const highRiskRuleText = (config.highRiskRules || []).map((rule) => `${rule.id || ""} ${rule.pattern || ""}`).join(" ");
  for (const required of ["security", "auth", "production", "current-diff"]) {
    if (!new RegExp(required === "current-diff" ? "current|diff|当前" : required, "i").test(highRiskRuleText)) {
      errors.push(`high-risk rules must cover ${required}`);
    }
  }
  for (const budget of DEFAULT_COST_POLICY.budgets) {
    const candidateBudget = config.costPolicy?.candidateBudgets?.[budget === "economy" ? "economy" : budget];
    if (!candidateBudget?.agents || !candidateBudget?.skills) errors.push(`missing candidate budget for ${budget}`);
  }
  try {
    const skillNames = availableSkillNameSet();
    const missingSkills = unique((config.skillRules || []).flatMap((rule) => rule.skills || []))
      .filter((name) => !skillNameAvailable(name, skillNames));
    if (missingSkills.length) errors.push(`configured skills not found: ${missingSkills.slice(0, 12).join(", ")}${missingSkills.length > 12 ? ", ..." : ""}`);
  } catch (error) {
    warnings.push(`configured skill existence check skipped: ${error.message}`);
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

function clearSkillRegistryCaches() {
  skillRegistryCache = null;
  availableSkillNameSetCache = null;
}

function classifyFailure(errorMessage = "") {
  const text = String(errorMessage);
  if (!text) return "none";
  if (/offline mode/i.test(text)) return "offline";
  if (/non-candidate skill/i.test(text)) return "invalid-skill-subset";
  if (/non-candidate agent/i.test(text)) return "invalid-agent-candidate";
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
  const readTask = /review|audit|inspect|analy[sz]e|diff|审查|审计|审核|分析|调研|检查/i.test(task) || isNoWriteTask(task);
  if (writeTask && agent.sandboxMode === "workspace-write") breakdown.sandbox += 18;
  if (readTask && agent.sandboxMode === "read-only") breakdown.sandbox += 18;
  if (writeTask && agent.sandboxMode === "read-only" && !/review|audit|审查|审核/.test(task)) breakdown.penalty -= 16;
  if (readTask && agent.sandboxMode === "workspace-write" && /review|audit|审查|审计|审核|不要改|只读/.test(task)) breakdown.penalty -= 22;

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
  const vague = /奇怪|问题|情况|东西|这个|看看|帮我看|不对|优化一下|改一下|弄一下|something|thing|issue/i.test(cleaned);
  const concrete = /api|auth|database|react|vue|swift|docker|kubernetes|pytest|diff|error|stack|file|接口|鉴权|数据库|前端|页面|部署|测试|代码|文件|日志/i.test(cleaned);
  const topKeyword = ranked[0]?.breakdown?.keyword || 0;
  return vague && !concrete && topKeyword < 8;
}

function isNoWriteTask(task) {
  const cleaned = cleanTask(task);
  if (/read[- ]?only|do not edit|don't edit|do not write|no write|no code changes|不要改|不要修改|不要写|不写代码|不改代码|只读|仅读/i.test(cleaned)) return true;
  const reviewOnly = /审计|审查|检查|review|audit|inspect/i.test(cleaned);
  const writeVerb = /fix|implement|build|create|edit|update|refactor|optimi[sz]e|improve|iterate|execute|maintain|refresh|修复|修|实现|创建|修改|改|写|补齐|重构|优化|完善|迭代|执行|维护|刷新|发布|生成/i.test(cleaned);
  return reviewOnly && !writeVerb;
}

function isProjectScopeTask(task) {
  return /project|repo|repository|codebase|workspace|当前项目|这个项目|我们这个项目|项目|仓库|代码库/i.test(cleanTask(task));
}

function isExplicitBroadAuthorization(task) {
  const cleaned = cleanTask(task);
  const broadWorkflow = /multi-agent|subagents?|skills?|orchestrat|多个子代理|多代理|多智能体|子代理|智能体|skills?/i.test(cleaned);
  const authorization = /完整|全面|持续迭代|持续优化|几个优化方向|自动|自主|允许|授权|可以|全量|跨模块|端到端|完整优化/i.test(cleaned);
  const action = /optimi[sz]e|improve|iterate|implement|execute|review|audit|完善|优化|迭代|实现|执行|审查|检查|规划|计划/i.test(cleaned);
  return broadWorkflow && authorization && action && isProjectScopeTask(task);
}

function configuredTaskKindPolicy() {
  return loadStrategyConfig().taskKindPolicy || DEFAULT_TASK_KIND_POLICY;
}

function patternListMatches(patterns = [], text = "") {
  return patterns.some((pattern) => new RegExp(pattern, "i").test(text));
}

function classifyTaskKind(task, routeLike = {}) {
  const cleaned = cleanTask(task);
  const intentIds = (routeLike.matchedIntents || []).map((intent) => intent.id);
  const policy = configuredTaskKindPolicy();
  const noWrite = isNoWriteTask(cleaned);
  const hasWriteVerb = /fix|implement|build|create|edit|update|refactor|optimi[sz]e|improve|iterate|execute|maintain|refresh|enhance|修复|修|实现|创建|修改|改|写|补齐|重构|优化|完善|增强|迭代|执行|维护|刷新/i.test(cleaned);
  const explicitOrchestration = /subagent-router|router|routing|dispatch|scheduler|scheduling|handoff|fallback|quality gate|judge matrix|goal mode|agent routing|multi-agent|multiple subagents|managed|executioncontract|writeboundaries|parentresponsibilities|stage skill|skill loading|selectedskillsbyphase|调度|调度器|路由器|路由|调用速度|调用的速度|算法调度|质量门|回退|委派|编排|多代理|多智能体|多个子代理|goal 模式|技能加载|加载顺序/i.test(cleaned);
  const productSignals = /adoption|churn|funnel|market|用户体验|用户问题|用户|产品|需求|商业|增长|定位|留存|转化|漏斗/i.test(cleaned);
  const debugSignals = /debug|bug|error|exception|crash|fail|flaky|regression|stack trace|traceback|\blog\b|日志|错误|报错|异常|崩溃|失败|修复|排查|定位.+(问题|异常|错误|失败|crash|bug)/i.test(cleaned);
  const analysisSignals = /review|audit|analy[sz]e|inspect|diagnose|map|评审|审查|审计|分析|调研|检查|诊断|只读|不要改|不改代码/i.test(cleaned);

  if (patternListMatches(policy["incident-response"]?.keywords, cleaned)) return "incident-response";
  if (debugSignals) return hasWriteVerb ? "engineering-execution" : "engineering-analysis";
  if (productSignals && (noWrite || analysisSignals || !hasWriteVerb)) return "product-analysis";
  if (noWrite && /调研|官方文档|查资料|资料|检查|审查|分析|research|official docs|source verification|read[- ]?only research|only research|只读调研|只调研|仅调研/i.test(cleaned)) return "research-only";
  if (patternListMatches(policy["release-publishing"]?.keywords, cleaned) && !/deploy|docker|terraform|kubernetes|k8s|ci failure|部署失败|流水线失败/i.test(cleaned)) return "release-publishing";
  if (patternListMatches(policy["repo-maintenance"]?.keywords, cleaned) && !/线上事故|生产事故|incident|outage/i.test(cleaned)) return "repo-maintenance";
  if (explicitOrchestration) return "orchestration-design";
  if (noWrite || analysisSignals || intentIds.some((id) => ["review", "security", "research"].includes(id))) return "engineering-analysis";
  return hasWriteVerb || intentIds.some((id) => ["frontend", "backend", "debug", "testing", "ios", "devops", "data-ai"].includes(id))
    ? "engineering-execution"
    : "engineering-analysis";
}

function preferredAgentsForTaskKind(taskKind) {
  return configuredTaskKindPolicy()[taskKind]?.preferredAgents || [];
}

function shouldKeepSkillForTaskKind(entry, taskKind, task) {
  const allowedPhases = configuredTaskKindPolicy()[taskKind]?.allowedPhases;
  const phase = entry.phase || "implementation";
  if (taskKind === "research-only") {
    return ["planning", "research", "review", "matched"].includes(phase);
  }
  if (taskKind === "release-publishing") {
    if (/github|release|publish|发布|公开仓库/i.test(cleanTask(task)) && entry.name === "github:github") return true;
    return ["planning", "research", "review", "deployment", "matched"].includes(phase);
  }
  if (taskKind === "product-analysis") {
    return ["planning", "research", "review", "matched"].includes(phase);
  }
  if (taskKind === "orchestration-design") {
    if (/openai|agents sdk|responses api|langgraph|llm|大模型/i.test(cleanTask(task))) return true;
    if (/community-spellbook-openai|community-spellbook-langgraph/.test(entry.name)) return false;
    return ["planning", "research", "design", "review", "testing", "matched"].includes(phase)
      || ["superpowers:executing-plans", "superpowers:subagent-driven-development", "superpowers:writing-plans"].includes(entry.name);
  }
  if (Array.isArray(allowedPhases) && !allowedPhases.includes(phase)) return false;
  return true;
}

function computeModelPolicy(task, agent, routeLike = {}) {
  const cleaned = cleanTask(task);
  const intentIds = (routeLike.matchedIntents || []).map((intent) => intent.id);
  const taskKind = routeLike.taskKind || routeLike.taskProfile?.taskKind || classifyTaskKind(task, routeLike);
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
  for (const rule of loadStrategyConfig().highRiskRules || DEFAULT_HIGH_RISK_RULES) {
    if (rule.pattern && new RegExp(rule.pattern, "i").test(cleaned)) reasons.push(`high-risk rule: ${rule.id || "configured"}`);
  }
  const simpleSignals = [
    [/docs|readme|changelog|typo|format|文档|说明|拼写|格式/i, "simple documentation or formatting task"],
    [/rename|copy|list|summarize|简单|小改|轻微/i, "small low-risk task"],
  ];

  for (const [pattern, reason] of criticalSignals) {
    if (pattern.test(cleaned)) reasons.push(reason);
  }

  const lowRiskReadOnlyProduct = taskKind === "product-analysis"
    && (isNoWriteTask(task) || routeLike.taskProfile?.writeIntent === "none")
    && routeLike.taskProfile?.risk === "low"
    && !isVagueTask(task, routeLike.candidates || []);
  if ((routeLike.confidence === "low" || routeLike.needsParentChoice) && !lowRiskReadOnlyProduct) {
    reasons.push("low confidence or ambiguous route");
  }

  if (intentIds.some((id) => ["security", "review", "devops", "data-ai"].includes(id))) {
    reasons.push(`important intent: ${intentIds.find((id) => ["security", "review", "devops", "data-ai"].includes(id))}`);
  }

  if (intentIds.includes("planning") && taskKind !== "product-analysis" && /multi-agent|多代理|多智能体|当前项目|跨模块|架构|迁移|执行计划|完整优化|持续迭代/i.test(cleaned)) {
    reasons.push("important planning scope");
  }

  if (taskKind === "orchestration-design" && /调度|router|routing|fallback|quality gate|judge|goal/i.test(cleaned)) {
    reasons.push("orchestration design needs careful routing judgement");
  }
  if (taskKind === "incident-response") reasons.push("incident response requires strongest routing and execution model");

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
  const noWrite = isNoWriteTask(cleaned);
  const broadAuthorized = isExplicitBroadAuthorization(cleaned);
  const taskKind = routeLike.taskKind || classifyTaskKind(task, routeLike);
  const writeIntent = !noWrite && /fix|implement|build|create|edit|update|refactor|optimi[sz]e|improve|iterate|execute|maintain|refresh|enhance|修复|修|实现|创建|修改|改|写|补齐|重构|优化|完善|增强|迭代|执行|维护|刷新/i.test(cleaned)
    ? "expected"
    : /review|audit|analy[sz]e|审查|审计|分析|调研|检查/i.test(cleaned)
      ? "none"
      : "possible";

  let risk = "low";
  let complexity = "low";
  let scope = "local";

  const highRisk = /security|auth|permission|secret|privacy|production|incident|migration|data loss|安全|鉴权|权限|隐私|生产|事故|迁移|数据丢失/i.test(cleaned)
    || (loadStrategyConfig().highRiskRules || DEFAULT_HIGH_RISK_RULES).some((rule) => rule.pattern && new RegExp(rule.pattern, "i").test(cleaned));
  const crossSystem = /microservice|distributed|integration|cross[- ]?module|multiple|全局|跨模块|多服务|分布式|集成/i.test(cleaned);
  const broadPlan = /plan|architecture|roadmap|multi-agent|multiple subagents|orchestrat|执行计划|架构|规划|多代理|多智能体|多个子代理|完整优化|持续迭代/i.test(cleaned);

  if (highRisk) {
    risk = /production|incident|data loss|生产|事故|数据丢失/i.test(cleaned) ? "critical" : "high";
    signals.push("high-risk domain signal");
  }
  if (routeLike.confidence === "low" || routeLike.needsParentChoice) {
    risk = risk === "critical" ? "critical" : "medium";
    scope = "unknown";
    signals.push("low routing confidence");
  }
  if (broadAuthorized) {
    risk = risk === "critical" ? "critical" : "high";
    scope = crossSystem ? "cross-system" : "subsystem";
    signals.push("explicit broad project authorization");
  }
  if (taskKind === "orchestration-design") {
    complexity = /完整|全面|持续迭代|跨模块|全方面|项目|仓库/i.test(cleaned) ? "high" : "medium";
    scope = isProjectScopeTask(task) ? "subsystem" : "local";
    if (/实现|执行|持续迭代|优化|完善/i.test(cleaned) && !noWrite) {
      risk = risk === "critical" ? "critical" : "high";
      signals.push("orchestration design with implementation intent");
    } else {
      signals.push("orchestration design task");
    }
  }
  if (taskKind === "product-analysis") {
    risk = highRisk ? risk : "low";
    complexity = /全局|全面|cross|多个|多团队|跨团队/i.test(cleaned) ? "medium" : "low";
    scope = isProjectScopeTask(task) ? "subsystem" : "local";
    signals.push("product analysis task");
  }
  if (taskKind === "research-only") {
    risk = highRisk ? risk : "low";
    complexity = /跨模块|全局|系统|architecture|架构|多个/i.test(cleaned) ? "medium" : "low";
    scope = isProjectScopeTask(task) ? "subsystem" : "local";
    signals.push("research-only read path");
  }
  if (taskKind === "release-publishing") {
    risk = highRisk ? risk : "low";
    complexity = /公开|public|release|发布|github/i.test(cleaned) ? "medium" : "low";
    scope = isProjectScopeTask(task) ? "subsystem" : "local";
    signals.push("release or documentation publishing task");
  }
  if (taskKind === "repo-maintenance") {
    risk = highRisk ? risk : "medium";
    complexity = /全局|全部|router|config|配置|缓存|registry|snapshot|持续|全面/i.test(cleaned) ? "medium" : "low";
    scope = isProjectScopeTask(task) ? "subsystem" : "local";
    signals.push("repository maintenance task");
  }
  if (taskKind === "incident-response") {
    risk = "critical";
    complexity = /跨服务|分布式|多服务|数据库|回滚|rollback|数据/i.test(cleaned) ? "high" : "medium";
    scope = /系统|全局|多服务|跨服务|分布式/i.test(cleaned) ? "cross-system" : "subsystem";
    signals.push("incident response task");
  }
  if (intentIds.some((id) => ["security", "review", "devops", "data-ai"].includes(id))) {
    risk = risk === "critical" ? "critical" : "high";
    signals.push(`important intent: ${intentIds.find((id) => ["security", "review", "devops", "data-ai"].includes(id))}`);
  }

  if (crossSystem || broadPlan || broadAuthorized) {
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

  const finalWriteIntent = ["product-analysis", "research-only"].includes(taskKind) || noWrite ? "none" : writeIntent;
  return { taskKind, complexity, risk, scope, writeIntent: finalWriteIntent, signals: unique(signals) };
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
  const noWrite = isNoWriteTask(task) || taskProfile.writeIntent === "none";
  const lowRiskReadOnlyJudge =
    !volatileContext &&
    !isVagueTask(task, route.candidates || []) &&
    taskProfile.risk === "low" &&
    noWrite &&
    (
      taskProfile.taskKind === "product-analysis" ||
      route.matchedIntents?.some((intent) => ["docs", "research", "planning"].includes(intent.id))
    );
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
  } else if (!options.forceModel && lowRiskReadOnlyJudge && ["economy", "balanced"].includes(budget)) {
    judgeMode = budget === "economy" ? "mini-judge" : "standard-judge";
    judgeModel = budget === "economy" ? "gpt-5.4-mini" : "gpt-5.4";
    reasons.push("low-risk read-only planning/product/docs route avoids GPT-5.5 judge");
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
  const stableSkillNames = skillCandidates
    .map((skill) => skill.name)
    .filter(Boolean)
    .sort()
    .slice(0, Math.min(12, skillCandidates.length));
  const payload = {
    routerMetadataVersion: 11,
    task: cleanTask(task),
    budget: policy.budget,
    judgeMode: policy.judgeMode,
    judgeModel: policy.judgeModel,
    taskKind: route.taskProfile?.taskKind || route.taskKind || "unknown",
    matchedIntents: (route.matchedIntents || []).map((intent) => intent.id).sort(),
    recommended: route.recommended?.name || "",
    strategyVersion: route.strategyConfig?.version || 0,
    registryCount: registry.count || registry.agents?.length || 0,
    communitySkillCount: community.count || 0,
    stableSkillNames,
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

function readJsonCache(file, empty = { version: 1, entries: {}, stats: {} }) {
  try {
    const cache = JSON.parse(readText(file));
    return cache && typeof cache === "object" ? { ...empty, ...cache, entries: cache.entries || {}, stats: cache.stats || {} } : empty;
  } catch {
    if (fs.existsSync(file)) {
      const quarantinePath = `${file}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(file, quarantinePath);
      } catch {
        // Best-effort quarantine only.
      }
    }
    return empty;
  }
}

function writeRouteCache(cache) {
  fs.mkdirSync(path.dirname(ROUTE_CACHE_PATH), { recursive: true });
  const maxEntries = loadStrategyConfig().costPolicy?.cache?.routeMaxEntries || DEFAULT_COST_POLICY.cache.routeMaxEntries;
  const entries = Object.entries(cache.entries || {})
    .sort((a, b) => (b[1].createdAt || "").localeCompare(a[1].createdAt || ""))
    .slice(0, maxEntries);
  fs.writeFileSync(ROUTE_CACHE_PATH, `${JSON.stringify({ version: 1, entries: Object.fromEntries(entries), stats: cache.stats || {} }, null, 2)}\n`);
}

function routeCacheStats() {
  const cache = readJsonCache(ROUTE_CACHE_PATH);
  const entries = Object.values(cache.entries || {});
  const stats = cache.stats || {};
  const hit = stats.hit || 0;
  const miss = stats.miss || 0;
  return {
    path: ROUTE_CACHE_PATH,
    entries: entries.length,
    hit,
    miss,
    hitRate: hit + miss ? Number(((hit / (hit + miss)) * 100).toFixed(2)) : 0,
    bypassReasons: stats.bypassReasons || {},
    corruptedQuarantineCount: fs.existsSync(path.dirname(ROUTE_CACHE_PATH))
      ? fs.readdirSync(path.dirname(ROUTE_CACHE_PATH)).filter((name) => name.startsWith(path.basename(ROUTE_CACHE_PATH)) && name.includes(".corrupt-")).length
      : 0,
    oldest: entries.map((entry) => entry.createdAt).filter(Boolean).sort()[0] || null,
    newest: entries.map((entry) => entry.createdAt).filter(Boolean).sort().at(-1) || null,
  };
}

function routeCacheEligibility(task, options = {}, taskKind = "") {
  if (options.noRouteCache) return { eligible: false, reason: "explicit noRouteCache" };
  if (hasVolatileContext(task)) return { eligible: false, reason: "volatile current-context task" };
  if (/security|auth|permission|secret|privacy|production|incident|outage|rollback|当前\s*diff|安全|鉴权|权限|隐私|生产|事故|故障|回滚/i.test(cleanTask(task))) {
    return { eligible: false, reason: "high-risk or incident signal" };
  }
  const stableKinds = loadStrategyConfig().costPolicy?.cache?.stableRouteKinds || DEFAULT_COST_POLICY.cache.stableRouteKinds;
  if (taskKind && !stableKinds.includes(taskKind)) return { eligible: false, reason: `taskKind ${taskKind} is not route-cache stable` };
  return { eligible: true, reason: "" };
}

function routeCacheKeyFor(task, candidateLimit, strategyVersion, taskKind) {
  return crypto.createHash("sha256").update(JSON.stringify({
    routerMetadataVersion: 1301,
    task: cleanTask(task),
    candidateLimit,
    strategyVersion,
    taskKind,
  })).digest("hex");
}

function getPersistentRouteCache(key) {
  const cache = readJsonCache(ROUTE_CACHE_PATH);
  const entry = cache.entries?.[key];
  cache.stats ||= {};
  if (entry?.route) {
    cache.stats.hit = (cache.stats.hit || 0) + 1;
    writeRouteCache(cache);
    return { ...entry.route, routeCache: { hit: true, key, createdAt: entry.createdAt, eligible: true } };
  }
  cache.stats.miss = (cache.stats.miss || 0) + 1;
  writeRouteCache(cache);
  return null;
}

function putPersistentRouteCache(key, route) {
  const cache = readJsonCache(ROUTE_CACHE_PATH);
  cache.entries ||= {};
  cache.entries[key] = {
    createdAt: new Date().toISOString(),
    route: { ...route, routeCache: { hit: false, key, eligible: true } },
  };
  writeRouteCache(cache);
}

function recordRouteCacheBypass(reason) {
  const cache = readJsonCache(ROUTE_CACHE_PATH);
  cache.stats ||= {};
  cache.stats.bypassReasons ||= {};
  cache.stats.bypassReasons[reason || "unknown"] = (cache.stats.bypassReasons[reason || "unknown"] || 0) + 1;
  writeRouteCache(cache);
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
  const broadAuthorized = isExplicitBroadAuthorization(task);
  const noWrite = isNoWriteTask(task);
  const taskKind = taskProfile.taskKind || classifyTaskKind(task, routeLike);
  let requiresReview = ["high", "critical"].includes(taskProfile.risk)
    || (taskProfile.complexity === "high" && taskProfile.writeIntent === "expected")
    || broadAuthorized
    || routeLike.matchedIntents?.some((intent) => intent.id === "review" || intent.id === "security");
  if (["product-analysis", "engineering-analysis", "orchestration-design", "research-only"].includes(taskKind) && noWrite) requiresReview = requiresReview || !["product-analysis", "research-only"].includes(taskKind);
  if (taskKind === "incident-response") requiresReview = true;
  const requiresTests = !["product-analysis", "research-only"].includes(taskKind)
    && (
      (!noWrite && (taskProfile.writeIntent === "expected" || broadAuthorized))
      || (!noWrite && routeLike.matchedIntents?.some((intent) => intent.id === "testing" || intent.id === "debug"))
    );
  const requiresUserClarification = !broadAuthorized && (routeLike.confidence === "low" || routeLike.needsParentChoice);
  const parallelizable = taskProfile.complexity === "high" && !requiresUserClarification;

  if (requiresUserClarification) {
    mode = "clarify-first";
    stages.push("Ask one concise clarification question before spawning subagents.");
  } else if (taskKind === "product-analysis") {
    mode = taskProfile.complexity === "medium" ? "staged" : "single-agent";
    stages.push("Product-focused agent frames the user problem, success signal, and tradeoffs.");
    if (mode === "staged") stages.push("Research or analysis agent validates assumptions before recommendations.");
    if (requiresReview) stages.push("Reviewer checks that recommendations stay grounded and scoped.");
  } else if (taskKind === "orchestration-design") {
    mode = "staged";
    stages.push("Mapper captures current routing, skill, model, cache, and handoff behavior.");
    stages.push("Architecture specialist identifies scheduling and delegation failure modes.");
    stages.push("Planner proposes concrete goal stages, acceptance criteria, and eval coverage.");
    if (requiresTests) stages.push("Test agent defines or runs validation for routing and goal execution behavior.");
      if (requiresReview) stages.push("Reviewer checks quality gates, fallback safety, and user-facing behavior.");
  } else if (taskKind === "research-only") {
    mode = taskProfile.complexity === "medium" ? "staged" : "single-agent";
    stages.push("Read-only researcher gathers official or repository-grounded evidence.");
    if (mode === "staged") stages.push("Reviewer verifies the findings stay source-backed and do not imply edits.");
  } else if (taskKind === "release-publishing") {
    mode = taskProfile.complexity === "medium" || routeLike.matchedIntents?.some((intent) => intent.id === "github") ? "staged" : "single-agent";
    stages.push("Documentation agent updates or prepares release-facing copy and install guidance.");
    if (requiresReview) stages.push("Reviewer checks public repository hygiene, clarity, and attribution.");
  } else if (taskKind === "repo-maintenance") {
    mode = taskProfile.writeIntent === "expected" ? "staged" : "single-agent";
    stages.push("Maintenance agent checks config, cache, registry, and repository health.");
    if (taskProfile.writeIntent === "expected") stages.push("Worker applies scoped maintenance changes.");
    if (requiresTests) stages.push("Run focused validation for changed maintenance behavior.");
  } else if (taskKind === "incident-response") {
    mode = "staged";
    stages.push("Incident mapper captures logs, blast radius, and rollback constraints without writing.");
    if (taskProfile.writeIntent === "expected") stages.push("Worker implements the smallest safe mitigation inside declared boundaries.");
    else stages.push("Incident specialist proposes containment, diagnosis, and rollback options.");
    stages.push("Validation agent proves mitigation or diagnosis against the observed incident signal.");
    stages.push("Reviewer checks production, auth, data, and rollback safety before final handoff.");
  } else if (taskProfile.complexity === "high" || broadAuthorized || /执行计划|implement this plan|multi-agent|multiple subagents|多代理|多智能体|多个子代理/i.test(task)) {
    mode = "staged";
    stages.push("Explorer maps scope, ownership boundaries, and likely risks.");
    if (noWrite || taskProfile.writeIntent === "none") {
      stages.push("Read-only specialist analyzes findings and hands scoped recommendations back to the parent.");
    } else {
      stages.push("Worker implements the scoped change with selected skills.");
    }
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

function writableSandboxFor(role, fallback = "workspace-write") {
  if (role === "worker") return fallback === "read-only" ? "workspace-write" : fallback;
  return "read-only";
}

function clarificationQuestionFor(task, routeLike) {
  const intents = routeLike.matchedIntents?.map((intent) => intent.id).join(", ") || "unknown";
  return `请补充这次子代理任务的目标范围、相关文件/模块或失败现象；当前只识别到 ${intents}，不足以安全派发。`;
}

function buildParentReviewHandoffPlan(task, reason = "routing fallback requires parent review") {
  const stage = {
    id: "parent-review",
    agent: "parent-codex",
    role: "explorer",
    sandboxMode: "read-only",
    selectedModel: "gpt-5.5",
    reasoningEffort: "high",
    skills: [],
    input: task,
    expectedOutput: "Inspect fallback metadata before any subagent delegation.",
    acceptanceCriteria: [
      "Parent Codex explicitly reviews fallback reason and safety.",
      "No write-capable subagent is spawned from this fallback result.",
      "The route is retried or manually approved before execution.",
    ],
  };
  return {
    mode: "parent-review-required",
    clarificationQuestion: reason,
    stages: [stage],
  };
}

function buildHandoffPlan(task, routeLike, taskProfile, executionPlan, skillsByPhase) {
  const agentName = routeLike.recommended?.name || "selected-agent";
  const modelPolicy = routeLike.modelPolicy || computeModelPolicy(task, routeLike.recommended, routeLike);
  const noWrite = isNoWriteTask(task) || taskProfile.writeIntent === "none";
  const taskKind = taskProfile.taskKind || classifyTaskKind(task, routeLike);
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
    if (taskKind === "product-analysis") {
      stages.push(baseStage("research", "research-analyst", "explorer", "read-only", ["planning", "research"], "Gather product/user evidence and constraints before recommendations.", ["Assumptions are explicit.", "No implementation work is implied."]));
      stages.push(baseStage("synthesize", agentName, "explorer", "read-only", ["planning", "review"], "Synthesize product recommendation, tradeoffs, and success signals.", ["Recommendation is scoped.", "Success criteria are measurable."]));
    } else if (taskKind === "research-only") {
      stages.push(baseStage("research", agentName, "explorer", "read-only", ["planning", "research"], "Gather source-backed evidence without editing code.", ["Sources or inspected files are named.", "No implementation work is implied."]));
      if (executionPlan.requiresReview) stages.push(baseStage("review", "reviewer", "explorer", "read-only", ["review"], "Verify that research conclusions are grounded and scoped.", ["Findings are evidence-based.", "No write-capable handoff is hidden."]));
    } else if (taskKind === "release-publishing") {
      stages.push(baseStage("prepare-release-docs", agentName, noWrite ? "explorer" : "worker", noWrite ? "read-only" : "workspace-write", ["planning", "research", "review", "deployment"], "Prepare release-facing documentation, README, changelog, or publishing guidance.", ["Public-facing text is clear.", "References and attribution are preserved."]));
      stages.push(baseStage("public-hygiene-review", "reviewer", "explorer", "read-only", ["review"], "Review public repository hygiene before publishing.", ["No obvious secrets or unnecessary local paths are introduced.", "Install and verification steps are coherent."]));
    } else if (taskKind === "repo-maintenance") {
      stages.push(baseStage("inspect-maintenance-surface", "code-mapper", "explorer", "read-only", ["planning", "research"], "Inspect config, cache, snapshots, registry, and report surfaces.", ["Maintenance surface is bounded.", "Risky generated files are named."]));
      if (!noWrite && taskProfile.writeIntent === "expected") stages.push(baseStage("maintain", agentName, "worker", "workspace-write", ["implementation", "testing"], "Apply scoped repository maintenance changes.", ["Changes stay inside maintenance scope.", "Recovery path remains available."]));
    } else if (taskKind === "incident-response") {
      stages.push(baseStage("map-incident", "sre-engineer", "explorer", "read-only", ["planning", "research", "debugging"], "Map observed production incident signals, blast radius, and rollback constraints.", ["Incident signal and affected subsystem are named.", "No write occurs before scope is known."]));
      if (!noWrite && taskProfile.writeIntent === "expected") stages.push(baseStage("mitigate", agentName, "worker", "workspace-write", ["implementation", "debugging"], "Implement the smallest scoped mitigation or rollback-support change.", ["Write scope is bounded to the affected subsystem.", "Rollback or mitigation rationale is documented."]));
      else stages.push(baseStage("diagnose", agentName, "explorer", "read-only", ["debugging", "review"], "Produce containment, diagnosis, and rollback recommendations.", ["Recommendations are ordered by safety.", "No write-capable action is implied."]));
    } else if (taskKind === "orchestration-design") {
      stages.push(baseStage("map-current", "code-mapper", "explorer", "read-only", ["planning", "research", "design"], "Map current router, skill, cache, judge, and handoff behavior.", ["Current control flow and key risk boundaries are named.", "No writes occur during mapping."]));
      stages.push(baseStage("identify-failures", "architect-reviewer", "explorer", "read-only", ["planning", "review"], "Identify scheduling, routing, fallback, and UX failure modes.", ["Findings are tied to router behavior.", "Risks are prioritized."]));
      if (!noWrite && taskProfile.writeIntent === "expected") {
        stages.push(baseStage("implement", agentName, "worker", "workspace-write", ["implementation", "debugging"], "Implement the scoped orchestration improvement.", ["Changed files match the scoped router boundary.", "No unrelated user changes are overwritten."]));
      } else {
        stages.push(baseStage("propose-strategy", agentName, "explorer", "read-only", ["planning", "research", "review"], "Propose concrete strategy, goal stages, and acceptance criteria.", ["Plan is decision-complete.", "Execution risks and tests are named."]));
      }
    } else {
      stages.push(baseStage("explore", "code-mapper", "explorer", "read-only", ["planning", "research", "design"], "Map scope, risks, ownership boundaries, and implementation order.", ["Affected subsystems and risky files are named.", "Worker scope is bounded."]));
      const primaryRole = routeLike.recommended?.runtimeRole || "worker";
      if (primaryRole === "worker" && !noWrite) {
        stages.push(baseStage("implement", agentName, "worker", writableSandboxFor("worker", routeLike.recommended?.sandboxMode || "workspace-write"), ["implementation", "debugging"], "Implement the scoped change without touching unrelated files.", ["Changed files match the scoped boundary.", "No unrelated user changes are overwritten."]));
      } else {
        stages.push(baseStage("analyze", agentName, primaryRole, "read-only", ["planning", "research", "review"], "Analyze the scoped change and hand implementation back to the parent.", ["No write-capable work is implied by a read-only agent.", "Findings are specific enough for a worker handoff if needed."]));
      }
    }
  } else {
    if (taskKind === "product-analysis") {
      stages.push(baseStage("primary", agentName, "explorer", "read-only", ["planning", "research", "review"], "Complete the selected product analysis task.", ["Recommendation is grounded in user outcome.", "No implementation work is implied."]));
    } else if (taskKind === "research-only") {
      stages.push(baseStage("primary", agentName, "explorer", "read-only", ["planning", "research", "review"], "Complete the selected read-only research task.", ["Findings cite inspected sources or docs.", "No implementation work is implied."]));
    } else {
      stages.push(baseStage("primary", agentName, routeLike.recommended?.runtimeRole || "worker", routeLike.recommended?.sandboxMode || "workspace-write", ["planning", "research", "implementation", "debugging", "review"], "Complete the selected subagent task.", ["Result matches the user request.", "Residual risk is reported."]));
    }
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
  const taskKind = route.taskProfile?.taskKind || route.taskKind || "unknown";
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
  if (["product-analysis", "research-only"].includes(taskKind)) {
    const selected = Object.values(route.selectedSkillsByPhase || {}).flat();
    gates.push({ id: "task-kind-skill-alignment", passed: !(route.selectedSkillsByPhase?.implementation || []).length && !(route.selectedSkillsByPhase?.debugging || []).length, reason: `${taskKind} should not carry implementation/debugging stage skills by default.` });
    gates.push({ id: "task-kind-stage-alignment", passed: route.executionPlan?.mode !== "staged" || !route.executionPlan?.stages?.some((stage) => /implement|worker implements/i.test(stage)), reason: `${taskKind} should not generate implementation stages.` });
    if (!selected.length) gates.push({ id: "task-kind-skill-coverage", passed: true, reason: `No ${taskKind} skills were selected; route remains safe and read-only.` });
  }
  if (taskKind === "incident-response") {
    gates.push({ id: "incident-gpt55-gate", passed: judgePolicy.judgeModel === "gpt-5.5", reason: "Incident response requires GPT-5.5 judgement." });
    gates.push({ id: "incident-stage-gate", passed: route.executionPlan?.mode === "staged", reason: "Incident response should use staged mapping, mitigation/diagnosis, validation, and review." });
  }
  if (taskKind === "engineering-execution") {
    gates.push({ id: "task-kind-stage-alignment", passed: route.executionPlan?.requiresTests === true, reason: "Engineering execution should include a validation path." });
  }
  return gates;
}

function rejectedCandidatesFor(route, selectedAgentName = route.recommended?.name) {
  const selected = selectedAgentName || route.recommended?.name;
  const selectedCandidate = route.candidates?.find((candidate) => candidate.name === selected) || route.recommended || {};
  return (route.candidates || [])
    .filter((candidate) => candidate.name !== selected)
    .slice(0, 5)
    .map((candidate) => ({
      name: candidate.name,
      score: candidate.score,
      reason: candidate.sandboxMode !== selectedCandidate.sandboxMode
        ? `lower score and sandbox ${candidate.sandboxMode} differs from selected ${selectedCandidate.sandboxMode}`
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
  let executionPlan = {
    ...(result.executionPlan || route.executionPlan),
    selectedSkillsByPhase: skillsByPhase,
  };
  let handoffPlan = buildHandoffPlan(result.task || route.task, {
    ...route,
    recommended: route.candidates?.find((candidate) => candidate.name === result.finalAgent) || route.recommended,
    modelPolicy: {
      importanceLevel: result.importanceLevel,
      selectedModel: result.selectedModel,
      reasoningEffort: result.reasoningEffort,
      modelRationale: result.modelRationale,
    },
  }, result.taskProfile || route.taskProfile, executionPlan, skillsByPhase);
  const delegationBlocked = Boolean(fallbackMeta.requiresParentReview);
  const approvalState = delegationBlocked ? "required" : "not-required";
  if (delegationBlocked) {
    handoffPlan = buildParentReviewHandoffPlan(result.task || route.task, fallbackMeta.fallbackReason || "fallback requires parent review");
    executionPlan = {
      ...executionPlan,
      mode: "parent-review-required",
      requiresUserClarification: true,
      stages: ["Parent Codex reviews fallback metadata before any subagent delegation."],
    };
  }
  const enrichedExecutionPlan = {
    ...executionPlan,
    stageDetails: handoffPlan.stages,
    clarificationQuestion: handoffPlan.clarificationQuestion,
  };
  const agentRoster = result.agentRoster || route.agentRoster || buildAgentRoster(
    result.task || route.task,
    route,
    result.taskProfile || route.taskProfile,
    enrichedExecutionPlan,
  );
  return {
    ...result,
    executionPlan: enrichedExecutionPlan,
    handoffPlan,
    agentRoster,
    decisionTrace: decisionTraceFor(result.task || route.task, route, judgePolicy, result),
    qualityGates: qualityGatesFor(route, judgePolicy),
    rejectedCandidates: rejectedCandidatesFor(route, result.finalAgent),
    skillRationale: skillRationaleFor(result.selectedSkills, skillCandidates, route),
    fallbackReason: fallbackMeta.fallbackReason || "",
    failureClass: fallbackMeta.failureClass || classifyFailure(fallbackMeta.fallbackReason || ""),
    fallbackSafety: fallbackMeta.fallbackSafety || "not-fallback",
    requiresParentReview: Boolean(fallbackMeta.requiresParentReview),
    delegationBlocked,
    approvalState,
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
      phase: phaseForSkill({ name, phase: rule.phase || "implementation" }),
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

function skillRegistryByName() {
  const byName = new Map();
  for (const skill of loadSkillRegistry()) {
    byName.set(skill.name, skill);
    byName.set(String(skill.name).split(":").at(-1), skill);
  }
  return byName;
}

function phaseForSkill(entry) {
  const name = entry.name || "";
  if (name === "superpowers:executing-plans") return "implementation";
  if (/debugger|debugging|ios-debugger-agent|frontend-testing-debugging/.test(name)) return "debugging";
  if (name === "superpowers:test-driven-development" || /testing|lint-and-validate|test/i.test(name)) return "testing";
  if (/code-review|security|threat-model|review/i.test(name)) return "review";
  return entry.phase || "implementation";
}

function enrichConfiguredSkill(entry, community = loadCommunitySkillManifest()) {
  const communitySkill = community.byName.get(entry.name);
  return {
    name: entry.name,
    description: entry.description || entry.reason,
    phase: phaseForSkill(entry),
    ruleId: entry.ruleId,
    reason: entry.reason,
    confidence: entry.confidence || "medium",
    source: communitySkill?.source || entry.source || "strategy",
    flags: communitySkill?.flags || entry.flags || [],
    score: entry.score || ((entry.confidence === "high" ? 120 : 80) + (entry.priority || 0)),
  };
}

function buildSkillCandidates(task, limit = 18) {
  const community = loadCommunitySkillManifest();
  const taskKind = classifyTaskKind(task);
  const direct = skillMatches(task)
    .map((entry) => enrichConfiguredSkill(entry, community))
    .filter((entry) => shouldKeepSkillForTaskKind(entry, taskKind, task));
  if (direct.length >= limit) return direct.slice(0, limit);
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
    .filter((skill) => skill.score > 8 && !directNames.has(skill.name) && shouldKeepSkillForTaskKind({ ...skill, phase: "matched" }, taskKind, task))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, limit - direct.length))
    .map(({ name, description, score, confidence, reason, source, flags }) => ({ name, description, phase: "matched", score, confidence, reason, source, flags }));
  return [...direct, ...scanned];
}

function routeTask(task, options = {}) {
  const candidateLimit = options.candidateLimit || 3;
  const strategy = loadStrategyConfig();
  const intents = classifyIntents(task);
  const taskKind = classifyTaskKind(task, { matchedIntents: intents });
  const routeCacheKey = routeCacheKeyFor(task, candidateLimit, strategy.version, taskKind);
  const routeCacheEligibilityResult = routeCacheEligibility(task, options, taskKind);
  if (routeTaskCache.has(routeCacheKey)) return routeTaskCache.get(routeCacheKey);
  if (routeCacheEligibilityResult.eligible) {
    const cached = getPersistentRouteCache(routeCacheKey);
    if (cached) {
      routeTaskCache.set(routeCacheKey, cached);
      return cached;
    }
  } else {
    recordRouteCacheBypass(routeCacheEligibilityResult.reason);
  }
  const registry = loadRegistry();
  const ranked = registry.agents
    .map((agent) => scoreAgent(agent, task, intents))
    .sort((a, b) => b.score - a.score || a.agent.name.localeCompare(b.agent.name))
    .slice(0, Math.max(5, candidateLimit));

  let best = ranked[0]?.agent || registry.agents.find((agent) => agent.name === "code-mapper") || registry.agents[0];
  const taskKindPreferred = preferredAgentsForTaskKind(taskKind)
    .map((name) => registry.agents.find((agent) => agent.name === name))
    .filter(Boolean);
  const preferredRanked = ranked.find((entry) => taskKindPreferred.some((agent) => agent.name === entry.agent.name));
  const kindPrefersOverride = ["orchestration-design", "product-analysis", "research-only", "release-publishing", "repo-maintenance", "incident-response"].includes(taskKind);
  if (preferredRanked && kindPrefersOverride) {
    best = preferredRanked.agent;
  } else if (kindPrefersOverride && taskKindPreferred.length) {
    best = taskKindPreferred[0];
  }
  const effectiveNoWrite = isNoWriteTask(task) || (/review|audit|inspect|check|审查|审计|检查/.test(cleanTask(task)) && !/fix|implement|edit|update|refactor|修复|实现|修改|更新|重构/.test(cleanTask(task)));
  if (effectiveNoWrite && best.sandboxMode !== "read-only") {
    best = ranked.find((entry) => entry.agent.sandboxMode === "read-only")?.agent
      || taskKindPreferred.find((agent) => agent.sandboxMode === "read-only")
      || registry.agents.find((agent) => ["reviewer", "code-mapper", "docs-researcher"].includes(agent.name) && agent.sandboxMode === "read-only")
      || best;
  }
  const vagueTask = isVagueTask(task, ranked);
  let confidence = confidenceFor(ranked, intents);
  if (vagueTask) confidence = "low";
  const broadAuthorized = isExplicitBroadAuthorization(task);
  const semanticStrongKind = ["incident-response", "repo-maintenance", "research-only", "release-publishing", "orchestration-design"].includes(taskKind) && !vagueTask;
  if (semanticStrongKind && confidence === "low") confidence = "medium";
  const needsParentChoice = confidence === "low" && !broadAuthorized;
  if (broadAuthorized && confidence === "low") confidence = "medium";
  const codebaseImplied = /code|repo|project|file|diff|代码|仓库|项目|文件/.test(cleanTask(task));
  if (needsParentChoice && codebaseImplied) {
    best = registry.agents.find((agent) => agent.name === "code-mapper") || best;
  }
  let skillEntries = skillMatches(task).filter((entry) => shouldKeepSkillForTaskKind(entry, taskKind, task));
  const addConfiguredSkill = (name, phase, reason) => {
    if (!skillNameAvailable(name) || skillEntries.some((entry) => entry.name === name)) return;
    skillEntries.push({ name, ruleId: "task-kind-default", phase, priority: 70, reason, confidence: "medium" });
  };
  if (taskKind === "release-publishing" && /github|public repo|公开仓库|仓库|发布|release|readme/i.test(cleanTask(task))) {
    addConfiguredSkill("github:github", "review", "release-publishing task benefits from GitHub repository context");
  }
  if (taskKind === "orchestration-design") {
    addConfiguredSkill("superpowers:writing-plans", "planning", "orchestration-design needs explicit goal and plan shaping");
    if (/实现|执行|持续迭代|execute|implement|goal/i.test(cleanTask(task))) {
      addConfiguredSkill("superpowers:executing-plans", "implementation", "orchestration-design request includes execution intent");
      addConfiguredSkill("superpowers:subagent-driven-development", "planning", "orchestration-design request uses multi-agent delegation");
    }
  }
  if (vagueTask) {
    skillEntries = skillEntries.filter((entry) => !/debugging|failure|regression/i.test(entry.reason));
  }
  const skills = skillEntries.map((entry) => entry.name);
  const bestScore = ranked.find((entry) => entry.agent.name === best.name) || scoreAgent(best, task, intents);
  const selectedSkillsByPhase = groupSkillsByPhase(skillEntries);
  const baseRoute = {
    task,
    confidence,
    needsParentChoice,
    matchedIntents: intents.map(({ id, label, score, preferredSandbox }) => ({ id, label, score, preferredSandbox })),
    taskKind,
    recommended: summarizeAgent(best),
    scoreBreakdown: bestScore.breakdown,
    reasons: bestScore.reasons,
    candidates: ranked.slice(0, candidateLimit).map(({ agent, score, breakdown, reasons }) => ({ ...summarizeAgent(agent), score, breakdown, reasons })),
    skillMatches: skillEntries,
    selectedSkillsByPhase,
    suggestedSkills: skills,
  };
  const taskProfile = computeTaskProfile(task, baseRoute);
  const modelPolicy = computeModelPolicy(task, best, { ...baseRoute, taskProfile });
  const executionPlan = buildExecutionPlan(task, baseRoute, taskProfile, selectedSkillsByPhase);
  const agentRoster = buildAgentRoster(task, { ...baseRoute, modelPolicy }, taskProfile, executionPlan);
  const result = {
    ...baseRoute,
    strategyConfig: {
      source: strategy.source,
      loaded: strategy.configLoaded,
      version: strategy.version,
    },
    taskProfile,
    modelPolicy,
    executionPlan,
    agentRoster,
    routeCache: {
      hit: false,
      eligible: routeCacheEligibilityResult.eligible,
      bypassReason: routeCacheEligibilityResult.reason || undefined,
      key: routeCacheEligibilityResult.eligible ? routeCacheKey : undefined,
    },
    delegationPrompt: buildPrompt(best, task, skills, { confidence, needsParentChoice, intents, modelPolicy }),
  };
  routeTaskCache.set(routeCacheKey, result);
  if (routeCacheEligibilityResult.eligible) putPersistentRouteCache(routeCacheKey, result);
  return result;
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

function registryAgentByName(registry = loadRegistry()) {
  const byName = new Map();
  for (const agent of registry.agents || []) byName.set(agent.name, agent);
  return byName;
}

function summarizeRosterAgent(agent, role, reason, fallbackFor = "") {
  if (!agent) return null;
  return {
    name: agent.name,
    role,
    runtimeRole: agent.runtimeRole,
    sandboxMode: agent.sandboxMode,
    model: agent.compatibleModel || agent.model || "inherit-parent",
    category: agent.category,
    reason,
    fallbackFor,
  };
}

function firstAvailableAgent(names = [], byName = registryAgentByName()) {
  for (const name of names) {
    const agent = byName.get(name);
    if (agent) return agent;
  }
  return null;
}

function preferredAgentFallbacks(taskKind, byName = registryAgentByName()) {
  const preferred = preferredAgentsForTaskKind(taskKind);
  const missing = preferred.filter((name) => !byName.has(name));
  const firstAvailable = firstAvailableAgent(preferred, byName);
  return missing.map((name) => ({
    taskKind,
    name,
    fallback: firstAvailable?.name || "route-ranked-candidate",
    reason: `${name} is configured as preferred for ${taskKind}, but is not installed in the current registry.`,
  }));
}

function buildAgentRoster(task, routeLike, taskProfile, executionPlan) {
  const registry = loadRegistry();
  const byName = registryAgentByName(registry);
  const taskKind = taskProfile?.taskKind || routeLike.taskKind || classifyTaskKind(task, routeLike);
  const noWrite = isNoWriteTask(task) || taskProfile?.writeIntent === "none";
  const recommended = byName.get(routeLike.recommended?.name) || routeLike.recommended;
  const mapper = firstAvailableAgent(["code-mapper", "docs-researcher", "research-analyst", "reviewer"], byName) || recommended;
  const implementer = noWrite
    ? null
    : (recommended?.runtimeRole === "worker" ? recommended : firstAvailableAgent(["executor", "backend-developer", "frontend-developer", "full-stack-developer"], byName) || recommended);
  const validator = firstAvailableAgent(["test-automator", "test-engineer", "qa-engineer", "reviewer"], byName) || recommended;
  const reviewer = firstAvailableAgent(["reviewer", "code-reviewer", "architect-reviewer", "security-engineer"], byName) || recommended;
  const preferred = preferredAgentsForTaskKind(taskKind);
  const fallbackCandidates = unique([
    ...(routeLike.candidates || []).map((candidate) => candidate.name),
    ...preferred,
    mapper?.name,
    implementer?.name,
    validator?.name,
    reviewer?.name,
  ]).filter(Boolean)
    .map((name) => byName.get(name) || (routeLike.candidates || []).find((candidate) => candidate.name === name))
    .filter(Boolean)
    .filter((agent, index, agents) => agents.findIndex((item) => item.name === agent.name) === index)
    .slice(0, 8)
    .map((agent) => summarizeRosterAgent(agent, agent.runtimeRole, "available fallback candidate for this route"));
  const missingPreferredAgents = preferredAgentFallbacks(taskKind, byName);
  const warnings = unique([
    ...missingPreferredAgents.map((item) => `preferred agent unavailable: ${item.name}; fallback=${item.fallback}`),
    ...(noWrite && implementer ? [`no-write task suppresses writer ${implementer.name}`] : []),
    ...(executionPlan?.requiresReview && !reviewer ? ["review required but no reviewer-like agent was found"] : []),
  ]);
  return {
    taskKind,
    primary: summarizeRosterAgent(recommended, recommended?.runtimeRole || "worker", "top route recommendation after taskKind, intent, sandbox, and risk scoring"),
    mapper: summarizeRosterAgent(mapper, "explorer", "maps repository scope and current behavior before write-capable stages"),
    implementer: noWrite ? null : summarizeRosterAgent(implementer, "worker", "owns scoped write work when the execution plan allows implementation"),
    validator: summarizeRosterAgent(validator, validator?.runtimeRole || "worker", "runs or designs validation and test evidence"),
    reviewer: summarizeRosterAgent(reviewer, "explorer", "checks risk, regressions, public hygiene, and quality gates"),
    fallbacks: fallbackCandidates,
    missingPreferredAgents,
    warnings,
  };
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
      recommended: deterministic.recommended?.name,
      confidence: deterministic.confidence,
      needsParentChoice: deterministic.needsParentChoice,
      taskKind: deterministic.taskProfile?.taskKind || deterministic.taskKind,
      matchedIntents: (deterministic.matchedIntents || []).map((intent) => intent.id),
      reasons: deterministic.reasons,
      modelPolicy: deterministic.modelPolicy,
      taskProfile: deterministic.taskProfile,
      executionMode: deterministic.executionPlan?.mode,
      requiresReview: deterministic.executionPlan?.requiresReview,
      requiresTests: deterministic.executionPlan?.requiresTests,
      requiresUserClarification: deterministic.executionPlan?.requiresUserClarification,
      selectedSkills: deterministic.suggestedSkills,
    },
    agentCandidates: agentCandidates.map((candidate) => ({
      name: candidate.name,
      description: clampText(candidate.description, 64),
      category: candidate.category,
      runtimeRole: candidate.runtimeRole,
      sandboxMode: candidate.sandboxMode,
      compatibleModel: candidate.compatibleModel,
      score: candidate.score,
      reasons: (candidate.reasons || []).slice(0, 3),
    })),
    skillCandidates: skillCandidates.map((skill) => ({
      name: skill.name,
      reason: clampText(skill.reason, 56),
      phase: skill.phase,
      confidence: skill.confidence,
      score: skill.score,
      source: skill.source,
    })),
  };

  return `You are Codex acting only as a routing judge.

Choose the best candidate agent, exact candidate skills, execution model, and delegation shape.

Hard rules:
- Choose finalAgent only from agentCandidates.
- Choose selectedSkills only as an exact subset of skillCandidates.name strings.
- selectedSkillsByPhase may be empty; if you fill it, every listed skill must already be in selectedSkills.
- Prefer narrow specialists over generic agents when the task is specific.
- If the task is vague or lacks enough context, use confidence "low" and needsParentChoice true.
- Important work must use selectedModel "gpt-5.5": security, auth, privacy, compliance, architecture, production, incident, migration, cross-system changes, high-risk review, ambiguous tasks, and multi-agent coordination.
- Routine scoped implementation may use "gpt-5.4".
- Simple low-risk docs, formatting, or narrow chores may use "gpt-5.4-mini".
- Do not downgrade deterministic.modelPolicy when it marks importanceLevel "critical".
- Preserve clarify-first mode when deterministic.requiresUserClarification is true.
- Use explorer/read-only for review/audit/research/analysis; worker/workspace-write for edits/fixes/tests.
- Keep rationale short and operational.
- Respect judgePolicy: it controls judge cost only, never lower the execution model below task risk.
- Return judgeMode, judgeModel, costRationale, and candidateBudget exactly from judgePolicy.

Return JSON that matches the provided schema.

Routing packet:
${JSON.stringify(packet)}`;
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

function repairSelectedSkills(judgement, route, skillCandidates) {
  const candidateByName = new Map(skillCandidates.map((skill) => [skill.name, skill]));
  const configuredByName = new Map(skillMatches(route.task).map((skill) => [skill.name, skill]));
  const registryByName = skillRegistryByName();
  const repaired = [];
  const warnings = [];

  for (const skill of judgement.selectedSkills || []) {
    if (candidateByName.has(skill)) {
      repaired.push(skill);
      continue;
    }
    const configured = configuredByName.get(skill);
    const localSkill = registryByName.get(skill) || registryByName.get(String(skill).split(":").at(-1));
    if (configured && localSkill) {
      const enriched = enrichConfiguredSkill({
        ...configured,
        description: localSkill.description || configured.reason,
      });
      skillCandidates.push(enriched);
      candidateByName.set(skill, enriched);
      repaired.push(skill);
      warnings.push(`model selected configured skill outside initial candidate budget; repaired: ${skill}`);
      continue;
    }
    throw new Error(`model selected non-candidate skill: ${skill}`);
  }

  judgement.selectedSkills = unique(repaired);
  judgement.routingWarnings = unique([...(judgement.routingWarnings || []), ...warnings]);
  return { judgement, skillCandidates };
}

function projectSelectedSkillsByPhase(selectedSkills, skillCandidates) {
  const candidateByName = new Map(skillCandidates.map((skill) => [skill.name, skill]));
  const groups = completeSkillPhases();
  for (const skillName of selectedSkills || []) {
    const phase = candidateByName.get(skillName)?.phase || "selected";
    groups[phase] ||= [];
    groups[phase].push(skillName);
  }
  return completeSkillPhases(groups);
}

function validateJudgement(judgement, route, skillCandidates) {
  const candidateNames = new Set(route.candidates.map((candidate) => candidate.name));
  if (!candidateNames.has(judgement.finalAgent)) {
    throw new Error(`model selected non-candidate agent: ${judgement.finalAgent}`);
  }
  ({ judgement, skillCandidates } = repairSelectedSkills(judgement, route, skillCandidates));
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
  judgement.selectedSkillsByPhase = projectSelectedSkillsByPhase(judgement.selectedSkills, skillCandidates);
  return { judgement, agent };
}

function runModelJudgement(task, options = {}) {
  const initialRoute = routeTask(task, { candidateLimit: options.candidateLimit || 8 });
  const judgePolicy = computeJudgePolicy(task, initialRoute, options);
  const route = initialRoute.candidates.length <= judgePolicy.candidateBudget.agents
    ? initialRoute
    : {
      ...initialRoute,
      candidates: initialRoute.candidates.slice(0, judgePolicy.candidateBudget.agents),
    };
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
      routingWarnings: judgement.routingWarnings,
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

function compactJudgementResult(result) {
  return {
    task: result.task,
    finalAgent: result.finalAgent,
    runtimeRole: result.runtimeRole,
    sandboxMode: result.sandboxMode,
    selectedModel: result.selectedModel,
    reasoningEffort: result.reasoningEffort,
    importanceLevel: result.importanceLevel,
    judgeMode: result.judgeMode,
    judgeModel: result.judgeModel,
    modelUsed: result.modelUsed,
    confidence: result.confidence,
    needsParentChoice: result.needsParentChoice,
    cache: result.cache,
    taskProfile: result.taskProfile,
    agentRoster: result.agentRoster,
    executionPlan: {
      mode: result.executionPlan?.mode,
      requiresReview: result.executionPlan?.requiresReview,
      requiresTests: result.executionPlan?.requiresTests,
      requiresUserClarification: result.executionPlan?.requiresUserClarification,
      stages: (result.executionPlan?.stageDetails || result.handoffPlan?.stages || []).map((stage) => ({
        id: stage.id,
        agent: stage.agent,
        role: stage.role,
        sandboxMode: stage.sandboxMode,
        selectedModel: stage.selectedModel,
        reasoningEffort: stage.reasoningEffort,
        skills: stage.skills,
      })),
      clarificationQuestion: result.executionPlan?.clarificationQuestion || result.handoffPlan?.clarificationQuestion || "",
    },
    selectedSkills: result.selectedSkills,
    selectedSkillsByPhase: result.selectedSkillsByPhase,
    costRationale: result.costRationale,
    modelRationale: result.modelRationale,
    rationale: result.rationale,
    qualityGates: result.qualityGates,
    routingWarnings: result.routingWarnings,
    fallbackSafety: result.fallbackSafety,
    failureClass: result.failureClass,
    requiresParentReview: result.requiresParentReview,
    delegationBlocked: result.delegationBlocked,
    approvalState: result.approvalState,
  };
}

function managedDelegationPlan(result) {
  const stageDetails = result.executionPlan?.stageDetails || result.handoffPlan?.stages || [];
  const selectedSkills = result.selectedSkills || [];
  const asksNow = Boolean(result.executionPlan?.requiresUserClarification || result.needsParentChoice || result.delegationBlocked);
  const profile = {
    ...(result.deterministic?.taskProfile || {}),
    ...(result.taskProfile || {}),
  };
  if (!profile.taskKind || profile.taskKind === "unknown") {
    profile.taskKind = result.deterministic?.taskProfile?.taskKind || "unknown";
  }
  const writerStages = stageDetails.filter((stage) => stage.role === "worker" && stage.sandboxMode !== "read-only");
  const writeBoundaries = {
    policy: writerStages.length > 1
      ? "multiple writer-capable stages require sequential ownership; only one writer may own a file or module at a time"
      : "single writer owns scoped files/modules; review and validation remain read-only or verification-focused unless explicitly scoped",
    allowedWriters: writerStages.map((stage) => ({ stage: stage.id, agent: stage.agent, scope: "bounded to affected subsystem or files discovered by earlier mapping stage" })),
    readOnlyStages: stageDetails.filter((stage) => stage.role !== "worker" || stage.sandboxMode === "read-only").map((stage) => stage.id),
    conflictAvoidance: [
      "Do not run two write-capable agents on the same file/module concurrently.",
      "Mapping, research, review, and public-hygiene stages do not modify files.",
      "Parent Codex resolves boundary conflicts before continuing to the next writer stage.",
    ],
  };
  const stageInputs = Object.fromEntries(stageDetails.map((stage, index) => [
    stage.id,
    index === 0
      ? ["Original user task", "Current repository state", "Applicable AGENTS.md and selected skills"]
      : [`Output and acceptance evidence from stage ${index}: ${stageDetails[index - 1].id}`, "Current repository state after prior stage"],
  ]));
  const stageOutputs = Object.fromEntries(stageDetails.map((stage) => [
    stage.id,
    stage.expectedOutput || "Stage result, validation evidence, and residual risk",
  ]));
  const readinessState = result.delegationBlocked
    ? "parent-review-required"
    : asksNow
      ? "clarify-first"
      : "ready";
  const firstExecutableStage = stageDetails.find((stage) => stage.id !== "clarify" && stage.id !== "parent-review") || stageDetails[0];
  const nextAction = readinessState === "clarify-first"
    ? {
      type: "ask-clarification",
      question: result.executionPlan?.clarificationQuestion || result.handoffPlan?.clarificationQuestion || "请补充一个关键范围或目标。",
    }
    : readinessState === "parent-review-required"
      ? {
        type: "parent-review",
        stageId: "parent-review",
        reason: result.fallbackReason || "routing requires parent review before delegation",
      }
      : {
        type: "spawn",
        stageId: firstExecutableStage?.id || "primary",
        agent: firstExecutableStage?.agent || result.finalAgent,
        role: firstExecutableStage?.role || result.runtimeRole,
        sandboxMode: firstExecutableStage?.sandboxMode || result.sandboxMode,
        skillsToLoad: firstExecutableStage?.skills || selectedSkills,
      };
  const stageSkillLoadingOrder = stageDetails.map((stage) => ({
    stageId: stage.id,
    agent: stage.agent,
    loadBeforeStage: (stage.skills || []).filter((skill, index, skills) => skills.indexOf(skill) === index),
  }));
  return {
    mode: result.executionPlan?.mode || "single-agent",
    agent: result.finalAgent,
    role: result.runtimeRole,
    sandboxMode: result.sandboxMode,
    model: result.selectedModel,
    reasoningEffort: result.reasoningEffort,
    skills: selectedSkills,
    agentRoster: result.agentRoster,
    delegationReadiness: {
      state: readinessState,
      reason: readinessState === "ready"
        ? "route has enough scope, no parent choice is required, and no safety fallback is active"
        : readinessState === "clarify-first"
          ? "one missing scope detail blocks safe autonomous delegation"
          : "fallback or high-risk route requires parent Codex review before spawning",
      canSpawnNow: readinessState === "ready",
    },
    nextAction,
    stageSkillLoadingOrder,
    userSummary: {
      whyThisAgent: `${result.finalAgent} matches the task shape and can operate as ${result.runtimeRole}.`,
      whyNoQuestionNow: asksNow
        ? "One clarification or parent review is needed before autonomous delegation."
        : "The task has enough scope and the route is confident enough to proceed without interrupting you.",
      whenCodexWillAsk: "Codex asks only for destructive actions, credentials, production changes, or if one missing detail blocks safe delegation.",
    },
    clarificationQuestion: asksNow ? (result.executionPlan?.clarificationQuestion || result.handoffPlan?.clarificationQuestion || "请补充一个关键范围或目标，以便安全派发子代理。") : "",
    executionContract: {
      taskKind: profile.taskKind || "unknown",
      risk: profile.risk || "unknown",
      writeIntent: profile.writeIntent || "possible",
      mustValidate: Boolean(result.executionPlan?.requiresTests),
      mustReview: Boolean(result.executionPlan?.requiresReview),
      maxClarifyingQuestions: loadStrategyConfig().managedUX?.maxClarifyingQuestions ?? 1,
      fallbackBehavior: result.delegationBlocked ? "parent-review-required before any spawn" : "proceed stage-by-stage while preserving boundaries",
    },
    writeBoundaries,
    parentResponsibilities: [
      "Load only the selected skills needed for the current stage.",
      "Keep final integration, user-facing summary, and verification evidence in the parent Codex.",
      "Stop or switch to parent review for destructive, credential-gated, production, or unclear write actions.",
      "Check repository status before writing and do not overwrite unrelated user changes.",
    ],
    stageInputs,
    stageOutputs,
    goalLoop: stageDetails.map((stage, index) => ({
      goal: `Stage ${index + 1}: ${stage.id}`,
      agent: stage.agent,
      role: stage.role,
      sandboxMode: stage.sandboxMode,
      model: stage.selectedModel,
      skills: stage.skills || [],
      acceptance: stage.acceptanceCriteria || [],
      nextTrigger: index === stageDetails.length - 1 ? "finish and summarize evidence" : `complete ${stage.id} acceptance criteria`,
    })),
  };
}

function printManagedDelegation(result, mode = "text") {
  const plan = managedDelegationPlan(result);
  if (mode === "json") {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log(`Managed delegation: ${plan.agent} (${plan.role}, ${plan.sandboxMode})`);
  console.log(`Why: ${plan.userSummary.whyThisAgent}`);
  console.log(`No question now: ${plan.userSummary.whyNoQuestionNow}`);
  console.log(`Will ask when: ${plan.userSummary.whenCodexWillAsk}`);
  if (plan.clarificationQuestion) console.log(`Question: ${plan.clarificationQuestion}`);
  console.log("Goal stages:");
  for (const stage of plan.goalLoop) {
    console.log(`- ${stage.goal}: ${stage.agent} as ${stage.role}; skills=${stage.skills.join(", ") || "none"}`);
  }
  console.log(`Next action: ${plan.nextAction.type}${plan.nextAction.stageId ? ` (${plan.nextAction.stageId})` : ""}`);
}

function printJudgement(result, mode) {
  if (mode === "json") {
    console.log(JSON.stringify(compactJudgementResult(result), null, 2));
    return;
  }
  if (mode === "verbose-json") {
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
    console.log("Agent roster:");
    for (const [role, agent] of Object.entries(result.agentRoster || {})) {
      if (agent && !Array.isArray(agent) && typeof agent === "object" && agent.name) console.log(`- ${role}: ${agent.name} (${agent.runtimeRole}/${agent.sandboxMode})`);
    }
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
    oldest: entries.map((entry) => entry.createdAt).filter(Boolean).sort()[0] || null,
    newest: entries.map((entry) => entry.createdAt).filter(Boolean).sort().at(-1) || null,
    corruptedQuarantineCount: fs.existsSync(path.dirname(JUDGEMENT_CACHE_PATH))
      ? fs.readdirSync(path.dirname(JUDGEMENT_CACHE_PATH)).filter((name) => name.startsWith(path.basename(JUDGEMENT_CACHE_PATH)) && name.includes(".corrupt-")).length
      : 0,
  };
}

function cacheStatusReport() {
  return {
    generatedAt: new Date().toISOString(),
    judgementCache: cacheStats(),
    routeCache: routeCacheStats(),
    skillRegistrySnapshot: skillSnapshotStats(),
  };
}

function pruneCacheEntries(cache, olderThanHours) {
  if (!Number.isFinite(olderThanHours)) return { ...cache, entries: {} };
  const cutoff = Date.now() - olderThanHours * 36e5;
  const entries = Object.fromEntries(Object.entries(cache.entries || {}).filter(([, entry]) => {
    const created = Date.parse(entry.createdAt || "");
    return Number.isFinite(created) && created >= cutoff;
  }));
  return { ...cache, entries };
}

function runCacheStatus(mode = "text") {
  const report = cacheStatusReport();
  if (mode === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Judgement cache: ${report.judgementCache.entries} entries`);
  console.log(`Route cache: ${report.routeCache.entries} entries, ${report.routeCache.hitRate}% hit rate`);
  console.log(`Skill snapshot: ${report.skillRegistrySnapshot.exists ? `${report.skillRegistrySnapshot.count} skills` : "missing"}`);
}

function runCachePrune(args = [], mode = "text") {
  const pruneAll = args.includes("--all") || (!args.includes("--route") && !args.includes("--judgement"));
  const pruneRoute = pruneAll || args.includes("--route");
  const pruneJudgement = pruneAll || args.includes("--judgement");
  const olderIndex = args.indexOf("--older-than-hours");
  const olderThanHours = olderIndex >= 0 ? Number(args[olderIndex + 1]) : NaN;
  const before = cacheStatusReport();
  if (pruneJudgement) {
    const cache = pruneCacheEntries(readJudgementCache(), olderThanHours);
    writeJudgementCache(cache);
  }
  if (pruneRoute) {
    const cache = pruneCacheEntries(readJsonCache(ROUTE_CACHE_PATH), olderThanHours);
    writeRouteCache(cache);
  }
  const after = cacheStatusReport();
  const report = {
    generatedAt: new Date().toISOString(),
    pruned: {
      judgement: pruneJudgement,
      route: pruneRoute,
      olderThanHours: Number.isFinite(olderThanHours) ? olderThanHours : null,
    },
    before,
    after,
  };
  if (mode === "json") console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Pruned judgement cache: ${pruneJudgement ? "yes" : "no"} (${before.judgementCache.entries} -> ${after.judgementCache.entries})`);
    console.log(`Pruned route cache: ${pruneRoute ? "yes" : "no"} (${before.routeCache.entries} -> ${after.routeCache.entries})`);
  }
}

function skillSnapshotStats() {
  try {
    const snapshot = JSON.parse(readText(SKILL_REGISTRY_SNAPSHOT_PATH));
    return {
      path: SKILL_REGISTRY_SNAPSHOT_PATH,
      exists: true,
      readable: Array.isArray(snapshot.skills),
      count: snapshot.count || snapshot.skills?.length || 0,
      generatedAt: snapshot.generatedAt || null,
      ageHours: snapshot.generatedAt ? Number(((Date.now() - Date.parse(snapshot.generatedAt)) / 36e5).toFixed(2)) : null,
      stale: snapshot.generatedAt ? ((Date.now() - Date.parse(snapshot.generatedAt)) / 36e5) > (loadStrategyConfig().costPolicy?.cache?.snapshotMaxAgeHours || DEFAULT_COST_POLICY.cache.snapshotMaxAgeHours) : true,
    };
  } catch {
    return {
      path: SKILL_REGISTRY_SNAPSHOT_PATH,
      exists: fs.existsSync(SKILL_REGISTRY_SNAPSHOT_PATH),
      readable: false,
      count: 0,
      generatedAt: null,
      ageHours: null,
      stale: true,
    };
  }
}

function explainConfigForTask(task) {
  const config = loadStrategyConfig();
  const route = routeTask(task, { candidateLimit: 8 });
  const policy = computeJudgePolicy(task, route, { budget: "balanced" });
  const cleaned = cleanTask(task);
  const matchedTaskKinds = Object.entries(config.taskKindPolicy || {}).filter(([, kind]) => patternListMatches(kind.keywords || [], cleaned)).map(([kind, value]) => ({
    taskKind: kind,
    preferredAgents: value.preferredAgents || [],
    allowedPhases: value.allowedPhases || [],
  }));
  const matchedHighRiskRules = (config.highRiskRules || []).filter((rule) => rule.pattern && new RegExp(rule.pattern, "i").test(cleaned)).map((rule) => rule.id || "unnamed");
  const matchedSkillRules = (config.skillRules || []).filter((rule) => rule.patterns.some((pattern) => pattern.test(cleaned))).map((rule) => ({
    id: rule.id,
    phase: rule.phase,
    skills: rule.skills,
  }));
  return {
    task,
    strategyVersion: config.version,
    configSource: config.source,
    selectedTaskKind: route.taskProfile.taskKind,
    matchedTaskKinds,
    matchedHighRiskRules,
    matchedSkillRules,
    selectedAgent: route.recommended.name,
    judgePolicy: {
      judgeMode: policy.judgeMode,
      judgeModel: policy.judgeModel,
      cacheEligible: policy.cacheEligible,
      cacheBypassReason: policy.cacheBypassReason,
    },
    routeCache: route.routeCache,
  };
}

function runConfigCheck(mode = "text") {
  const validation = validateStrategyConfig();
  const report = {
    generatedAt: new Date().toISOString(),
    ok: validation.ok,
    errors: validation.errors,
    warnings: validation.warnings,
  };
  if (mode === "json") console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`CONFIG ${report.ok ? "PASS" : "FAIL"}`);
    for (const error of report.errors) console.log(`ERROR ${error}`);
    for (const warning of report.warnings) console.log(`WARN ${warning}`);
  }
  if (!report.ok) throw new Error("config-check failed");
}

function runConfigExplain(task, mode = "text") {
  const report = explainConfigForTask(task);
  if (mode === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Task kind: ${report.selectedTaskKind}`);
  console.log(`Agent: ${report.selectedAgent}`);
  console.log(`Judge: ${report.judgePolicy.judgeMode} / ${report.judgePolicy.judgeModel}`);
  console.log(`Matched task kinds: ${report.matchedTaskKinds.map((entry) => entry.taskKind).join(", ") || "none"}`);
  console.log(`High-risk rules: ${report.matchedHighRiskRules.join(", ") || "none"}`);
  console.log(`Skill rules: ${report.matchedSkillRules.map((entry) => entry.id).join(", ") || "none"}`);
}

function configuredSkillBudgetRisk(config = loadStrategyConfig()) {
  const budgets = config.costPolicy?.candidateBudgets || DEFAULT_COST_POLICY.candidateBudgets;
  const smallestBudget = Math.min(...Object.values(budgets).map((budget) => budget.skills).filter(Boolean));
  const risks = (config.skillRules || [])
    .map((rule) => ({
      ruleId: rule.id || "unnamed",
      skillCount: unique(rule.skills || []).length,
      smallestBudget,
    }))
    .filter((rule) => rule.skillCount > rule.smallestBudget);
  return {
    ok: true,
    riskCount: risks.length,
    smallestBudget,
    risks,
  };
}

function readLastSkillRepair() {
  try {
    const report = JSON.parse(readText(SKILL_REPAIR_RESULTS_PATH));
    return {
      generatedAt: report.generatedAt,
      pass: Boolean(report.pass),
      repairedSkill: report.repairedSkill,
      highRiskFallbackBlocked: Boolean(report.highRiskFallbackBlocked),
    };
  } catch {
    return null;
  }
}

function commandAvailable(command) {
  if (command.includes(path.sep)) return fs.existsSync(command);
  try {
    execFileSync("which", [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function runDoctor(mode = "text") {
  const registry = loadRegistry();
  const skills = loadSkillRegistry();
  const community = loadCommunitySkillManifest();
  const config = loadStrategyConfig();
  const configValidation = validateStrategyConfig(config);
  const budgetRisk = configuredSkillBudgetRisk(config);
  const snapshot = skillSnapshotStats();
  const skillNames = new Set(skills.flatMap((skill) => [skill.name, skill.name.split(":").at(-1)]));
  const missingSkillNames = unique(config.skillRules.flatMap((rule) => rule.skills || []))
    .filter((name) => !skillNames.has(name) && !skillNames.has(name.split(":").at(-1)));
  const checks = [
    { id: "agents-registry", ok: Boolean(registry.count || registry.agents?.length), detail: `${registry.count || registry.agents?.length || 0} agents` },
    { id: "skills-registry", ok: skills.length > 0, detail: `${skills.length} skills` },
    { id: "community-skills", ok: community.loaded && community.count > 0, detail: `${community.count} community skills` },
    { id: "strategy-config", ok: configValidation.ok, detail: configValidation.errors.join("; ") || "valid" },
    { id: "judgement-schema", ok: fs.existsSync(JUDGEMENT_SCHEMA_PATH), detail: JUDGEMENT_SCHEMA_PATH },
    { id: "codex-cli", ok: commandAvailable(CODEX_CLI), detail: CODEX_CLI },
    { id: "configured-skills-exist", ok: missingSkillNames.length === 0, detail: missingSkillNames.length ? `missing: ${missingSkillNames.slice(0, 12).join(", ")}` : "all configured skills found" },
    { id: "skill-budget-risk", ok: budgetRisk.ok, detail: budgetRisk.riskCount ? `${budgetRisk.riskCount} rules exceed smallest skill budget; v9 repair keeps configured skills eligible` : "no configured rule exceeds smallest skill budget" },
    { id: "cache-readable", ok: Boolean(readJudgementCache()), detail: `${cacheStats().entries} entries` },
    { id: "route-cache-readable", ok: Boolean(readJsonCache(ROUTE_CACHE_PATH)), detail: `${routeCacheStats().entries} entries, ${routeCacheStats().hitRate}% hit rate` },
    { id: "skill-registry-snapshot", ok: snapshot.exists && snapshot.readable && snapshot.count > 0, detail: snapshot.exists ? `${snapshot.count} skills, generated ${snapshot.generatedAt || "unknown"}${snapshot.stale ? " (stale; run refresh-skills)" : ""}` : "missing; will be rebuilt on next registry load" },
    { id: "config-v13", ok: configValidation.ok && Number(config.version) >= 13 && Boolean(config.taskKindPolicy?.["incident-response"]), detail: configValidation.ok ? `v${config.version} with ${Object.keys(config.taskKindPolicy || {}).length} task kinds` : configValidation.errors.join("; ") },
    { id: "agent-roster-v13", ok: Boolean(routeTask("开启子代理，调用合适子代理优化 subagent-router 调度算法和调用速度", { candidateLimit: 8 }).agentRoster?.primary?.name), detail: "route outputs include agent roster and fallback candidates" },
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    ok: checks.every((check) => check.ok),
    checks,
    warnings: unique([
      ...configValidation.warnings,
      ...budgetRisk.risks.map((risk) => `skill rule ${risk.ruleId} has ${risk.skillCount} skills over smallest budget ${risk.smallestBudget}; configured skills are protected from truncation`),
    ]),
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
  const budgetRisk = configuredSkillBudgetRisk(config);
  const lastSkillRepair = readLastSkillRepair();
  let lastEval = null;
  try {
    const evalReport = JSON.parse(readText(EVAL_RESULTS_PATH));
    lastEval = {
      generatedAt: evalReport.generatedAt,
      total: evalReport.total,
      passed: evalReport.passed,
      failed: evalReport.failed,
      passRate: evalReport.passRate,
      bucketStats: evalReport.bucketStats || null,
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
    schemaSource: JUDGEMENT_SCHEMA_PATH,
    registrySource: REGISTRY_PATH,
    cache: cacheStats(),
    routeCache: routeCacheStats(),
    skillRegistrySnapshot: skillSnapshotStats(),
    taskKinds: Object.keys(config.taskKindPolicy || {}),
    skillBudgetRisk: {
      riskCount: budgetRisk.riskCount,
      smallestBudget: budgetRisk.smallestBudget,
    },
    lastEval,
    lastSkillRepair,
    agentRoster: {
      available: Boolean(routeTask("开启子代理，完善公开 GitHub README 发布说明和安装步骤", { candidateLimit: 8 }).agentRoster?.primary?.name),
      samplePrimary: routeTask("开启子代理，完善公开 GitHub README 发布说明和安装步骤", { candidateLimit: 8 }).agentRoster?.primary?.name || null,
    },
  };
  if (mode === "json") console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Agents: ${report.agents}`);
    console.log(`Skills: ${report.skills} (${report.communitySkills} community)`);
    console.log(`Strategy: v${report.strategyVersion} from ${report.strategySource}`);
    console.log(`Skill budget risk: ${report.skillBudgetRisk.riskCount} rules over smallest budget ${report.skillBudgetRisk.smallestBudget}`);
    console.log(`Cache: ${report.cache.entries} entries`);
    console.log(`Route cache: ${report.routeCache.entries} entries, ${report.routeCache.hitRate}% hit rate`);
    console.log(`Skill snapshot: ${report.skillRegistrySnapshot.exists ? `${report.skillRegistrySnapshot.count} skills` : "missing"}`);
    console.log(`Last eval: ${lastEval ? `${lastEval.passed}/${lastEval.total} (${lastEval.passRate}%)` : "not run"}`);
    if (lastEval?.bucketStats) console.log(`Eval buckets: ${Object.keys(lastEval.bucketStats).length}`);
    console.log(`Last skill repair: ${lastSkillRepair ? `${lastSkillRepair.pass ? "pass" : "fail"} (${lastSkillRepair.repairedSkill})` : "not run"}`);
    console.log(`Agent roster: ${report.agentRoster.available ? `available (sample ${report.agentRoster.samplePrimary})` : "missing"}`);
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
  { id: "v9-multi-agent-project-audit", task: "开启子代理，使用多智能体对这个项目进行审查优化并持续迭代", expected: { intentIncludes: ["review", "planning"], judgeModel: "gpt-5.5", skillsInclude: ["superpowers:writing-plans"], requiresReview: true } },
  { id: "v10-current-project-multi-agent-optimize", task: "开启子代理，使用多智能体对当前项目做审查，确定几个优化方向，并持续迭代实现。", expected: { intentIncludes: ["review", "planning"], judgeModel: "gpt-5.5", selectedModel: "gpt-5.5", executionMode: "staged", skillsInclude: ["superpowers:writing-plans", "superpowers:executing-plans", "superpowers:subagent-driven-development"], skillsExclude: ["community-spellbook-openai-agents", "community-spellbook-langgraph"], requiresReview: true, requiresTests: true, needsParentChoice: false } },
  { id: "v10-current-project-multi-agent-vague", task: "开启子代理，多智能体帮我优化一下当前项目。", expected: { judgeModel: "gpt-5.5", executionMode: "clarify-first", needsParentChoice: true } },
  { id: "v10-current-diff-multi-agent-security-plan", task: "开启子代理，使用多智能体审查当前 diff 里的生产鉴权和权限漏洞，并制定修复计划。", expected: { intentIncludes: ["review", "security", "planning"], judgeModel: "gpt-5.5", selectedModel: "gpt-5.5", cacheEligible: false, requiresReview: true } },
  { id: "v10-explicit-skills-project-optimization", task: "开启子代理，请显式使用 skills 来规划并执行当前项目的优化。", expected: { intentIncludes: ["planning"], judgeModel: "gpt-5.5", executionMode: "staged", skillsInclude: ["superpowers:writing-plans", "superpowers:executing-plans", "superpowers:subagent-driven-development"], skillsExclude: ["community-spellbook-openai-agents", "community-spellbook-langgraph"] } },
  { id: "v10-readonly-multi-agent-audit", task: "开启子代理，用多智能体只读审计当前项目的测试覆盖和架构风险，不要改代码。", expected: { intentIncludes: ["review", "testing", "planning"], judgeModel: "gpt-5.5", sandbox: "read-only", requiresReview: true, requiresTests: false } },
  { id: "v10-openai-agent-framework-explicit", task: "开启子代理，设计 OpenAI Agents SDK 与 LangGraph 调度策略", expected: { intentIncludes: ["data-ai", "planning"], skillsInclude: ["community-spellbook-openai-agents", "community-spellbook-langgraph"], judgeModel: "gpt-5.5" } },
  { id: "v11-router-speed-orchestration", task: "开启子代理，调用合适子代理优化 subagent-router 调度算法和调用速度", expected: { intentIncludes: ["orchestration"], taskKind: "orchestration-design", agentIn: ["architect-reviewer", "project-manager", "multi-agent-coordinator", "code-mapper"], executionMode: "staged", requiresTests: true, requiresReview: true, judgeModel: "gpt-5.5" } },
  { id: "v11-product-adoption-readonly", task: "开启子代理，分析功能 adoption 差，不要改代码", expected: { taskKind: "product-analysis", agentIn: ["product-manager", "research-analyst", "risk-manager", "business-analyst"], sandbox: "read-only", requiresTests: false, noImplementStage: true } },
  { id: "v11-router-fallback-review", task: "开启子代理，评审 router fallback 和 quality gate", expected: { intentIncludes: ["orchestration"], taskKind: "orchestration-design", agentIn: ["architect-reviewer", "project-manager", "multi-agent-coordinator", "code-mapper"], executionMode: "staged" } },
  { id: "v11-product-engineering-conflict", task: "开启子代理，分析用户 churn 问题，并判断是否需要后端限流改造", expected: { taskKind: "product-analysis", agentIn: ["product-manager", "research-analyst", "risk-manager", "business-analyst"], noImplementStage: true, requiresTests: false } },
  { id: "v11-support-engineering-handoff", task: "开启子代理，设计支持团队到工程团队的 handoff，并补测试方案", expected: { intentIncludes: ["orchestration", "testing", "planning"], taskKind: "orchestration-design", executionMode: "staged", requiresTests: true } },
  { id: "v11-goal-mode-managed", task: "开启子代理，调用合适子代理，用 goal 模式持续实现", expected: { intentIncludes: ["orchestration", "planning"], taskKind: "orchestration-design", executionMode: "staged", judgeModel: "gpt-5.5" } },
  { id: "v12-release-readme-public", task: "开启子代理，完善公开 GitHub README 发布说明和安装步骤", expected: { taskKind: "release-publishing", intentIncludes: ["docs", "github"], agentIn: ["documentation-engineer", "technical-writer", "github-expert"], skillsInclude: ["github:github"] } },
  { id: "v12-release-notes-changelog", task: "开启子代理，生成 release notes 和 changelog 并更新发布说明", expected: { taskKind: "release-publishing", agentIn: ["documentation-engineer", "technical-writer"], skillsInclude: ["community-jmerta-release-notes"] } },
  { id: "v12-release-thanks", task: "开启子代理，补充开源项目致谢和版本说明", expected: { taskKind: "release-publishing", agentIn: ["documentation-engineer", "technical-writer"], noImplementStage: false } },
  { id: "v12-docs-github-not-devops", task: "开启子代理，完善 GitHub 仓库说明和安装验证文档，不做部署", expected: { taskKind: "release-publishing", intentIncludes: ["docs", "github"], skillsInclude: ["github:github"] } },
  { id: "v12-research-official-nowrite", task: "开启子代理，只调研官方文档确认 OpenAI API 用法，不要改代码", expected: { taskKind: "research-only", agentIn: ["docs-researcher", "research-analyst", "code-mapper"], role: "explorer", sandbox: "read-only", noImplementStage: true, requiresTests: false } },
  { id: "v12-research-source-verification", task: "开启子代理，只读调研 LangGraph 官方文档并给出结论，不要修改任何文件", expected: { taskKind: "research-only", role: "explorer", sandbox: "read-only", noImplementStage: true } },
  { id: "v12-research-repo-map-nowrite", task: "开启子代理，只读调研当前项目的缓存实现，不要改代码", expected: { taskKind: "research-only", role: "explorer", sandbox: "read-only", noImplementStage: true } },
  { id: "v12-incident-prod-log", task: "开启子代理，根据生产日志处理线上事故并准备回滚", expected: { taskKind: "incident-response", judgeModel: "gpt-5.5", selectedModel: "gpt-5.5", executionMode: "staged", requiresReview: true } },
  { id: "v12-incident-outage-auth", task: "开启子代理，线上故障疑似鉴权 token 失效，定位并修复", expected: { taskKind: "incident-response", judgeModel: "gpt-5.5", selectedModel: "gpt-5.5", requiresTests: true, requiresReview: true } },
  { id: "v12-incident-readonly-diagnose", task: "开启子代理，只读分析线上事故日志和回滚方案，不要改代码", expected: { taskKind: "incident-response", judgeModel: "gpt-5.5", sandbox: "read-only", noImplementStage: true, requiresReview: true } },
  { id: "v12-repo-maintenance-config", task: "开启子代理，优化 router config-check 和 report 健康状态", expected: { taskKind: "repo-maintenance", executionMode: "staged", requiresTests: true } },
  { id: "v12-repo-maintenance-cache", task: "开启子代理，维护 route cache 和 skill snapshot 刷新逻辑", expected: { taskKind: "repo-maintenance", executionMode: "staged", requiresTests: true } },
  { id: "v12-repo-maintenance-doctor-readonly", task: "开启子代理，只读检查 doctor/report/cache 配置健康状态，不要改代码", expected: { taskKind: "research-only", role: "explorer", sandbox: "read-only", noImplementStage: true } },
  { id: "v12-product-engineering-suggestions", task: "开启子代理，分析功能 adoption 差并给工程建议，不要改代码", expected: { taskKind: "product-analysis", noImplementStage: true, requiresTests: false } },
  { id: "v12-doc-release-github-conflict", task: "开启子代理，发布 GitHub README 和 changelog，不要触碰 CI/CD 部署", expected: { taskKind: "release-publishing", intentIncludes: ["docs", "github"] } },
  { id: "v12-current-log-incident", task: "开启子代理，当前生产日志显示支付接口 500，处理线上事故", expected: { taskKind: "incident-response", judgeModel: "gpt-5.5", cacheEligible: false, executionMode: "staged" } },
  { id: "v12-multi-agent-file-scope", task: "开启子代理，使用多代理优化 router.mjs 的调度速度，只允许修改 subagents/router.mjs 和 tests", expected: { taskKind: "orchestration-design", executionMode: "staged", judgeModel: "gpt-5.5", requiresTests: true, requiresReview: true } },
  { id: "v12-research-docs-no-write-github", task: "开启子代理，调研 GitHub 官方文档确认 release 发布流程，不要写代码", expected: { taskKind: "research-only", role: "explorer", sandbox: "read-only", noImplementStage: true } },
  { id: "v12-release-install-verify", task: "开启子代理，完善安装验证说明和公开发布检查清单", expected: { taskKind: "release-publishing", agentIn: ["documentation-engineer", "technical-writer"] } },
  { id: "v12-incident-rollback-plan", task: "开启子代理，生产回滚方案审查和事故复盘", expected: { taskKind: "incident-response", judgeModel: "gpt-5.5", requiresReview: true } },
  { id: "v13-roster-router-speed", task: "开启子代理，调用合适子代理继续优化 subagent-router 的调度速度和代理阵容选择", expected: { taskKind: "orchestration-design", agentIn: ["architect-reviewer", "project-manager", "multi-agent-coordinator", "code-mapper"], executionMode: "staged", judgeModel: "gpt-5.5", requiresReview: true, requiresTests: true } },
  { id: "v13-roster-readonly-research", task: "开启子代理，只读调研官方文档和当前仓库实现，不要改代码", expected: { taskKind: "research-only", role: "explorer", sandbox: "read-only", noImplementStage: true, requiresTests: false } },
  { id: "v13-roster-release-public", task: "开启子代理，完善公开仓库 README、中文说明和发布检查清单", expected: { taskKind: "release-publishing", agentIn: ["documentation-engineer", "technical-writer", "github-expert"], skillsInclude: ["github:github"] } },
  { id: "v13-readiness-goal-queue", task: "开启子代理，调用合适子代理，用 goal 模式连续实现多个优化目标", expected: { taskKind: "orchestration-design", executionMode: "staged", judgeModel: "gpt-5.5", needsParentChoice: false } },
  { id: "v13-readiness-vague-project", task: "开启子代理，多代理优化一下项目", expected: { executionMode: "clarify-first", needsParentChoice: true, judgeModel: "gpt-5.5" } },
  { id: "v13-cache-maintenance", task: "开启子代理，维护 judgement cache、route cache 和 skill snapshot 健康状态", expected: { taskKind: "repo-maintenance", executionMode: "staged", requiresTests: true } },
  { id: "v13-cache-status-docs", task: "开启子代理，说明 cache-status 和 cache-prune 的使用方式", expected: { intentIncludes: ["docs"], taskKind: "repo-maintenance" } },
  { id: "v13-incident-no-cache", task: "开启子代理，当前生产日志显示鉴权接口大量 401，处理线上事故", expected: { taskKind: "incident-response", judgeModel: "gpt-5.5", cacheEligible: false, requiresReview: true } },
  { id: "v13-incident-readonly-review", task: "开启子代理，只读审查生产事故复盘和回滚风险，不要改代码", expected: { taskKind: "incident-response", role: "explorer", sandbox: "read-only", judgeModel: "gpt-5.5", noImplementStage: true, requiresReview: true } },
  { id: "v13-product-no-implementation", task: "开启子代理，分析用户 adoption 下降并给出产品建议，不要改代码", expected: { taskKind: "product-analysis", sandbox: "read-only", noImplementStage: true, requiresTests: false } },
  { id: "v13-publishing-github-not-devops", task: "开启子代理，发布 GitHub README 和 release notes，不要处理 CI/CD", expected: { taskKind: "release-publishing", intentIncludes: ["docs", "github"] } },
  { id: "v13-orchestration-skill-phase", task: "开启子代理，优化 selectedSkillsByPhase 和 handoff stage 的技能加载顺序", expected: { taskKind: "orchestration-design", executionMode: "staged", skillsInclude: ["superpowers:writing-plans"], requiresTests: true } },
  { id: "v13-managed-contract-boundaries", task: "开启子代理，完善 managed executionContract、writeBoundaries 和 parentResponsibilities", expected: { taskKind: "orchestration-design", executionMode: "staged", judgeModel: "gpt-5.5" } },
  { id: "v13-report-bucket-stats", task: "开启子代理，增强 eval 分桶质量报告和 report 健康摘要", expected: { taskKind: "repo-maintenance", requiresTests: true } },
  { id: "v13-public-hygiene", task: "开启子代理，公开发布前检查 secrets、本机路径和第三方致谢", expected: { intentIncludes: ["security", "review"], judgeModel: "gpt-5.5", requiresReview: true } },
  { id: "v9-skill-budget-planning", task: "开启子代理，写好详细计划方案然后使用 goal 模式实现", expected: { intentIncludes: ["planning"], skillsInclude: ["superpowers:writing-plans"], judgeModel: "gpt-5.5" } },
  { id: "v9-high-risk-fallback-auth", task: "开启子代理，critical 模式修复生产 API 鉴权和权限漏洞", options: { budget: "critical" }, expected: { intentIncludes: ["backend", "security"], judgeModel: "gpt-5.5", selectedModel: "gpt-5.5", requiresTests: true, requiresReview: true } },
  { id: "v9-public-readme-release", task: "开启子代理，完善公开 GitHub README 发布说明和安装步骤", expected: { intentIncludes: ["docs", "github"], skillsInclude: ["github:github"] } },
  { id: "v9-license-notice", task: "开启子代理，审查开源 LICENSE 和第三方致谢风险", expected: { intentIncludes: ["review", "security"], judgeModel: "gpt-5.5", requiresReview: true } },
  { id: "v9-cache-docs", task: "开启子代理，说明 judgement cache 内容、位置和清理方式", expected: { intentIncludes: ["docs"], role: "worker" } },
  { id: "v9-schema-contract", task: "开启子代理，审查 judge schema 和最终 handoff contract", expected: { intentIncludes: ["review"], judgeModel: "gpt-5.5", requiresReview: true } },
  { id: "v9-fallback-recovery", task: "开启子代理，测试 schema 错误和模型不可用时的保守恢复", expected: { intentIncludes: ["testing", "debug"], requiresTests: true } },
  { id: "v9-ambiguous-multiagent", task: "开启子代理，多代理帮我优化一下这个", expected: { executionMode: "clarify-first", needsParentChoice: true, judgeModel: "gpt-5.5" } },
  { id: "v9-community-skill-selection", task: "开启子代理，设计 LangGraph 与 OpenAI Agents SDK 的调度策略", expected: { intentIncludes: ["data-ai", "planning"], skillsInclude: ["community-spellbook-openai-agents"], judgeModel: "gpt-5.5" } },
  { id: "v9-release-hygiene", task: "开启子代理，检查公开仓库是否包含 /Users 本机路径", expected: { intentIncludes: ["security", "review"], judgeModel: "gpt-5.5", requiresReview: true } },
  { id: "v9-report-command", task: "开启子代理，增强 router report 健康状态输出", expected: { intentIncludes: ["docs"] } },
  { id: "v9-doctor-command", task: "开启子代理，增强 doctor 检查配置和技能候选风险", expected: { intentIncludes: ["review"] } },
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
  if (expected.skillsExclude) for (const skill of expected.skillsExclude) check(!suggested.includes(skill), `unexpected skill ${skill}`);
  if (expected.selectedModel) check(route.modelPolicy.selectedModel === expected.selectedModel, `expected selectedModel ${expected.selectedModel}, got ${route.modelPolicy.selectedModel}`);
  if (expected.judgeMode) check(policy.judgeMode === expected.judgeMode, `expected judgeMode ${expected.judgeMode}, got ${policy.judgeMode}`);
  if (expected.judgeModel) check(policy.judgeModel === expected.judgeModel, `expected judgeModel ${expected.judgeModel}, got ${policy.judgeModel}`);
  if (expected.cacheEligible !== undefined) check(policy.cacheEligible === expected.cacheEligible, `expected cacheEligible ${expected.cacheEligible}, got ${policy.cacheEligible}`);
  if (expected.taskKind) check(route.taskProfile.taskKind === expected.taskKind, `expected taskKind ${expected.taskKind}, got ${route.taskProfile.taskKind}`);
  if (expected.executionMode) check(route.executionPlan.mode === expected.executionMode, `expected executionMode ${expected.executionMode}, got ${route.executionPlan.mode}`);
  if (expected.requiresTests !== undefined) check(route.executionPlan.requiresTests === expected.requiresTests, `expected requiresTests ${expected.requiresTests}, got ${route.executionPlan.requiresTests}`);
  if (expected.requiresReview !== undefined) check(route.executionPlan.requiresReview === expected.requiresReview, `expected requiresReview ${expected.requiresReview}, got ${route.executionPlan.requiresReview}`);
  if (expected.needsParentChoice !== undefined) check(route.needsParentChoice === expected.needsParentChoice, `expected needsParentChoice ${expected.needsParentChoice}, got ${route.needsParentChoice}`);
  if (expected.noImplementStage) {
    const stageText = JSON.stringify(route.executionPlan.stages || []);
    check(!/implement|worker implements|Worker implements/i.test(stageText), `expected no implementation stage, got ${stageText}`);
  }
  const highRisk = ["high", "critical"].includes(route.taskProfile.risk) || ["high", "critical"].includes(route.modelPolicy.importanceLevel);
  if (highRisk) check(policy.judgeModel === "gpt-5.5", `high-risk policy must use gpt-5.5, got ${policy.judgeModel}`);
  const noWriteInvariant = isNoWriteTask(testCase.task) || route.taskProfile.writeIntent === "none" || route.taskProfile.taskKind === "research-only";
  if (noWriteInvariant) {
    const stageText = JSON.stringify([...(route.executionPlan.stages || []), ...(route.executionPlan.stageDetails || [])]);
    check(!/implement|worker implements|mitigate|maintain/i.test(stageText), `no-write/read-only task must not include write stage, got ${stageText}`);
    check(route.recommended.sandboxMode === "read-only" || route.recommended.runtimeRole === "explorer", `no-write/read-only task should route read-only, got ${route.recommended.runtimeRole}/${route.recommended.sandboxMode}`);
  }
  if (/incident|outage|production|prod\b|current diff|auth|security|线上|生产|事故|故障|当前\s*diff|鉴权|安全/i.test(cleanTask(testCase.task))) {
    check(policy.judgeModel === "gpt-5.5", `incident/security/auth/production/current diff must use gpt-5.5, got ${policy.judgeModel}`);
  }
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
      taskKind: route.taskProfile.taskKind,
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
  const bucketStats = {};
  for (const result of results) {
    const bucket = result.summary.taskKind || "unknown";
    bucketStats[bucket] ||= { total: 0, passed: 0, failed: 0, passRate: 0 };
    bucketStats[bucket].total += 1;
    if (result.pass) bucketStats[bucket].passed += 1;
    else bucketStats[bucket].failed += 1;
  }
  for (const bucket of Object.values(bucketStats)) {
    bucket.passRate = bucket.total ? Number(((bucket.passed / bucket.total) * 100).toFixed(2)) : 0;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    passRate: results.length ? Number((((results.length - failed.length) / results.length) * 100).toFixed(2)) : 0,
    elapsedMs: Date.now() - started,
    bucketStats,
    qualityRiskSummary: failed.map((result) => ({ id: result.id, failures: result.failures })),
    results,
  };
  fs.mkdirSync(path.dirname(EVAL_RESULTS_PATH), { recursive: true });
  fs.writeFileSync(EVAL_RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`);
  if (mode === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`EVAL ${report.passed}/${report.total} passed in ${report.elapsedMs}ms`);
    for (const [bucket, stats] of Object.entries(bucketStats).sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`BUCKET ${bucket}: ${stats.passed}/${stats.total} (${stats.passRate}%)`);
    }
    if (failed.length) {
      for (const result of failed) console.log(`FAIL ${result.id}: ${result.failures.join("; ")}`);
    }
  }
  if (failed.length) throw new Error(`eval failed: ${failed.length}/${results.length} cases failed`);
}

function buildLegacyJudgementPromptEstimate(task, deterministic, agentCandidates, skillCandidates, judgePolicy = {}) {
  const packet = {
    task,
    judgePolicy,
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

Return JSON that matches the provided schema.

Routing packet:
${JSON.stringify(packet, null, 2)}`;
}

function runPerformanceTests() {
  const promptTask = "开启子代理，调用合适子代理优化 subagent-router 调度算法和调用速度";
  const promptRoute = routeTask(promptTask, { candidateLimit: 8 });
  const promptPolicy = computeJudgePolicy(promptTask, promptRoute, { budget: "critical" });
  const promptSkills = buildSkillCandidates(promptTask, promptPolicy.candidateBudget.skills);
  const compactPromptBytes = Buffer.byteLength(buildJudgementPrompt(promptTask, promptRoute, promptRoute.candidates, promptSkills, promptPolicy));
  const legacyPromptBytes = Buffer.byteLength(buildLegacyJudgementPromptEstimate(promptTask, promptRoute, promptRoute.candidates, promptSkills, promptPolicy));
  assert(compactPromptBytes <= legacyPromptBytes * 0.6, `compact prompt must be at least 40% smaller; compact=${compactPromptBytes}, legacy=${legacyPromptBytes}`);

  const jsonTask = "开启子代理，修正 README 里的一个拼写错误";
  const jsonResult = runModelJudgement(jsonTask, { noCache: true });
  const compactJsonBytes = Buffer.byteLength(JSON.stringify(compactJudgementResult(jsonResult), null, 2));
  const verboseJsonBytes = Buffer.byteLength(JSON.stringify(jsonResult, null, 2));
  assert(compactJsonBytes <= verboseJsonBytes * 0.7, `compact json must be at least 30% smaller; compact=${compactJsonBytes}, verbose=${verboseJsonBytes}`);

  const lowRiskProduct = routeTask("开启子代理，分析功能 adoption 差，不要改代码", { candidateLimit: 8 });
  const lowRiskPolicy = computeJudgePolicy(lowRiskProduct.task, lowRiskProduct, { budget: "balanced" });
  assert(lowRiskPolicy.judgeModel !== "gpt-5.5", `low-risk read-only product analysis should avoid GPT-5.5, got ${lowRiskPolicy.judgeModel}`);

  const highRiskSecurity = routeTask("开启子代理，审查当前 diff 里的生产鉴权漏洞", { candidateLimit: 8 });
  const highRiskPolicy = computeJudgePolicy(highRiskSecurity.task, highRiskSecurity, { budget: "balanced" });
  assert(highRiskPolicy.judgeModel === "gpt-5.5", `high-risk current diff auth review must keep GPT-5.5, got ${highRiskPolicy.judgeModel}`);
  assert(highRiskPolicy.cacheEligible === false, "volatile high-risk current diff must bypass cache");

  const skillStarted = process.hrtime.bigint();
  const tierOneSkills = buildSkillCandidates("开启子代理，帮我修前端 bug", 3);
  const skillElapsedMs = Number(process.hrtime.bigint() - skillStarted) / 1e6;
  assert(tierOneSkills.length === 3, `Tier-1 skill build should honor limit, got ${tierOneSkills.length}`);
  assert(tierOneSkills.some((skill) => /frontend|react|ui-ux|tailwind/.test(skill.name)), "Tier-1 skill build should keep direct frontend-family skills");

  const routeCacheTask = "开启子代理，调用合适子代理优化 subagent-router 调度算法和调用速度";
  const routeStarted = process.hrtime.bigint();
  routeTask(routeCacheTask, { candidateLimit: 8, noRouteCache: true });
  const uncachedRouteMs = Number(process.hrtime.bigint() - routeStarted) / 1e6;
  const cachedStarted = process.hrtime.bigint();
  routeTask(routeCacheTask, { candidateLimit: 8 });
  routeTask(routeCacheTask, { candidateLimit: 8 });
  const cachedRouteMs = Number(process.hrtime.bigint() - cachedStarted) / 1e6;
  assert(Number.isFinite(cachedRouteMs) && Number.isFinite(uncachedRouteMs), "route timing should be measurable");

  routeTaskCache.clear();
  const stableTask = "开启子代理，完善 README 发布说明和安装步骤";
  const coldRouteStarted = process.hrtime.bigint();
  routeTask(stableTask, { candidateLimit: 8, noRouteCache: true });
  const coldRouteMs = Number(process.hrtime.bigint() - coldRouteStarted) / 1e6;
  routeTaskCache.clear();
  const seedStableRoute = routeTask(stableTask, { candidateLimit: 8 });
  routeTaskCache.clear();
  const warmRouteStarted = process.hrtime.bigint();
  let warmStableRoute = routeTask(stableTask, { candidateLimit: 8 });
  if (!warmStableRoute.routeCache?.hit && seedStableRoute.routeCache?.eligible) {
    routeTaskCache.clear();
    warmStableRoute = routeTask(stableTask, { candidateLimit: 8 });
  }
  const warmRouteMs = Number(process.hrtime.bigint() - warmRouteStarted) / 1e6;
  assert(warmStableRoute.routeCache?.hit, "stable warm route should hit persistent cache");

  const managedStarted = process.hrtime.bigint();
  managedDelegationPlan(deterministicManagedResult(stableTask));
  const managedMs = Number(process.hrtime.bigint() - managedStarted) / 1e6;

  const report = {
    pass: true,
    prompt: {
      compactBytes: compactPromptBytes,
      legacyBytes: legacyPromptBytes,
      reductionPercent: Number((100 - (compactPromptBytes / legacyPromptBytes) * 100).toFixed(2)),
    },
    json: {
      compactBytes: compactJsonBytes,
      verboseBytes: verboseJsonBytes,
      reductionPercent: Number((100 - (compactJsonBytes / verboseJsonBytes) * 100).toFixed(2)),
    },
    judgeGate: {
      lowRiskProduct: lowRiskPolicy.judgeModel,
      highRiskSecurity: highRiskPolicy.judgeModel,
    },
    localPrep: {
      tierOneSkillMs: Number(skillElapsedMs.toFixed(3)),
      uncachedRouteMs: Number(uncachedRouteMs.toFixed(3)),
      cachedRoutePairMs: Number(cachedRouteMs.toFixed(3)),
      coldStableRouteMs: Number(coldRouteMs.toFixed(3)),
      warmStableRouteMs: Number(warmRouteMs.toFixed(3)),
      managedGenerationMs: Number(managedMs.toFixed(3)),
      snapshot: skillSnapshotStats(),
      routeCache: routeCacheStats(),
    },
  };
  console.log(JSON.stringify(report, null, 2));
}

function deterministicManagedResult(task) {
  const route = routeTask(task, { candidateLimit: 8 });
  const judgePolicy = computeJudgePolicy(task, route, { offline: true });
  const skillCandidates = buildSkillCandidates(task, judgePolicy.candidateBudget.skills);
  return attachRoutingMetadata({
    task,
    modelUsed: false,
    model: null,
    judgeMode: "deterministic",
    judgeModel: "none",
    costRationale: ["managed delegation test uses deterministic route"],
    candidateBudget: judgePolicy.candidateBudget,
    cache: { hit: false, eligible: false },
    finalAgent: route.recommended.name,
    runtimeRole: route.recommended.runtimeRole,
    sandboxMode: route.recommended.sandboxMode,
    selectedSkills: route.suggestedSkills,
    selectedSkillsByPhase: route.selectedSkillsByPhase,
    importanceLevel: route.modelPolicy.importanceLevel,
    selectedModel: route.modelPolicy.selectedModel,
    reasoningEffort: route.modelPolicy.reasoningEffort,
    modelRationale: route.modelPolicy.modelRationale,
    taskProfile: route.taskProfile,
    executionPlan: route.executionPlan,
    confidence: route.confidence,
    needsParentChoice: route.needsParentChoice,
    rationale: route.reasons,
    riskNotes: [],
    deterministic: route,
  }, route, skillCandidates, judgePolicy);
}

function runManagedDelegationTests() {
  const authorized = managedDelegationPlan(deterministicManagedResult("开启子代理，调用合适子代理，用 goal 模式持续实现"));
  assert(authorized.mode === "staged", `authorized goal request should be staged, got ${authorized.mode}`);
  assert(authorized.goalLoop.length >= 3, "authorized goal request should expose staged goal loop");
  assert(!Object.prototype.hasOwnProperty.call(authorized, "judgeMode"), "managed plan must hide judgeMode");
  assert(!Object.prototype.hasOwnProperty.call(authorized, "candidateBudget"), "managed plan must hide candidateBudget");
  assert(authorized.userSummary.whyThisAgent && authorized.userSummary.whenCodexWillAsk, "managed plan should include concise user summary");

  const vague = managedDelegationPlan(deterministicManagedResult("开启子代理，多代理帮我优化一下这个"));
  assert(vague.mode === "clarify-first", `vague request should clarify first, got ${vague.mode}`);
  assert(vague.clarificationQuestion, "vague request should include one clarification question");

  const highRisk = managedDelegationPlan(deterministicManagedResult("开启子代理，critical 模式修复生产 API 鉴权和权限漏洞"));
  const stageIds = highRisk.goalLoop.map((stage) => stage.goal);
  assert(stageIds.some((stage) => stage.includes("validate")), "high-risk write managed plan should include validation stage");
  assert(stageIds.some((stage) => stage.includes("review")), "high-risk write managed plan should include review stage");

  console.log(JSON.stringify({
    pass: true,
    authorized: { mode: authorized.mode, stages: authorized.goalLoop.length, agent: authorized.agent },
    vague: { mode: vague.mode, hasQuestion: Boolean(vague.clarificationQuestion) },
    highRisk: { stages: stageIds },
  }, null, 2));
}

function runManagedContractTests() {
  const highRisk = managedDelegationPlan(deterministicManagedResult("开启子代理，修复线上生产 API 鉴权事故并补测试"));
  assert(highRisk.executionContract, "managed plan missing executionContract");
  assert(highRisk.writeBoundaries, "managed plan missing writeBoundaries");
  assert(highRisk.parentResponsibilities?.length >= 3, "managed plan missing parent responsibilities");
  assert(Object.keys(highRisk.stageInputs || {}).length === highRisk.goalLoop.length, "managed stageInputs must cover every stage");
  assert(Object.keys(highRisk.stageOutputs || {}).length === highRisk.goalLoop.length, "managed stageOutputs must cover every stage");
  assert(highRisk.executionContract.mustValidate, "high-risk write task must validate");
  assert(highRisk.executionContract.mustReview, "high-risk write task must review");
  assert(!Object.prototype.hasOwnProperty.call(highRisk, "candidateBudget"), "managed contract must hide candidateBudget");
  assert(!Object.prototype.hasOwnProperty.call(highRisk, "cache"), "managed contract must hide raw cache");

  const research = managedDelegationPlan(deterministicManagedResult("开启子代理，只调研官方文档确认 API 用法，不要改代码"));
  assert(research.executionContract.writeIntent === "none", "research-only managed plan must be no-write");
  assert(!research.goalLoop.some((stage) => /implement|mitigate|maintain/i.test(stage.goal)), "research-only managed plan must not implement");

  console.log(JSON.stringify({
    pass: true,
    highRisk: {
      mode: highRisk.mode,
      taskKind: highRisk.executionContract.taskKind,
      goals: highRisk.goalLoop.map((stage) => stage.goal),
      writerPolicy: highRisk.writeBoundaries.policy,
    },
    research: {
      mode: research.mode,
      taskKind: research.executionContract.taskKind,
      writeIntent: research.executionContract.writeIntent,
    },
  }, null, 2));
}

function runSkillsPhaseTests() {
  const cases = [
    "开启子代理，请显式使用 skills 来规划并执行当前项目的优化。",
    "开启子代理，分析功能 adoption 差，不要改代码",
    "开启子代理，调用合适子代理优化 subagent-router 调度算法和调用速度",
    "开启子代理，修复 API 鉴权问题",
  ];
  const results = [];
  for (const task of cases) {
    const result = deterministicManagedResult(task);
    const selected = new Set(result.selectedSkills || []);
    const phaseSkills = Object.values(result.selectedSkillsByPhase || {}).flat();
    for (const skill of phaseSkills) assert(selected.has(skill), `${task}: phase skill ${skill} not present in selectedSkills`);
    for (const stage of result.handoffPlan?.stages || []) {
      for (const skill of stage.skills || []) assert(selected.has(skill), `${task}: stage skill ${skill} not present in selectedSkills`);
    }
    if (result.taskProfile.taskKind === "product-analysis") {
      assert((result.selectedSkillsByPhase.implementation || []).length === 0, `${task}: product-analysis must not carry implementation skills`);
      assert((result.selectedSkillsByPhase.debugging || []).length === 0, `${task}: product-analysis must not carry debugging skills`);
      assert(!result.handoffPlan.stages.some((stage) => stage.id === "implement"), `${task}: product-analysis must not include implement stage`);
    }
    results.push({
      task,
      taskKind: result.taskProfile.taskKind,
      selectedSkills: result.selectedSkills.length,
      phases: Object.fromEntries(Object.entries(result.selectedSkillsByPhase).filter(([, skills]) => skills.length)),
    });
  }
  console.log(JSON.stringify({ pass: true, results }, null, 2));
}

function runJudgeMatrixTests() {
  const cases = [
    { id: "docs-deterministic", task: "开启子代理，修正 README 里的一个拼写错误", options: {}, expect: { judgeMode: "deterministic", judgeModel: "none" } },
    { id: "product-low-risk", task: "开启子代理，分析功能 adoption 差，不要改代码", options: {}, expect: { judgeModel: "gpt-5.4" } },
    { id: "economy-mini", task: "开启子代理，补齐 pytest 覆盖率", options: { budget: "economy", forceModel: true }, expect: { judgeMode: "mini-judge", judgeModel: "gpt-5.4-mini" } },
    { id: "orchestration-premium", task: "开启子代理，调用合适子代理优化 subagent-router 调度算法和调用速度", options: {}, expect: { judgeMode: "premium-judge", judgeModel: "gpt-5.5" } },
    { id: "current-diff-auth", task: "开启子代理，审查当前 diff 里的生产鉴权漏洞", options: {}, expect: { judgeMode: "premium-judge", judgeModel: "gpt-5.5", cacheEligible: false } },
    { id: "vague-multiagent", task: "开启子代理，多代理帮我优化一下这个", options: {}, expect: { judgeMode: "premium-judge", judgeModel: "gpt-5.5", executionMode: "clarify-first" } },
  ];
  const results = [];
  for (const testCase of cases) {
    const route = routeTask(testCase.task, { candidateLimit: 8 });
    const policy = computeJudgePolicy(testCase.task, route, testCase.options);
    if (testCase.expect.judgeMode) assert(policy.judgeMode === testCase.expect.judgeMode, `${testCase.id}: expected judgeMode ${testCase.expect.judgeMode}, got ${policy.judgeMode}`);
    if (testCase.expect.judgeModel) assert(policy.judgeModel === testCase.expect.judgeModel, `${testCase.id}: expected judgeModel ${testCase.expect.judgeModel}, got ${policy.judgeModel}`);
    if (testCase.expect.cacheEligible !== undefined) assert(policy.cacheEligible === testCase.expect.cacheEligible, `${testCase.id}: expected cacheEligible ${testCase.expect.cacheEligible}, got ${policy.cacheEligible}`);
    if (testCase.expect.executionMode) assert(route.executionPlan.mode === testCase.expect.executionMode, `${testCase.id}: expected executionMode ${testCase.expect.executionMode}, got ${route.executionPlan.mode}`);
    const highRisk = ["high", "critical"].includes(route.taskProfile.risk) || ["high", "critical"].includes(route.modelPolicy.importanceLevel);
    if (highRisk && !/product-low-risk/.test(testCase.id)) assert(policy.judgeModel === "gpt-5.5", `${testCase.id}: high-risk route must use GPT-5.5`);
    results.push({
      id: testCase.id,
      taskKind: route.taskProfile.taskKind,
      executionMode: route.executionPlan.mode,
      judgeMode: policy.judgeMode,
      judgeModel: policy.judgeModel,
      cacheEligible: policy.cacheEligible,
    });
  }
  console.log(JSON.stringify({ pass: true, results }, null, 2));
}

function runConfigTests() {
  const validation = validateStrategyConfig();
  assert(validation.ok, `strategy config should validate: ${validation.errors.join("; ")}`);
  const config = loadStrategyConfig();
  for (const kind of ["release-publishing", "repo-maintenance", "research-only", "incident-response"]) {
    assert(config.taskKindPolicy?.[kind], `missing v12 taskKind policy ${kind}`);
    assert(config.taskKindPolicy[kind].preferredAgents.length, `${kind} should have preferred agents`);
  }
  for (const required of ["security", "auth", "production", "current-diff"]) {
    assert((config.highRiskRules || []).some((rule) => new RegExp(required === "current-diff" ? "current|diff|当前" : required, "i").test(`${rule.id || ""} ${rule.pattern || ""}`)), `missing high-risk rule for ${required}`);
  }
  console.log(JSON.stringify({ pass: true, taskKinds: Object.keys(config.taskKindPolicy || {}), highRiskRules: config.highRiskRules.map((rule) => rule.id) }, null, 2));
}

function runConfigExplainTests() {
  const incident = explainConfigForTask("开启子代理，根据生产日志处理线上事故并准备回滚");
  assert(incident.selectedTaskKind === "incident-response", `expected incident-response, got ${incident.selectedTaskKind}`);
  assert(incident.matchedHighRiskRules.includes("production") || incident.matchedHighRiskRules.includes("incident"), "incident explain should show high-risk rule");
  const research = explainConfigForTask("开启子代理，只调研官方文档确认 OpenAI API 用法，不要改代码");
  assert(research.selectedTaskKind === "research-only", `expected research-only, got ${research.selectedTaskKind}`);
  console.log(JSON.stringify({ pass: true, incident, research }, null, 2));
}

function runRouteCacheTests() {
  const stableTask = "开启子代理，完善 README 发布说明和安装步骤";
  routeTaskCache.clear();
  const before = routeCacheStats();
  const coldStarted = process.hrtime.bigint();
  const cold = routeTask(stableTask, { candidateLimit: 8, noRouteCache: true });
  const coldMs = Number(process.hrtime.bigint() - coldStarted) / 1e6;
  routeTaskCache.clear();
  routeTask(stableTask, { candidateLimit: 8 });
  routeTaskCache.clear();
  const warmStarted = process.hrtime.bigint();
  let warm = routeTask(stableTask, { candidateLimit: 8 });
  if (!warm.routeCache?.hit) {
    routeTaskCache.clear();
    warm = routeTask(stableTask, { candidateLimit: 8 });
  }
  const warmMs = Number(process.hrtime.bigint() - warmStarted) / 1e6;
  assert(warm.routeCache?.hit, "warm route should hit persistent route cache");
  assert(Number.isFinite(warmMs) && Number.isFinite(coldMs), "route cache timings should be measurable");

  const volatileRoute = routeTask("开启子代理，审查当前 diff 里的生产鉴权漏洞", { candidateLimit: 8 });
  assert(volatileRoute.routeCache?.eligible === false, "volatile/high-risk route must bypass route cache");

  const original = fs.existsSync(ROUTE_CACHE_PATH) ? readText(ROUTE_CACHE_PATH) : "";
  fs.writeFileSync(ROUTE_CACHE_PATH, "{ bad json");
  const recovered = readJsonCache(ROUTE_CACHE_PATH);
  assert(Object.keys(recovered.entries || {}).length === 0, "bad route cache should recover to empty entries");
  if (original) fs.writeFileSync(ROUTE_CACHE_PATH, original);

  console.log(JSON.stringify({
    pass: true,
    before,
    cold: { taskKind: cold.taskProfile.taskKind, ms: Number(coldMs.toFixed(3)) },
    warm: { hit: warm.routeCache.hit, ms: Number(warmMs.toFixed(3)) },
    volatile: volatileRoute.routeCache,
    after: routeCacheStats(),
  }, null, 2));
}

function runAgentRosterTests() {
  const cases = [
    { id: "orchestration", task: "开启子代理，调用合适子代理优化 subagent-router 调度算法和调用速度", expectPrimary: ["architect-reviewer", "project-manager", "multi-agent-coordinator", "code-mapper"], expectImplementer: true },
    { id: "research-only", task: "开启子代理，只调研官方文档确认 OpenAI API 用法，不要改代码", expectPrimary: ["docs-researcher", "research-analyst", "code-mapper"], expectImplementer: false },
    { id: "release", task: "开启子代理，完善公开 GitHub README 发布说明和安装步骤", expectPrimary: ["documentation-engineer", "technical-writer", "github-expert"], expectImplementer: true },
    { id: "incident", task: "开启子代理，根据生产日志处理线上事故并准备回滚", expectPrimary: ["sre-engineer", "incident-responder", "debugger", "security-engineer"], expectImplementer: true },
  ];
  const results = [];
  for (const testCase of cases) {
    const route = routeTask(testCase.task, { candidateLimit: 8, noRouteCache: true });
    assert(route.agentRoster, `${testCase.id}: missing agentRoster`);
    assert(route.agentRoster.primary?.name, `${testCase.id}: missing primary roster agent`);
    assert(route.agentRoster.mapper?.sandboxMode === "read-only", `${testCase.id}: mapper must be read-only`);
    assert(route.agentRoster.validator?.name, `${testCase.id}: missing validator`);
    assert(route.agentRoster.reviewer?.name, `${testCase.id}: missing reviewer`);
    assert(route.agentRoster.fallbacks?.length > 0, `${testCase.id}: missing fallback candidates`);
    assert(testCase.expectPrimary.includes(route.agentRoster.primary.name) || testCase.expectPrimary.includes(route.recommended.name), `${testCase.id}: unexpected primary ${route.agentRoster.primary.name}`);
    if (testCase.expectImplementer) assert(route.agentRoster.implementer?.name, `${testCase.id}: expected implementer`);
    else assert(route.agentRoster.implementer === null, `${testCase.id}: no-write task should suppress implementer`);
    results.push({
      id: testCase.id,
      taskKind: route.agentRoster.taskKind,
      primary: route.agentRoster.primary.name,
      implementer: route.agentRoster.implementer?.name || null,
      warnings: route.agentRoster.warnings,
    });
  }
  const fallbackProbe = buildAgentRoster("开启子代理，完善 release 发布说明", {
    recommended: summarizeAgent(findAgentByName("documentation-engineer") || loadRegistry().agents[0]),
    candidates: [],
  }, { taskKind: "release-publishing", writeIntent: "expected" }, { requiresReview: true });
  assert(Array.isArray(fallbackProbe.missingPreferredAgents), "missingPreferredAgents must be an array");
  console.log(JSON.stringify({ pass: true, results, fallbackProbe: fallbackProbe.missingPreferredAgents }, null, 2));
}

function runManagedReadinessTests() {
  const ready = managedDelegationPlan(deterministicManagedResult("开启子代理，调用合适子代理，用 goal 模式持续实现"));
  assert(ready.delegationReadiness?.state === "ready", `expected ready state, got ${ready.delegationReadiness?.state}`);
  assert(ready.delegationReadiness.canSpawnNow, "ready managed plan should be spawnable");
  assert(ready.nextAction?.type === "spawn", `ready plan should spawn, got ${ready.nextAction?.type}`);
  assert(ready.stageSkillLoadingOrder.length === ready.goalLoop.length, "skill loading order should cover every stage");
  assert(ready.nextAction.skillsToLoad.every((skill) => ready.skills.includes(skill)), "nextAction skills must be selected skills");

  const vague = managedDelegationPlan(deterministicManagedResult("开启子代理，多代理帮我优化一下这个"));
  assert(vague.delegationReadiness.state === "clarify-first", `vague plan should clarify, got ${vague.delegationReadiness.state}`);
  assert(vague.nextAction.type === "ask-clarification", `vague next action should ask, got ${vague.nextAction.type}`);

  const blocked = managedDelegationPlan(runModelJudgement("开启子代理，审查当前 diff 里的生产鉴权漏洞", { offline: true, noCache: true }));
  assert(blocked.delegationReadiness.state === "parent-review-required", `blocked fallback should require parent review, got ${blocked.delegationReadiness.state}`);
  assert(blocked.nextAction.type === "parent-review", `blocked next action should parent-review, got ${blocked.nextAction.type}`);

  console.log(JSON.stringify({
    pass: true,
    ready: { state: ready.delegationReadiness.state, nextAction: ready.nextAction.type, stages: ready.stageSkillLoadingOrder.length },
    vague: { state: vague.delegationReadiness.state, nextAction: vague.nextAction.type },
    blocked: { state: blocked.delegationReadiness.state, nextAction: blocked.nextAction.type },
  }, null, 2));
}

function runCacheMaintenanceTests() {
  const originalJudgement = fs.existsSync(JUDGEMENT_CACHE_PATH) ? readText(JUDGEMENT_CACHE_PATH) : "";
  const originalRoute = fs.existsSync(ROUTE_CACHE_PATH) ? readText(ROUTE_CACHE_PATH) : "";
  try {
    fs.mkdirSync(path.dirname(JUDGEMENT_CACHE_PATH), { recursive: true });
    fs.mkdirSync(path.dirname(ROUTE_CACHE_PATH), { recursive: true });
    const oldDate = new Date(Date.now() - 72 * 36e5).toISOString();
    const freshDate = new Date().toISOString();
    fs.writeFileSync(JUDGEMENT_CACHE_PATH, `${JSON.stringify({ version: 1, entries: { old: { createdAt: oldDate, result: {} }, fresh: { createdAt: freshDate, result: {} } } }, null, 2)}\n`);
    fs.writeFileSync(ROUTE_CACHE_PATH, `${JSON.stringify({ version: 1, entries: { old: { createdAt: oldDate, result: {} }, fresh: { createdAt: freshDate, result: {} } }, stats: {} }, null, 2)}\n`);
    const before = cacheStatusReport();
    assert(before.judgementCache.entries === 2, "test judgement cache should have 2 entries");
    assert(before.routeCache.entries === 2, "test route cache should have 2 entries");
    const judgementCache = pruneCacheEntries(readJudgementCache(), 24);
    const routeCache = pruneCacheEntries(readJsonCache(ROUTE_CACHE_PATH), 24);
    writeJudgementCache(judgementCache);
    writeRouteCache(routeCache);
    const after = cacheStatusReport();
    assert(after.judgementCache.entries === 1, `expected 1 judgement entry after age prune, got ${after.judgementCache.entries}`);
    assert(after.routeCache.entries === 1, `expected 1 route entry after age prune, got ${after.routeCache.entries}`);
  } finally {
    if (originalJudgement) fs.writeFileSync(JUDGEMENT_CACHE_PATH, originalJudgement);
    else fs.rmSync(JUDGEMENT_CACHE_PATH, { force: true });
    if (originalRoute) fs.writeFileSync(ROUTE_CACHE_PATH, originalRoute);
    else fs.rmSync(ROUTE_CACHE_PATH, { force: true });
  }
  console.log(JSON.stringify({ pass: true, restored: true, status: cacheStatusReport() }, null, 2));
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
  assert(elapsed < 350, `routing tests took ${elapsed}ms, expected under 350ms`);
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
  assert(highRisk.delegationBlocked, "high-risk offline fallback must block delegation");
  assert(highRisk.approvalState === "required", `expected approvalState required, got ${highRisk.approvalState}`);
  assert(highRisk.executionPlan.mode === "parent-review-required", `expected parent-review-required mode, got ${highRisk.executionPlan.mode}`);
  assert(highRisk.handoffPlan.stages.length === 1 && highRisk.handoffPlan.stages[0].id === "parent-review", "high-risk fallback handoff must only contain parent-review");

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

  const originalSnapshot = fs.existsSync(SKILL_REGISTRY_SNAPSHOT_PATH) ? readText(SKILL_REGISTRY_SNAPSHOT_PATH) : "";
  fs.writeFileSync(SKILL_REGISTRY_SNAPSHOT_PATH, "{ bad json");
  clearSkillRegistryCaches();
  const rebuiltSkills = loadSkillRegistry();
  assert(rebuiltSkills.length > 0, "bad skill snapshot should recover by rebuilding registry");
  assert(skillSnapshotStats().readable, "rebuilt skill snapshot should be readable");
  if (originalSnapshot) fs.writeFileSync(SKILL_REGISTRY_SNAPSHOT_PATH, originalSnapshot);
  clearSkillRegistryCaches();

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
    snapshotRecovery: true,
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
    { id: "v10-project-optimize", task: "开启子代理，使用多智能体对当前项目做审查，确定几个优化方向，并持续迭代实现。", needsStage: ["map-current", "identify-failures", "validate", "review"], staged: true },
    { id: "v10-readonly-audit", task: "开启子代理，用多智能体只读审计当前项目的测试覆盖和架构风险，不要改代码。", needsStage: ["map-current", "identify-failures", "propose-strategy", "review"], noWrite: true },
    { id: "ambiguous", task: "开启子代理，帮我看看这个东西哪里不对", needsStage: ["clarify"], clarify: true },
  ];
  const results = [];
  for (const testCase of cases) {
    const route = routeTask(testCase.task, { candidateLimit: 8 });
    const result = attachRoutingMetadata({
      task: testCase.task,
      modelUsed: false,
      model: null,
      judgeMode: "deterministic",
      judgeModel: "none",
      costRationale: ["handoff test uses deterministic route without fallback"],
      candidateBudget: { agents: route.candidates.length, skills: route.suggestedSkills.length },
      cache: { hit: false, eligible: false },
      finalAgent: route.recommended.name,
      runtimeRole: route.recommended.runtimeRole,
      sandboxMode: route.recommended.sandboxMode,
      selectedSkills: route.suggestedSkills,
      selectedSkillsByPhase: route.selectedSkillsByPhase,
      importanceLevel: route.modelPolicy.importanceLevel,
      selectedModel: route.modelPolicy.selectedModel,
      reasoningEffort: route.modelPolicy.reasoningEffort,
      modelRationale: route.modelPolicy.modelRationale,
      taskProfile: route.taskProfile,
      executionPlan: route.executionPlan,
      confidence: route.confidence,
      needsParentChoice: route.needsParentChoice,
      rationale: route.reasons,
      riskNotes: [],
      deterministic: route,
    }, route, buildSkillCandidates(testCase.task, 18), computeJudgePolicy(testCase.task, route, { offline: true }));
    const stageIds = result.handoffPlan.stages.map((stage) => stage.id);
    for (const stage of testCase.needsStage) assert(stageIds.includes(stage), `${testCase.id}: missing handoff stage ${stage}; got ${stageIds.join(", ")}`);
    if (testCase.staged) assert(result.executionPlan.mode === "staged", `${testCase.id}: expected staged mode, got ${result.executionPlan.mode}`);
    if (testCase.noWrite) assert(!stageIds.includes("implement"), `${testCase.id}: read-only task must not include implement stage`);
    for (const stage of result.handoffPlan.stages) {
      assert(stage.agent, `${testCase.id}: stage ${stage.id} missing agent`);
      assert(stage.role, `${testCase.id}: stage ${stage.id} missing role`);
      assert(stage.sandboxMode, `${testCase.id}: stage ${stage.id} missing sandbox`);
      assert(stage.selectedModel, `${testCase.id}: stage ${stage.id} missing selectedModel`);
      assert(Array.isArray(stage.skills), `${testCase.id}: stage ${stage.id} skills must be array`);
      assert(stage.expectedOutput, `${testCase.id}: stage ${stage.id} missing expectedOutput`);
      assert(stage.acceptanceCriteria?.length, `${testCase.id}: stage ${stage.id} missing acceptanceCriteria`);
      if (["explore", "map-current", "identify-failures", "propose-strategy", "review"].includes(stage.id)) {
        assert(stage.role === "explorer", `${testCase.id}: ${stage.id} stage must use explorer role`);
        assert(stage.sandboxMode === "read-only", `${testCase.id}: ${stage.id} stage must be read-only`);
      }
      if (stage.id === "validate") {
        assert(stage.role === "worker", `${testCase.id}: validate stage must use worker role`);
        assert(stage.sandboxMode === "workspace-write", `${testCase.id}: validate stage must be workspace-write`);
      }
      if (stage.id === "implement") {
        assert(stage.role === "worker", `${testCase.id}: implement stage must use worker role`);
      }
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

function runSkillRepairTests() {
  const task = "现在使用多智能体子代理，去对我们项目进行审查优化，然后持续迭代。确定好几个大方向goal，写好详细的计划方案，然后使用goal模式去实现。";
  const route = routeTask(task, { candidateLimit: 8 });
  const allCandidates = buildSkillCandidates(task, 18);
  const truncatedCandidates = allCandidates.filter((skill) => skill.name !== "superpowers:writing-plans");
  const rawJudgement = {
    task,
    modelUsed: true,
    model: "gpt-5.5",
    judgeMode: "premium-judge",
    judgeModel: "gpt-5.5",
    costRationale: ["test"],
    candidateBudget: { agents: 8, skills: 18 },
    cache: { hit: false, eligible: false },
    finalAgent: route.recommended.name,
    runtimeRole: route.recommended.runtimeRole,
    sandboxMode: route.recommended.sandboxMode,
    selectedSkills: ["superpowers:writing-plans"],
    selectedSkillsByPhase: completeSkillPhases({ planning: ["superpowers:writing-plans", "non-selected-extra"] }),
    importanceLevel: "critical",
    selectedModel: "gpt-5.4-mini",
    reasoningEffort: "low",
    modelRationale: ["test attempted downgrade"],
    taskProfile: route.taskProfile,
    executionPlan: route.executionPlan,
    confidence: "high",
    needsParentChoice: false,
    rationale: ["test judgement"],
    riskNotes: [],
  };
  const { judgement } = validateJudgement(rawJudgement, route, truncatedCandidates);
  assert(judgement.selectedSkills.includes("superpowers:writing-plans"), "configured skill should be repaired into selectedSkills");
  assert(judgement.routingWarnings.some((warning) => warning.includes("superpowers:writing-plans")), "repair should emit routing warning");
  assert(judgement.selectedModel === "gpt-5.5", "critical policy should prevent model downgrade");
  assert(judgement.reasoningEffort === "high", "critical policy should require high reasoning");
  assert(judgement.selectedSkillsByPhase.planning.includes("superpowers:writing-plans"), "selected skill should project into planning phase");
  assert(!Object.values(judgement.selectedSkillsByPhase).flat().includes("non-selected-extra"), "phase map must not include unselected skills");

  const skillsTask = "开启子代理，请显式使用 skills 来规划并执行当前项目的优化。";
  const skillsRoute = routeTask(skillsTask, { candidateLimit: 8 });
  assert(skillsRoute.suggestedSkills.includes("superpowers:writing-plans"), "explicit skills route should include writing-plans");
  assert(skillsRoute.suggestedSkills.includes("superpowers:executing-plans"), "explicit skills route should include executing-plans");
  assert(skillsRoute.suggestedSkills.includes("superpowers:subagent-driven-development"), "explicit skills route should include subagent-driven-development");
  assert(skillsRoute.selectedSkillsByPhase.planning.includes("superpowers:writing-plans"), "writing-plans should be in planning phase");
  assert(skillsRoute.selectedSkillsByPhase.implementation.includes("superpowers:executing-plans"), "executing-plans should be in implementation phase");

  let invalidSkillFailed = false;
  try {
    validateJudgement({ ...rawJudgement, selectedSkills: ["not-a-real-skill"] }, route, truncatedCandidates);
  } catch (error) {
    invalidSkillFailed = classifyFailure(error.message) === "invalid-skill-subset";
  }
  assert(invalidSkillFailed, "unknown non-candidate skill should still fail");

  let invalidAgentFailed = false;
  try {
    validateJudgement({ ...rawJudgement, finalAgent: "not-a-real-agent" }, route, truncatedCandidates);
  } catch (error) {
    invalidAgentFailed = classifyFailure(error.message) === "invalid-agent-candidate";
  }
  assert(invalidAgentFailed, "non-candidate agent should still fail");

  const blockedFallback = runModelJudgement("开启子代理，审查当前 diff 里的生产鉴权漏洞", { offline: true, noCache: true });
  const blockedStageIds = blockedFallback.handoffPlan.stages.map((stage) => stage.id);
  assert(blockedFallback.delegationBlocked, "high-risk fallback should block delegation");
  assert(blockedFallback.approvalState === "required", "high-risk fallback should require approval");
  assert(blockedFallback.executionPlan.mode === "parent-review-required", "high-risk fallback should use parent-review-required mode");
  assert(blockedStageIds.includes("parent-review"), "blocked fallback should include parent-review stage");
  assert(!blockedStageIds.includes("implement") && !blockedStageIds.includes("primary"), "blocked fallback must not include executable worker stages");

  const report = {
    generatedAt: new Date().toISOString(),
    pass: true,
    repairedSkill: "superpowers:writing-plans",
    invalidSkillFailed,
    invalidAgentFailed,
    highRiskFallbackBlocked: true,
  };
  fs.mkdirSync(path.dirname(SKILL_REPAIR_RESULTS_PATH), { recursive: true });
  fs.writeFileSync(SKILL_REPAIR_RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
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
      else if (arg === "--verbose") mode = "verbose-json";
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
  if (command === "managed") {
    const mode = rest[0] === "--json" ? "json" : "text";
    const args = mode === "json" ? rest.slice(1) : rest;
    const task = args.join(" ").trim();
    if (!task) throw new Error("managed requires a task string");
    printManagedDelegation(runModelJudgement(task, { noCache: true }), mode);
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
  if (command === "test-performance") {
    runPerformanceTests();
    return;
  }
  if (command === "test-managed") {
    runManagedDelegationTests();
    return;
  }
  if (command === "test-managed-contract") {
    runManagedContractTests();
    return;
  }
  if (command === "test-skills-phase") {
    runSkillsPhaseTests();
    return;
  }
  if (command === "test-judge-matrix") {
    runJudgeMatrixTests();
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
  if (command === "test-skill-repair") {
    runSkillRepairTests();
    return;
  }
  if (command === "test-config") {
    runConfigTests();
    return;
  }
  if (command === "test-config-explain") {
    runConfigExplainTests();
    return;
  }
  if (command === "test-route-cache") {
    runRouteCacheTests();
    return;
  }
  if (command === "test-agent-roster") {
    runAgentRosterTests();
    return;
  }
  if (command === "test-managed-readiness") {
    runManagedReadinessTests();
    return;
  }
  if (command === "test-cache-maintenance") {
    runCacheMaintenanceTests();
    return;
  }
  if (command === "cache-status") {
    const mode = rest.includes("--json") ? "json" : "text";
    runCacheStatus(mode);
    return;
  }
  if (command === "cache-prune") {
    const mode = rest.includes("--json") ? "json" : "text";
    runCachePrune(rest.filter((arg) => arg !== "--json"), mode);
    return;
  }
  if (command === "config-check") {
    const mode = rest.includes("--json") ? "json" : "text";
    runConfigCheck(mode);
    return;
  }
  if (command === "config-explain") {
    const mode = rest[0] === "--json" ? "json" : "text";
    const args = mode === "json" ? rest.slice(1) : rest;
    const task = args.join(" ").trim();
    if (!task) throw new Error("config-explain requires a task string");
    runConfigExplain(task, mode);
    return;
  }
  if (command === "refresh-skills") {
    clearSkillRegistryCaches();
    const skills = scanSkillRegistry();
    writeSkillRegistrySnapshot(skills);
    console.log(`Refreshed ${skills.length} skills into ${SKILL_REGISTRY_SNAPSHOT_PATH}.`);
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
