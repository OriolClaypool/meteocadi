// Commits al repositori des de les funcions (Git Data API de GitHub): un sol commit amb diversos fitxers a la branca
// principal, amb el GITHUB_TOKEN de Vercel (fine-grained, Contents read/write, només aquest repositori). L'arxiu de la
// nit (api/arxiva.js) en té una còpia pròpia: aquest fitxer és per a l'arxiu del radar (api/_pluja-dia.js).
const REPO = 'OriolClaypool/meteocadi';
const BRANCH = 'main';
const API = 'https://api.github.com';

export const githubToken = () => (process.env.GITHUB_TOKEN || '').trim().replace(/^["']|["']$/g, '');

async function gh(method, path, token, body) {
  const res = await fetch(`${API}/repos/${REPO}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const err = await res.text();
    const e = new Error(`GitHub ${method} ${path} → ${res.status}: ${err.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

// El fitxer ja és a la branca principal?
export async function fileExists(path, token) {
  const res = await fetch(`${API}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`GitHub GET ${path} → ${res.status}`);
  return true;
}

// files: { camí: contingut en text }. Si mentrestant hi ha un altre commit, es torna a provar sobre el nou.
export async function commitFiles(files, message, token) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await gh('GET', `/git/ref/heads/${BRANCH}`, token);
    const parent = ref.object.sha;
    const base = await gh('GET', `/git/commits/${parent}`, token);
    const tree = await gh('POST', '/git/trees', token, {
      base_tree: base.tree.sha,
      tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
    });
    const commit = await gh('POST', '/git/commits', token, { message, tree: tree.sha, parents: [parent] });
    try {
      await gh('PATCH', `/git/refs/heads/${BRANCH}`, token, { sha: commit.sha, force: false });
      return commit.sha;
    } catch (e) {
      if (e.status !== 422 || attempt === 2) throw e;
    }
  }
}

// Només el cron de Vercel (o qui tingui el CRON_SECRET): com api/arxiva.js
export function cronOk(req) {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (secret) return (req.headers['authorization'] ?? '') === `Bearer ${secret}`;
  return !!req.headers['x-vercel-cron-schedule'] || String(req.headers['user-agent'] || '').startsWith('vercel-cron');
}
