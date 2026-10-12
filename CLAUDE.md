# claude-kit

Personal Claude Code skills, plugins and mods. Marketplace name: `vladdu`.

- Standalone skills: `skills/<name>/SKILL.md`. Not in marketplace.json.
- Plugins: `plugins/<name>/`. Mods: `mods/<name>/`. Each must have an entry in `.claude-plugin/marketplace.json` with `source: "./plugins/<name>"` or `"./mods/<name>"`.
- Run `claude plugin validate .` after any manifest change.
- Mod tests: `claude plugin test mods/<name>`.
