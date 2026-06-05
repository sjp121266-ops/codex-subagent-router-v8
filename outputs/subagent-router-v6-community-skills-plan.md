# Subagent Router v6 Community Skills Plan

## Goal

Import high-quality open-source skills from GitHub into the local Codex skill pool, then make GPT-5.5 choose the best skills for each task through the router.

## Source Repositories

- `openai/skills`
  - Official OpenAI skill catalog and system/curated skill examples.
  - Use for official Figma, Linear, Notion, speech/transcription, security ownership, and Windows/.NET guidance not already present locally.

- `kid-sid/codex-spellbook`
  - Broad Codex-oriented engineering spellbook with domain-specific skills for backend, cloud, databases, testing, observability, AI agents, OpenAI API, and system design.

- `mattpocock/skills`
  - Strong engineering workflow skills for diagnosis, TDD, architecture improvement, PRD/issues, and domain-language thinking.

- `jMerta/codex-skills`
  - Codex-focused workflow skills for AGENTS.md, CI, PRs, release notes, dependency upgrades, docs sync, regex, and UI/UX.

## Import Strategy

- Clone source repositories into `/Users/sjp1212/.codex/subagents/skill-sources`.
- Install selected skills into `/Users/sjp1212/.codex/skills/community-*`.
- Rewrite skill frontmatter names to avoid collisions:
  - `community-openai-...`
  - `community-spellbook-...`
  - `community-matt-...`
  - `community-jmerta-...`
- Preserve original skill directories, bundled references, and scripts.
- Add an import note to each skill documenting source repo, commit, and original skill name.
- Generate `/Users/sjp1212/.codex/subagents/community-skills-manifest.json`.

## Router Strategy Changes

- Load the community skill manifest.
- Give imported skills a quality/source boost during metadata matching.
- Add strategy-config rules that directly reference high-value community skills by phase:
  - frontend and React
  - backend/API
  - security/review
  - cloud/deployment/devops
  - database/data
  - testing/QA
  - AI/OpenAI/agents
  - documentation/product/planning
  - workflow/git/CI
- Let GPT-5.5 choose from combined direct rules and metadata-matched community skills.

## Acceptance Criteria

- Community skills are installed without overwriting existing local skills.
- Manifest records source, commit, original name, installed name, and path.
- Router can discover imported community skills.
- Strategy config references community skills in direct rules.
- GPT-5.5 smoke test still passes.
- Regression tests cover community skill selection for OpenAI API, React, Docker, PostgreSQL, CI, and docs/research tasks.
