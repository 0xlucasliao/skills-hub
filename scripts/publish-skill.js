#!/usr/bin/env node
/**
 * publish-skill.js
 *
 * Enriches registry/skills/<id>/skill.json manifests with live data from the
 * GitHub API and AgentGuard, then regenerates registry/index.json.
 *
 * Runs only on push to main (post-merge) — never in PR validation workflows.
 *
 * Usage:
 *   node scripts/publish-skill.js registry/skills/my-skill/skill.json [...]
 *
 * Environment variables:
 *   GITHUB_TOKEN        — GitHub token (avoids rate limits, recommended)
 *   AGENTGUARD_API_KEY  — AgentGuard API key (required for security scans)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTRY_DIR = path.resolve(__dirname, '../registry');
const INDEX_PATH   = path.join(REGISTRY_DIR, 'index.json');
const SCHEMA_REF   = '../../../schemas/skill.v1.schema.json';

// ---------------------------------------------------------------------------
// GitHub helpers
// ---------------------------------------------------------------------------

function githubHeaders() {
  return {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'skills-hub-publisher',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

async function githubGet(url) {
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} for ${url}: ${body}`);
  }
  return res.json();
}

function parseOwnerRepo(githubUrl) {
  const m = githubUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  if (!m) throw new Error(`Cannot parse owner/repo from: ${githubUrl}`);
  return { owner: m[1], repo: m[2] };
}

async function fetchRepoContent(owner, repo, defaultBranch) {
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers: githubHeaders() }
  );
  if (!treeRes.ok) return null;

  const tree = await treeRes.json();
  const candidates = (tree.tree ?? [])
    .filter(f => f.type === 'blob' && f.path.endsWith('.md'))
    .sort((a, b) => {
      const isRoot = p => /^[^/]+\.md$/i.test(p);
      return (isRoot(a.path) ? 0 : 1) - (isRoot(b.path) ? 0 : 1);
    })
    .slice(0, 5);

  if (!candidates.length) return null;

  const contents = await Promise.all(
    candidates.map(async f => {
      const raw = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${f.path}`
      );
      return raw.ok ? `### ${f.path}\n${await raw.text()}` : null;
    })
  );

  return contents.filter(Boolean).join('\n\n') || null;
}

// ---------------------------------------------------------------------------
// Core publish logic
// ---------------------------------------------------------------------------

async function publishSkill(filePath) {
  const abs     = path.resolve(filePath);
  const skillId = path.basename(path.dirname(abs));
  console.log(`\n→ Publishing: ${skillId}`);

  let submission;
  try {
    submission = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }

  const { name, github_url, category, description, interface: iface } = submission;
  if (!github_url)  throw new Error('Missing required field: github_url');
  if (!category)    throw new Error('Missing required field: category');
  if (!description) throw new Error('Missing required field: description');

  const { owner, repo } = parseOwnerRepo(github_url);

  console.log(`  Fetching repo metadata: ${owner}/${repo}`);
  const [repoData, ownerData, commits] = await Promise.all([
    githubGet(`https://api.github.com/repos/${owner}/${repo}`),
    githubGet(`https://api.github.com/users/${owner}`),
    githubGet(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`),
  ]);
  const latestCommit = commits[0]?.sha ?? null;

  // AgentGuard security scan
  let security = {
    agentguard_scan_id:    null,
    agentguard_report_url: null,
    agentguard_result:     null,
  };

  if (process.env.AGENTGUARD_API_KEY) {
    console.log('  Fetching repo content for security scan');
    const content = await fetchRepoContent(owner, repo, repoData.default_branch);

    if (!content) {
      console.warn('  ⚠ No scannable content found in repo — skipping AgentGuard');
    } else {
      console.log('  Calling AgentGuard API');
      try {
        const agRes = await fetch('https://agentguard.gopluslabs.io/api/v1/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.AGENTGUARD_API_KEY,
          },
          body: JSON.stringify({ content }),
        });

        if (agRes.ok) {
          const scan = (await agRes.json()).data ?? {};
          security = {
            agentguard_scan_id:    scan.scanId    ?? null,
            agentguard_report_url: scan.reportUrl ?? null,
            agentguard_result: {
              risk_score: scan.riskScore ?? null,
              risk_level: scan.riskLevel ?? null,
              verdict:    scan.verdict   ?? null,
              summary:    scan.summary   ?? null,
              threats:    scan.threats   ?? [],
            },
          };
          console.log(`  AgentGuard: ${scan.riskLevel ?? 'unknown'} (score: ${scan.riskScore ?? 'n/a'})`);
        } else {
          console.warn(`  ⚠ AgentGuard returned ${agRes.status} — skipping scan`);
        }
      } catch (err) {
        console.warn(`  ⚠ AgentGuard call failed: ${err.message} — skipping scan`);
      }
    }
  } else {
    console.warn('  ⚠ AGENTGUARD_API_KEY not set — skipping security scan');
  }

  const now = new Date().toISOString();

  const manifest = {
    $schema:       SCHEMA_REF,
    schemaVersion: '1',
    id:            skillId,
    name:          name ?? skillId,
    github_url:    repoData.html_url,
    category,
    description,
    ...(iface ? { interface: iface } : {}),
    publisher: {
      username:     ownerData.login,
      display_name: ownerData.name ?? ownerData.login,
      type:         ownerData.type,
      profile_url:  `https://github.com/${ownerData.login}`,
      avatar_url:   ownerData.avatar_url,
    },
    source: {
      commit:     latestCommit,
      fetched_at: now,
    },
    repo: {
      stars:          repoData.stargazers_count,
      default_branch: repoData.default_branch,
    },
    security,
    published_at: submission.published_at ?? now,
  };

  fs.writeFileSync(abs, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✓ Enriched: ${skillId}`);
  return manifest;
}

// ---------------------------------------------------------------------------
// Index generation — always rebuilds from all skill manifests on disk
// ---------------------------------------------------------------------------

function buildIndex(skillsDir) {
  if (!fs.existsSync(skillsDir)) {
    console.warn(`⚠ Skills directory not found: ${skillsDir}`);
    return;
  }

  const skills = [];
  for (const skillId of fs.readdirSync(skillsDir).sort()) {
    const manifestPath = path.join(skillsDir, skillId, 'skill.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      skills.push({
        id:           m.id ?? skillId,
        name:         m.name,
        description:  m.description,
        category:     m.category,
        github_url:   m.github_url,
        publisher:    m.publisher?.username ?? null,
        stars:        m.repo?.stars ?? 0,
        risk_level:   m.security?.agentguard_result?.risk_level ?? null,
        published_at: m.published_at ?? null,
      });
    } catch (err) {
      console.warn(`⚠ Could not parse ${manifestPath}: ${err.message} — skipping`);
    }
  }

  // Sort by stars descending, then name ascending
  skills.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''));

  const index = {
    generated_at: new Date().toISOString(),
    count:        skills.length,
    skills,
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
  console.log(`\n✓ registry/index.json updated (${skills.length} skills)`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (!args.length) {
  process.stderr.write('Usage: node scripts/publish-skill.js <registry/skills/id/skill.json> [...]\n');
  process.exit(1);
}

(async () => {
  let hasError = false;

  for (const fp of args) {
    try {
      await publishSkill(fp);
    } catch (err) {
      process.stderr.write(`✗ Failed [${fp}]: ${err.message}\n`);
      hasError = true;
    }
  }

  buildIndex(path.join(REGISTRY_DIR, 'skills'));
  process.exit(hasError ? 1 : 0);
})();
