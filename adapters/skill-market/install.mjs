#!/usr/bin/env node
/**
 * macs skill install — Claude Code skill installer
 *
 * Usage:
 *   node install.mjs <name>                    # install from registry
 *   node install.mjs github:<user>/<repo>      # install from GitHub
 *   node install.mjs github:<user>/<repo>#<branch>
 *
 * Installs to: <project-root>/.claude/skills/<name>/
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

const REGISTRY_URL =
  'https://raw.githubusercontent.com/hicccc77/macs-skill/main/skills/registry.json';

const projectRoot = process.env.MACS_PROJECT_DIR || process.cwd();
const skillsDir = path.join(projectRoot, '.claude', 'skills');

const args = process.argv.slice(2);
const subCmd = args[0];

// ==================== utils ====================

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'macs-skill-installer' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function fetchRegistry() {
  try {
    const buf = await httpsGet(REGISTRY_URL);
    return JSON.parse(buf.toString());
  } catch {
    // Fallback: try local registry next to this script
    const localPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'skills', 'registry.json');
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    }
    throw new Error('Could not fetch registry (network error) and no local fallback found.');
  }
}

/**
 * Download GitHub tarball and extract to targetDir.
 * Uses system `tar` (available on macOS, Linux, WSL).
 */
async function installFromGitHub(owner, repo, branch, installName) {
  const tarUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${branch}`;
  const targetDir = path.join(skillsDir, installName);

  console.log(`📦 Downloading ${owner}/${repo}@${branch}...`);
  const tarball = await httpsGet(tarUrl);

  // Write tarball to temp file
  const tmpFile = path.join(os.tmpdir(), `macs-skill-${Date.now()}.tar.gz`);
  fs.writeFileSync(tmpFile, tarball);

  // Create target directory
  fs.mkdirSync(targetDir, { recursive: true });

  // Extract: GitHub tarballs wrap content in a top-level `{repo}-{branch}/` dir
  // Use --strip-components=1 to remove that wrapper
  const result = spawnSync('tar', ['xzf', tmpFile, '-C', targetDir, '--strip-components=1'], {
    stdio: 'inherit',
  });

  fs.unlinkSync(tmpFile);

  if (result.status !== 0) {
    fs.rmdirSync(targetDir, { recursive: true });
    throw new Error('tar extraction failed');
  }

  return targetDir;
}

// ==================== commands ====================

async function cmdInstall(target) {
  if (!target) {
    console.error('Usage: macs skill install <name|github:user/repo[#branch]>');
    process.exit(1);
  }

  let owner, repo, branch, installName;

  if (target.startsWith('github:')) {
    // github:user/repo or github:user/repo#branch
    const ref = target.slice(7);
    const [repoPath, br] = ref.split('#');
    [owner, repo] = repoPath.split('/');
    branch = br || 'main';
    installName = repo;
  } else {
    // Look up in registry
    console.log('🔍 Looking up registry...');
    const registry = await fetchRegistry();
    const entry = registry.skills[target];
    if (!entry) {
      console.error(`❌ Skill "${target}" not found in registry.`);
      console.error(`   Try: macs skill search ${target}`);
      console.error(`   Or:  macs skill install github:<user>/<repo>`);
      process.exit(1);
    }
    [owner, repo] = entry.github.split('/');
    branch = entry.branch || 'main';
    installName = target;
    console.log(`✓ Found: ${entry.description}`);
  }

  const targetDir = path.join(skillsDir, installName);
  if (fs.existsSync(targetDir)) {
    console.error(`❌ Already installed: .claude/skills/${installName}/`);
    console.error(`   To reinstall, remove it first: rm -rf .claude/skills/${installName}`);
    process.exit(1);
  }

  await installFromGitHub(owner, repo, branch, installName);

  console.log(`✅ Installed: .claude/skills/${installName}/`);
  console.log(`\nNext steps:`);
  console.log(`  1. Restart Claude Code to pick up the new skill`);
  console.log(`  2. Trigger it with the slash command in SKILL.md`);
}

async function cmdList() {
  console.log('\n📦 MACS Skill Registry\n');
  const registry = await fetchRegistry();
  const skills = Object.entries(registry.skills);
  if (skills.length === 0) {
    console.log('  (empty)');
    return;
  }
  for (const [name, entry] of skills) {
    const installed = fs.existsSync(path.join(skillsDir, name)) ? ' ✅' : '';
    console.log(`  ${name.padEnd(20)} ${entry.description}${installed}`);
    console.log(`  ${''.padEnd(20)} by ${entry.author}  [${entry.tags.join(', ')}]`);
    console.log();
  }
  console.log(`Registry: ${REGISTRY_URL}`);
}

async function cmdSearch(keyword) {
  if (!keyword) {
    console.error('Usage: macs skill search <keyword>');
    process.exit(1);
  }
  const registry = await fetchRegistry();
  const kw = keyword.toLowerCase();
  const results = Object.entries(registry.skills).filter(([name, entry]) => {
    return (
      name.includes(kw) ||
      entry.description.toLowerCase().includes(kw) ||
      entry.tags.some((t) => t.includes(kw))
    );
  });

  if (results.length === 0) {
    console.log(`No skills found for "${keyword}"`);
    return;
  }

  console.log(`\nSearch results for "${keyword}":\n`);
  for (const [name, entry] of results) {
    const installed = fs.existsSync(path.join(skillsDir, name)) ? ' (installed)' : '';
    console.log(`  ${name}${installed}`);
    console.log(`    ${entry.description}`);
    console.log(`    github: ${entry.github}  tags: ${entry.tags.join(', ')}`);
    console.log();
  }
}

// ==================== main ====================

switch (subCmd) {
  case 'install':
    await cmdInstall(args[1]);
    break;
  case 'list':
    await cmdList();
    break;
  case 'search':
    await cmdSearch(args[1]);
    break;
  default:
    console.log('Usage:');
    console.log('  macs skill install <name>             # install from registry');
    console.log('  macs skill install github:user/repo   # install from GitHub');
    console.log('  macs skill list                       # list available skills');
    console.log('  macs skill search <keyword>           # search registry');
    break;
}
