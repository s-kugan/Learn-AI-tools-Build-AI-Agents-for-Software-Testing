// Downloads the Playwright HTML report from GitHub Actions into reports/run-<runId>/.
//
// Usage:
//   npm run report:download              # newest report
//   npm run report:download -- <runId>   # report from a specific run
//
// Auth: uses GITHUB_TOKEN if set, otherwise the GitHub login saved in git's credential manager.
//
// Node runs this file directly (type stripping), so it uses only erasable TypeScript syntax.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface Artifact {
  id: number;
  expired: boolean;
  created_at: string;
  archive_download_url: string;
  workflow_run: { id: number };
}

interface ArtifactList {
  artifacts: Artifact[];
}

const ARTIFACT_NAME = 'playwright-report';
const ROOT = path.resolve(import.meta.dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');

function git(args: string[], input?: string): string {
  return execFileSync('git', args, {
    cwd: ROOT,
    input,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

function getRepo(): string {
  const url = git(['remote', 'get-url', 'origin']);
  const match = url.match(/github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/);
  if (!match) throw new Error(`Remote "origin" is not a GitHub repo: ${url}`);
  return match[1];
}

function getToken(): string {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const out = git(['credential', 'fill'], 'protocol=https\nhost=github.com\n\n');
  const line = out.split('\n').find((l) => l.startsWith('password='));
  if (!line) throw new Error('No GitHub credential found. Set GITHUB_TOKEN or sign in to GitHub through git.');
  return line.slice('password='.length);
}

async function api(token: string, url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}: ${await res.text()}`);
  return res;
}

function unzip(zipPath: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('unzip', ['-oq', zipPath, '-d', destDir], { stdio: 'inherit' });
  }
}

async function main(): Promise<void> {
  const runId: string | undefined = process.argv[2];
  const repo = getRepo();
  const token = getToken();
  const base = `https://api.github.com/repos/${repo}`;

  const listUrl = runId
    ? `${base}/actions/runs/${runId}/artifacts?name=${ARTIFACT_NAME}`
    : `${base}/actions/artifacts?name=${ARTIFACT_NAME}&per_page=1`;
  const { artifacts } = (await (await api(token, listUrl)).json()) as ArtifactList;
  const artifact = artifacts.find((a) => !a.expired);
  if (!artifact) {
    throw new Error(
      runId ? `No unexpired "${ARTIFACT_NAME}" artifact in run ${runId}.` : `No unexpired "${ARTIFACT_NAME}" artifact found.`,
    );
  }

  const id = artifact.workflow_run.id;
  const destDir = path.join(REPORTS_DIR, `run-${id}`);
  const zipPath = path.join(REPORTS_DIR, `run-${id}.zip`);

  console.log(`Downloading report from run ${id} (${artifact.created_at})...`);
  const zip = await api(token, artifact.archive_download_url);
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(zipPath, Buffer.from(await zip.arrayBuffer()));

  unzip(zipPath, destDir);
  fs.rmSync(zipPath);

  const rel = path.relative(ROOT, destDir).replace(/\\/g, '/');
  console.log(`Saved to ${rel}`);
  console.log(`Open it with: npx playwright show-report ${rel}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
