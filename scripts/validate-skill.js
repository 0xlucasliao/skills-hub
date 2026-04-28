#!/usr/bin/env node
/**
 * validate-skill.js
 *
 * Validates registry/skills/<id>/skill.json files against the skill.v1 schema rules.
 * Used by the PR validation workflow — no external API calls, no write access needed.
 *
 * Usage:
 *   node scripts/validate-skill.js registry/skills/my-skill/skill.json [...]
 *
 * Exit codes:
 *   0  all files passed
 *   1  one or more files failed validation
 *
 * Stdout: JSON array of result objects (one per file).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const GITHUB_URL_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+$/;
const SKILL_ID_RE   = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

function validate(filePath) {
  const abs     = path.resolve(filePath);
  const skillId = path.basename(path.dirname(abs));
  const errors  = [];
  const warnings = [];

  // Parse JSON
  let data;
  try {
    data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    return { ok: false, skillId, filePath, errors: [`Invalid JSON: ${err.message}`], warnings: [] };
  }

  // Required fields
  if (!data.name)        errors.push('Missing required field: name');
  if (!data.github_url)  errors.push('Missing required field: github_url');
  if (!data.category)    errors.push('Missing required field: category');
  if (!data.description) errors.push('Missing required field: description');

  // github_url format
  if (data.github_url && !GITHUB_URL_RE.test(data.github_url)) {
    errors.push(`github_url must be https://github.com/owner/repo — got: ${data.github_url}`);
  }

  // category must be non-empty array of strings
  if (data.category !== undefined) {
    if (!Array.isArray(data.category) || data.category.length === 0) {
      errors.push('category must be a non-empty array of strings');
    } else if (data.category.some(c => typeof c !== 'string' || !c.trim())) {
      errors.push('All category entries must be non-empty strings');
    }
  }

  // description length
  if (data.description) {
    if (data.description.length < 10) {
      errors.push(`description is too short (${data.description.length} chars, minimum 10)`);
    }
    if (data.description.length > 500) {
      errors.push(`description is too long (${data.description.length} chars, maximum 500)`);
    }
  }

  // name length
  if (data.name) {
    if (data.name.length > 100) {
      errors.push(`name is too long (${data.name.length} chars, maximum 100)`);
    }
  }

  // Directory name must be a valid skill ID
  if (!SKILL_ID_RE.test(skillId)) {
    errors.push(`Directory name "${skillId}" is not a valid skill ID (lowercase letters, digits, hyphens; no leading/trailing hyphens)`);
  }

  // If id is set, it must match directory name
  if (data.id !== undefined && data.id !== skillId) {
    errors.push(`id field "${data.id}" does not match directory name "${skillId}"`);
  }

  // Warn about enriched fields present in submissions (not an error — publish workflow sets them)
  if (data.publisher)    warnings.push('publisher will be overwritten by publish workflow');
  if (data.source)       warnings.push('source will be overwritten by publish workflow');
  if (data.security)     warnings.push('security will be overwritten by publish workflow');
  if (data.published_at) warnings.push('published_at will be overwritten by publish workflow');

  // interface validation (optional but if present must have type)
  if (data.interface !== undefined) {
    if (typeof data.interface !== 'object' || !data.interface.type) {
      errors.push('interface must be an object with a "type" field ("mcp", "openai-function", or "rest")');
    } else if (!['mcp', 'openai-function', 'rest'].includes(data.interface.type)) {
      errors.push(`interface.type "${data.interface.type}" is not valid — must be "mcp", "openai-function", or "rest"`);
    }
  }

  return { ok: errors.length === 0, skillId, filePath, errors, warnings };
}

const args = process.argv.slice(2);
if (!args.length) {
  process.stderr.write('Usage: node scripts/validate-skill.js <registry/skills/id/skill.json> [...]\n');
  process.exit(1);
}

let hasFailure = false;
const results  = [];

for (const fp of args) {
  const result = validate(fp);
  results.push(result);
  if (!result.ok) hasFailure = true;
}

process.stdout.write(JSON.stringify(results, null, 2) + '\n');
process.exit(hasFailure ? 1 : 0);
