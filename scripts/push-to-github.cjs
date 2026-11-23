/**
 * NovaPulse CRM - Automated GitHub Push Script
 * 
 * Synchronizes workspace changes (frontend/src, apps-script, scripts)
 * with the deployment repository and pushes to GitHub main branch.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

function getGitHubToken() {
  if (process.env.GITHUB_PAT && process.env.GITHUB_PAT.trim()) {
    return process.env.GITHUB_PAT.trim();
  }
  // Check user home directory
  const homePat = path.join(os.homedir(), '.github_pat');
  if (fs.existsSync(homePat)) {
    return fs.readFileSync(homePat, 'utf8').trim();
  }
  // Check local .git_credentials
  const credPath = path.join(__dirname, '..', '.git_credentials');
  if (fs.existsSync(credPath)) {
    return fs.readFileSync(credPath, 'utf8').trim();
  }
  throw new Error('GitHub PAT not found. Please set GITHUB_PAT or create ~/.github_pat');
}

const GITHUB_USER = 'novapulse1';
const REPO_DIR = path.resolve('C:/Users/Admin/Desktop/novapulse_git');
const WORKSPACE_DIR = path.resolve(__dirname, '..');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function syncAndPush(commitMessage = 'chore: sync and update recruitment crm') {
  const token = getGitHubToken();
  console.log('--- NovaPulse CRM Git Push ---');
  console.log(`Workspace: ${WORKSPACE_DIR}`);
  console.log(`Git Repo:  ${REPO_DIR}`);

  // 1. Sync frontend/src -> src
  const frontendSrc = path.join(WORKSPACE_DIR, 'frontend', 'src');
  const targetSrc = path.join(REPO_DIR, 'src');
  if (fs.existsSync(frontendSrc)) {
    console.log('Syncing frontend/src -> src...');
    copyRecursiveSync(frontendSrc, targetSrc);
  }

  // 2. Sync apps-script -> apps-script & root .gs
  const appsScriptSrc = path.join(WORKSPACE_DIR, 'apps-script');
  const targetAppsScript = path.join(REPO_DIR, 'apps-script');
  if (fs.existsSync(appsScriptSrc)) {
    console.log('Syncing apps-script -> apps-script & root...');
    copyRecursiveSync(appsScriptSrc, targetAppsScript);
    const files = fs.readdirSync(appsScriptSrc);
    for (const f of files) {
      if (f.endsWith('.gs') || f === 'appsscript.json') {
        fs.copyFileSync(path.join(appsScriptSrc, f), path.join(REPO_DIR, f));
      }
    }
  }

  // 3. Sync scripts
  const scriptsSrc = path.join(WORKSPACE_DIR, 'scripts');
  const targetScripts = path.join(REPO_DIR, 'scripts');
  if (fs.existsSync(scriptsSrc)) {
    copyRecursiveSync(scriptsSrc, targetScripts);
  }

  // 4. Sync DEPLOYMENT_GUIDE.md if present
  const guideSrc = path.join(WORKSPACE_DIR, 'DEPLOYMENT_GUIDE.md');
  if (fs.existsSync(guideSrc)) {
    fs.copyFileSync(guideSrc, path.join(REPO_DIR, 'DEPLOYMENT_GUIDE.md'));
  }

  // 5. Stage files in git
  console.log('Staging files...');
  const statusMatrix = await git.statusMatrix({ fs, dir: REPO_DIR });
  let changesCount = 0;

  for (const [filepath, head, workdir, stage] of statusMatrix) {
    if (filepath.startsWith('node_modules') || filepath.startsWith('dist') || filepath.startsWith('frontend/node_modules')) {
      continue;
    }
    if (workdir === 0) {
      await git.remove({ fs, dir: REPO_DIR, filepath });
      changesCount++;
    } else if (workdir !== stage || head !== workdir) {
      await git.add({ fs, dir: REPO_DIR, filepath });
      changesCount++;
    }
  }

  if (changesCount === 0) {
    console.log('No new changes to commit. Repository is clean and up-to-date.');
    return;
  }

  console.log(`Staged ${changesCount} changed/new files.`);

  // 6. Commit
  const msg = process.argv[2] || commitMessage;
  console.log(`Committing with message: "${msg}"...`);
  const commitSha = await git.commit({
    fs,
    dir: REPO_DIR,
    message: msg,
    author: {
      name: 'NovaPulse Team',
      email: 'novapulse739@gmail.com'
    }
  });
  console.log(`Committed: ${commitSha}`);

  // 7. Push
  console.log('Pushing to GitHub main branch...');
  const pushRes = await git.push({
    fs,
    http,
    dir: REPO_DIR,
    remote: 'origin',
    ref: 'main',
    onAuth: () => ({
      username: GITHUB_USER,
      password: token
    })
  });

  if (pushRes.ok) {
    console.log('Successfully pushed to GitHub! Vercel auto-deployment triggered.');
  } else {
    console.error('Push completed with warnings/errors:', pushRes);
  }
}

if (require.main === module) {
  syncAndPush().catch(err => {
    console.error('Push script error:', err);
    process.exit(1);
  });
}

module.exports = { syncAndPush };
