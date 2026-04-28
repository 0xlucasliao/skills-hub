# Skills Hub

A community-curated registry of skills for BNB Chain agents. Each skill is submitted as a JSON manifest, automatically validated on PR, then enriched with owner info, a commit snapshot, and an AgentGuard security scan on merge.

---

## Skill Directory

| Skill | Category | Publisher | Stars | Security |
|-------|----------|-----------|-------|----------|
| [bnbchain skills](registry/skills/bnbchain-skills/skill.json) | infrastructure, blockchain | [bnb-chain](https://github.com/bnb-chain) | ⭐ 54 | ✅ safe |
| [Myriad Markets Skills](registry/skills/myriad-markets-skills/skill.json) | prediction-markets | [MyriadProtocol](https://github.com/MyriadProtocol) | ⭐ 4 | ⚠️ low |
| [QLWY Fortune Casting](registry/skills/qlwy-fortune/skill.json) | divination, nft, vrf | [qlwy-xyz](https://github.com/qlwy-xyz) | ⭐ 1 | ✅ safe |
| [Vibers Code Review](registry/skills/vibers-code-review/skill.json) | code-review, security | [marsiandeployer](https://github.com/marsiandeployer) | ⭐ 1 | ✅ safe |
| [BNB Skill Creator](registry/skills/bnb-skill-creator/skill.json) | skill-creation, github | [ternencescott](https://github.com/ternencescott) | ⭐ 0 | ✅ safe |

The machine-readable index is at [`registry/index.json`](registry/index.json).

---

## Repository Layout

```
registry/
  skills/
    <skill-id>/
      skill.json        ← versioned manifest (schema v1)
  index.json            ← auto-generated search index (do not edit)
schemas/
  skill.v1.schema.json  ← JSON Schema for skill manifests
scripts/
  validate-skill.js     ← PR validator (no external calls)
  publish-skill.js      ← post-merge enricher
.github/workflows/
  validate-skill.yml    ← read-only PR check
  publish-skill.yml     ← post-merge enrichment + index rebuild
  scope-guard.yml       ← blocks out-of-scope PR changes
```

---

## How It Works

```
Contributor opens PR
  └─ adds registry/skills/<skillname>/skill.json
        ├─ name
        ├─ github_url
        ├─ category
        └─ description
             ↓
validate-skill.yml (read-only, PR check)
  ├─ ✓ Validates required fields and format
  ├─ ✓ Posts advisory comment with results
  └─ ✓ Fails check if manifest is invalid
             ↓
Maintainer reviews and merges
             ↓
publish-skill.yml (write, runs on push to main)
  ├─ ✓ Fetches GitHub owner profile + repo metadata
  ├─ ✓ Snapshots latest commit SHA
  ├─ ✓ Calls AgentGuard API → injects security report
  ├─ ✓ Writes enriched manifest back to skill.json
  └─ ✓ Rebuilds registry/index.json
```

**Security model:** PR workflows are read-only — they can never write to the repository or operate on attacker-controlled input. Write access activates only after a human merge, on known-good code on `main`.

---

## Submit a Skill

See [CONTRIBUTING.md](CONTRIBUTING.md) — it takes about 2 minutes.
