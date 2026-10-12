# claude-kit

My own Claude Code skills, plugins and mods. The repo is also a plugin marketplace named `vladdu`.

## Layout

```
.claude-plugin/marketplace.json   marketplace manifest; every plugin and mod is listed here
skills/<name>/SKILL.md            standalone skills, symlinked into ~/.claude/skills
plugins/<name>/                   plugins (.claude-plugin/plugin.json + skills/, commands/, agents/, hooks/)
mods/<name>/                      mods: plugins that change Claude Code's UI/behaviour (hooks/hooks.json -> modules)
```

## Mods

- `model-router`: picks Haiku, Sonnet or Opus from a conversation's first prompt and keeps it until `/clear`; `/router on|off`.
  ```
  /plugin install model-router --marketplace vladdu/claude-kit
  ```

## Skills

Create `skills/<name>/SKILL.md`, then link it:

```
ln -s ~/projects/claude-kit/skills/<name> ~/.claude/skills/<name>
```

## Plugins and mods

1. Scaffold: `claude plugin init <name>` and move the result to `plugins/<name>` or `mods/<name>`.
2. Add an entry to `.claude-plugin/marketplace.json`:
   ```json
   { "name": "<name>", "source": "./plugins/<name>", "description": "..." }
   ```
3. Validate: `claude plugin validate .`
4. Install: `claude plugin install <name>@vladdu`
5. After edits: `claude plugin marketplace update vladdu`, then `claude plugin update <name>@vladdu`.

Mod tests: `claude plugin test mods/<name>`.

## Marketplace registration

Install from GitHub (any machine):

```
claude plugin marketplace add vladdu/claude-kit
```

For development, register the local checkout instead, so edits are picked up without pushing:

```
claude plugin marketplace add ~/projects/claude-kit
```

This machine already uses the local checkout (`vladdu` -> `~/projects/claude-kit`).
