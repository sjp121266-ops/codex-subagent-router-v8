# Subagent Router v6 Community Skills Test Report

## Summary

Router v6 imports curated open-source skills from GitHub and wires them into the GPT-5.5 routing judge.

## Sources

| Source | Repo | Imported |
|---|---|---:|
| OpenAI skills | https://github.com/openai/skills | 15 |
| Codex Spellbook | https://github.com/kid-sid/codex-spellbook | 37 |
| Matt Pocock skills | https://github.com/mattpocock/skills | 10 |
| jMerta Codex skills | https://github.com/jMerta/codex-skills | 12 |

Total imported community skills: 74

## Installed Artifacts

- Community skills manifest: `$HOME/.codex/subagents/community-skills-manifest.json`
- Import script: `$HOME/.codex/subagents/import-community-skills.mjs`
- Strategy config: `$HOME/.codex/subagents/strategy-config.json`
- Installed skill directories: `$HOME/.codex/skills/community-*`

## Strategy Updates

- Strategy config upgraded to version 2.
- Skill rules increased to 23.
- Strategy config references 56 community skills directly.
- Router gives imported community skills a source quality boost.
- GPT-5.5 receives community skills as normal skill candidates with source, phase, score, and flags.

## Verification

```bash
node --check $HOME/.codex/subagents/router.mjs
$HOME/.codex/subagents/router.mjs test
$HOME/.codex/subagents/router.mjs test-judge
$HOME/.codex/subagents/router.mjs judge --json "开启子代理，设计 OpenAI Responses API 调用封装"
```

## Results

- Community skills installed: 74
- Duplicate skill directory names: none
- Strategy config validation: passed
- Deterministic regression tests: 14/14 passed
- GPT-5.5 base smoke test: passed
- GPT-5.5 community skill scenario: passed

Real GPT-5.5 community scenario:

```json
{
  "modelUsed": true,
  "agent": "api-designer",
  "skills": [
    "openai-docs",
    "community-spellbook-openai-api",
    "community-spellbook-api-design",
    "agyb-full-stack-developer:api-patterns",
    "agyb-full-stack-developer:backend-dev-guidelines"
  ],
  "implementation": [
    "community-spellbook-openai-api",
    "openai-docs",
    "community-spellbook-api-design",
    "agyb-full-stack-developer:api-patterns",
    "agyb-full-stack-developer:backend-dev-guidelines"
  ],
  "mode": "single-agent"
}
```

## Scenario Coverage

| Task Type | Expected Community Skill Examples |
|---|---|
| React frontend | `community-spellbook-react`, `community-spellbook-frontend`, `community-spellbook-tailwind` |
| OpenAI API / agents | `community-spellbook-openai-api`, `community-spellbook-openai-agents`, `openai-docs` |
| PostgreSQL/database | `community-spellbook-postgresql`, `community-spellbook-database-design`, `community-spellbook-sqlalchemy` |
| Docker/CI/CD | `community-spellbook-docker`, `community-spellbook-ci-cd`, `community-spellbook-deployment-strategies` |
| Testing/TDD | `community-matt-tdd`, `community-spellbook-test-strategy`, `community-spellbook-unit-testing` |
| Architecture/planning | `community-spellbook-system-design`, `community-matt-improve-codebase-architecture`, `community-jmerta-plan-work` |

## Notes

- Imported skills are namespaced with `community-*` to avoid collisions.
- Each imported skill includes a source note with repo and commit.
- Manifest records source, commit, original name, installed name, path, and audit flags.
- Instructions from non-Codex ecosystems are adapted to Codex safety rules by an import note.
