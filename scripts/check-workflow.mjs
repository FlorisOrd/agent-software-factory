#!/usr/bin/env node
// Static installation check. Live delegation and delivery readiness require
// independent session and commit-specific evidence; this script cannot prove them.
import { readFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillPath = '.agents/skills/factory-delivery/SKILL.md';

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
}

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function checkLocalLinks(path) {
  for (const match of read(path).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^https:\/\//.test(target) || target.startsWith('#')) continue;
    const destination = resolve(root, dirname(path), target.split('#')[0]);
    const localPath = relative(root, destination);
    requireThat(localPath !== '..' && !localPath.startsWith('..\\') && !localPath.startsWith('../'), `${path}: link escapes the repository`);
    read(localPath);
  }
}

try {
  const instructions = read('AGENTS.md');
  requireThat(instructions.includes(`](${skillPath})`), 'AGENTS.md must link to the installed delivery skill');

  const skill = read(skillPath);
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);
  requireThat(frontmatter, `${skillPath}: missing frontmatter or skill body`);
  const fields = new Map();
  // This installation intentionally uses only two single-line plain YAML scalars.
  // Reject unsupported syntax rather than claiming to be a general YAML parser.
  for (const line of frontmatter[1].split('\n')) {
    const entry = line.match(/^(name|description): ([A-Za-z0-9][A-Za-z0-9 .,;()/-]*)$/);
    requireThat(entry, `${skillPath}: unsupported frontmatter syntax`);
    requireThat(!fields.has(entry[1]), `${skillPath}: duplicate ${entry[1]}`);
    fields.set(entry[1], entry[2]);
  }
  requireThat(fields.get('name') === 'factory-delivery', 'Skill name must match its installed directory');
  requireThat(Boolean(fields.get('description')?.trim()), 'Skill description is required for discovery');

  for (const path of ['AGENTS.md', skillPath, 'README.md', 'docs/ASF-MVP-01.md']) checkLocalLinks(path);
  console.log('PASS: root instruction route, installed skill frontmatter and local document links.');
  console.log('Static configuration/discovery structure only. Native loading, delegation, review and readiness are not established by this check.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
