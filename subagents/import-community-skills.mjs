#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const HOME = process.env.HOME;
if (!HOME) throw new Error("HOME is required; set CODEX_HOME explicitly when running in a minimal environment.");
const CODEX_HOME = process.env.CODEX_HOME || path.join(HOME, ".codex");
const SOURCE_ROOT = path.join(CODEX_HOME, "subagents", "skill-sources");
const DEST_ROOT = path.join(CODEX_HOME, "skills");
const MANIFEST_PATH = path.join(CODEX_HOME, "subagents", "community-skills-manifest.json");

const SOURCES = {
  openai: {
    repo: "https://github.com/openai/skills.git",
    dir: "openai-skills",
    prefix: "community-openai",
    skills: [
      "skills/.curated/aspnet-core",
      "skills/.curated/figma",
      "skills/.curated/figma-code-connect-components",
      "skills/.curated/figma-create-design-system-rules",
      "skills/.curated/figma-generate-design",
      "skills/.curated/figma-implement-design",
      "skills/.curated/linear",
      "skills/.curated/notion-knowledge-capture",
      "skills/.curated/notion-meeting-intelligence",
      "skills/.curated/notion-research-documentation",
      "skills/.curated/notion-spec-to-implementation",
      "skills/.curated/security-ownership-map",
      "skills/.curated/speech",
      "skills/.curated/transcribe",
      "skills/.curated/winui-app"
    ],
  },
  spellbook: {
    repo: "https://github.com/kid-sid/codex-spellbook.git",
    dir: "codex-spellbook",
    prefix: "community-spellbook",
    skills: [
      "skills/api-design",
      "skills/aws",
      "skills/azure",
      "skills/caching",
      "skills/ci-cd",
      "skills/containerization",
      "skills/data-pipelines",
      "skills/database-design",
      "skills/deployment-strategies",
      "skills/docker",
      "skills/event-driven",
      "skills/fastapi",
      "skills/feature-flags",
      "skills/frontend",
      "skills/go",
      "skills/incident-response",
      "skills/infrastructure-as-code",
      "skills/integration-testing",
      "skills/langgraph",
      "skills/microservices",
      "skills/observability",
      "skills/openai-agents",
      "skills/openai-api",
      "skills/performance",
      "skills/postgresql",
      "skills/python",
      "skills/react",
      "skills/redis",
      "skills/security",
      "skills/sqlalchemy",
      "skills/system-design",
      "skills/tailwind",
      "skills/test-strategy",
      "skills/testing",
      "skills/typescript",
      "skills/unit-testing",
      "skills/websockets-sse"
    ],
  },
  matt: {
    repo: "https://github.com/mattpocock/skills.git",
    dir: "mattpocock-skills",
    prefix: "community-matt",
    skills: [
      "skills/engineering/diagnose",
      "skills/engineering/grill-with-docs",
      "skills/engineering/improve-codebase-architecture",
      "skills/engineering/prototype",
      "skills/engineering/tdd",
      "skills/engineering/to-issues",
      "skills/engineering/to-prd",
      "skills/engineering/triage",
      "skills/engineering/ubiquitous-language",
      "skills/in-progress/review",
      "skills/productivity/write-a-skill"
    ],
  },
  jmerta: {
    repo: "https://github.com/jMerta/codex-skills.git",
    dir: "jmerta-codex-skills",
    prefix: "community-jmerta",
    skills: [
      "agents-md",
      "bug-triage",
      "ci-fix",
      "coding-guidelines-gen",
      "coding-guidelines-verify",
      "dependency-upgrader",
      "docs-sync",
      "plan-work",
      "regex-builder",
      "release-notes",
      "ui-ux-pro-max",
      "vps-checkup"
    ],
  },
};

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function slug(text) {
  return text.toLowerCase().replace(/^["']|["']$/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return null;
  const body = match[1];
  const name = body.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const description = body.match(/^description:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  return { raw: match[0], body, name, description, rest: text.slice(match[0].length) };
}

function rewriteSkill(skillText, installedName, sourceInfo, originalName) {
  const parsed = parseFrontmatter(skillText);
  if (!parsed) throw new Error(`Missing frontmatter for ${sourceInfo.sourcePath}`);
  const description = parsed.description || `Imported community skill from ${sourceInfo.repo}`;
  const frontmatter = `---\nname: ${installedName}\ndescription: ${description} Imported community skill from ${sourceInfo.repo}; original skill: ${originalName}.\n---\n\n`;
  const note = `> Imported community skill. Source: ${sourceInfo.repo} @ ${sourceInfo.commit}. Original skill: ${originalName}. When instructions mention another agent platform, adapt the workflow to Codex tools and current workspace safety rules.\n\n`;
  return frontmatter + note + parsed.rest;
}

function dangerousFlags(text) {
  const checks = [
    ["destructive-rm", /rm\s+-rf|git\s+reset\s+--hard|git\s+clean\s+-fd/i],
    ["sudo", /\bsudo\b/i],
    ["curl-pipe-shell", /curl\b[\s\S]{0,80}\|\s*(bash|sh)|wget\b[\s\S]{0,80}\|\s*(bash|sh)/i],
    ["secret-handling", /api[_-]?key|secret|token|credential/i],
  ];
  return checks.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function gitCommit(root) {
  return execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
}

function install() {
  const installed = [];
  const skipped = [];

  for (const [sourceKey, source] of Object.entries(SOURCES)) {
    const root = path.join(SOURCE_ROOT, source.dir);
    if (!fs.existsSync(root)) {
      skipped.push({ source: sourceKey, reason: "source repository missing", root });
      continue;
    }
    const commit = gitCommit(root);
    for (const rel of source.skills) {
      const src = path.join(root, rel);
      const srcSkill = path.join(src, "SKILL.md");
      if (!fs.existsSync(srcSkill)) {
        skipped.push({ source: sourceKey, rel, reason: "SKILL.md missing" });
        continue;
      }
      const originalText = read(srcSkill);
      const parsed = parseFrontmatter(originalText);
      if (!parsed?.name) {
        skipped.push({ source: sourceKey, rel, reason: "frontmatter name missing" });
        continue;
      }
      const installedName = `${source.prefix}-${slug(parsed.name)}`;
      const dest = path.join(DEST_ROOT, installedName);
      copyDir(src, dest);
      const rewritten = rewriteSkill(originalText, installedName, { repo: source.repo, commit, sourcePath: rel }, parsed.name);
      write(path.join(dest, "SKILL.md"), rewritten);
      installed.push({
        source: sourceKey,
        repo: source.repo,
        commit,
        originalName: parsed.name,
        installedName,
        description: parsed.description || "",
        sourcePath: rel,
        installedPath: dest,
        flags: dangerousFlags(originalText),
      });
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: installed.length,
    skipped,
    installed,
  };
  write(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Installed ${installed.length} community skills.`);
  if (skipped.length) console.log(`Skipped ${skipped.length} entries.`);
  console.log(MANIFEST_PATH);
}

install();
