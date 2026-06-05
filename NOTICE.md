# Third-Party Notices

This repository is an integration layer for Codex subagent routing. It references and indexes agent identities and skills from upstream open-source projects. Upstream content remains subject to the licenses and notices of those projects.

## Upstream Sources

| Source | Repository | How it is used |
| --- | --- | --- |
| VoltAgent Codex subagents | https://github.com/VoltAgent/awesome-codex-subagents | Source of Codex subagent role identities represented in `subagents/registry.json`. |
| OpenAI skills | https://github.com/openai/skills | Community skill metadata imported into `subagents/community-skills-manifest.json`. |
| Codex Spellbook | https://github.com/kid-sid/codex-spellbook | Community engineering skill metadata imported into the manifest. |
| Matt Pocock skills | https://github.com/mattpocock/skills | Community workflow skill metadata imported into the manifest. |
| jMerta Codex skills | https://github.com/jMerta/codex-skills | Community workflow skill metadata imported into the manifest. |

## License Boundary

The root `LICENSE` applies to original router code, documentation, and integration scripts in this repository unless a file states otherwise.

Generated snapshots, imported metadata, and upstream-derived skill or agent text may be governed by their upstream projects' licenses. Before redistributing this repository as a product package or bundling the imported content elsewhere, review the upstream repositories and preserve any required notices.

## Local Paths

Public snapshots use `$HOME` or relative paths instead of author-specific absolute paths. Runtime cache and local installation files are created under the user's own Codex home, normally `~/.codex`.
