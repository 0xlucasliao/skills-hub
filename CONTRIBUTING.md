# Contributing to Skills Hub

Submitting a skill takes about 2 minutes. You create one directory with one JSON file — the rest is automated.

---

## Submission Format

Create a new directory under `registry/skills/` named with your skill's identifier (lowercase letters, digits, and hyphens only). Inside it, create `skill.json` with these four fields:

```json
{
  "name": "My Skill Name",
  "github_url": "https://github.com/owner/repo",
  "category": ["category1", "category2"],
  "description": "One or two sentences describing what this skill does and when to use it."
}
```

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | **Yes** | Display name (max 100 chars) |
| `github_url` | string | **Yes** | Public GitHub repository URL (`https://github.com/owner/repo`) |
| `category` | string[] | **Yes** | One or more tags, e.g. `["defi", "nft"]` |
| `description` | string | **Yes** | What it does; 10–500 characters |

> The directory name becomes the skill's permanent identifier.
> Example: `registry/skills/my-skill/skill.json` → identifier `my-skill`

### Optional: declare an interface

If your skill exposes a machine-readable invocation contract, add an `interface` block:

```json
{
  "name": "My Skill",
  "github_url": "https://github.com/owner/repo",
  "category": ["defi"],
  "description": "Does something useful on BNB Chain.",
  "interface": {
    "type": "mcp",
    "definition": {
      "name": "my_skill_tool",
      "description": "Tool description for the agent.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "address": { "type": "string", "description": "Wallet address" }
        },
        "required": ["address"]
      }
    }
  }
}
```

Supported `type` values: `"mcp"`, `"openai-function"`, `"rest"`.

---

## Steps

### 1. Fork & clone

```bash
git clone https://github.com/<your-username>/skills-hub
cd skills-hub
```

### 2. Create your skill directory and manifest

```bash
mkdir registry/skills/my-skill
```

```
registry/skills/my-skill/skill.json
```

### 3. Open a pull request

Push your branch and open a PR against `main`. Keep PRs to **one skill per submission**.

---

## What Happens Automatically

**On PR open** (`validate-skill.yml` — read-only):

The workflow validates your manifest and posts an advisory comment with the results. No external API calls are made at this stage.

**After merge** (`publish-skill.yml` — write):

The workflow enriches your manifest in-place and regenerates `registry/index.json`:

| Field | Source |
|-------|--------|
| `publisher.username` | GitHub API |
| `publisher.display_name` | GitHub API |
| `publisher.type` | GitHub API (`User` or `Organization`) |
| `publisher.profile_url` | GitHub API |
| `publisher.avatar_url` | GitHub API |
| `repo.stars` | GitHub API |
| `repo.default_branch` | GitHub API |
| `source.commit` | GitHub API (latest commit SHA) |
| `source.fetched_at` | Timestamp at time of enrichment |
| `security.agentguard_scan_id` | AgentGuard API |
| `security.agentguard_report_url` | AgentGuard API |
| `security.agentguard_result` | AgentGuard API |
| `published_at` | Timestamp at time of first publish |

---

## Schema

The full manifest schema is defined at [`schemas/skill.v1.schema.json`](schemas/skill.v1.schema.json).

---

## Guidelines

- **Public repos only** — private repositories cannot be validated
- **No duplicates** — check `registry/skills/` before submitting
- **One PR per skill** — keeps review focused
- **Lowercase IDs** — directory name must match `[a-z0-9][a-z0-9-]*[a-z0-9]`
