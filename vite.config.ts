import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const DRIVE_ROOT_PATHS = [
  'G:\\.shortcut-targets-by-id\\1M-QDPilC7Nn-YW_5YxLQITUS6ZOYEyFm',
  'G:\\My Drive\\staus overview\\dwg',
];

function extractRevNum(fileName: string): number {
  const match = fileName.match(/rev\.?\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

function findPdfRecursively(dir: string, regex: RegExp, results: { name: string; fullPath: string }[] = [], visited = new Set<string>()) {
  try {
    if (!fs.existsSync(dir)) return results;
    const realPath = fs.realpathSync(dir);
    if (visited.has(realPath)) return results;
    visited.add(realPath);

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findPdfRecursively(fullPath, regex, results, visited);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        if (regex.test(entry.name)) {
          results.push({ name: entry.name, fullPath });
        }
      }
    }
  } catch {
    // ignore permission or missing dir errors
  }
  return results;
}

// โฟลเดอร์ Google Drive (Drive for desktop) ที่ใช้ scan หาไฟล์ล่าสุดอัตโนมัติ
const LATEST_FILE_SOURCES: Record<string, { dir: string; match: (name: string) => boolean }> = {
  overview: {
    dir: 'G:\\My Drive\\staus overview',
    match: n => /status overview/i.test(n),
  },
  po: {
    dir: 'G:\\My Drive\\Purchase Data',
    match: n => /report po/i.test(n),
  },
};

// วันที่ในชื่อไฟล์ (yy-mm-dd หรือ dd-mm-yy สำหรับ PO) ใช้จัดลำดับ ถ้าไม่มีให้ใช้เวลาแก้ไขไฟล์
function fileSortKey(name: string, mtimeMs: number, kind: string): number {
  const m = name.match(/(\d{2,4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const c = parseInt(m[3], 10);
    let y = kind === 'po' ? c : a;
    const d = kind === 'po' ? a : c;
    if (y >= 2500) y -= 543;
    else if (y < 100) y += 2000;
    const t = new Date(y, b - 1, d).getTime();
    if (!isNaN(t)) return t;
  }
  return mtimeMs;
}

function findLatestFile(kind: string): { name: string; fullPath: string; mtimeMs: number } | null {
  const src = LATEST_FILE_SOURCES[kind];
  if (!src || !fs.existsSync(src.dir)) return null;
  const files = fs
    .readdirSync(src.dir)
    .filter(n => n.toLowerCase().endsWith('.xlsx') && !n.startsWith('~$') && src.match(n))
    .map(n => {
      const fullPath = path.join(src.dir, n);
      return { name: n, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    });
  if (files.length === 0) return null;
  files.sort(
    (x, y) => fileSortKey(y.name, y.mtimeMs, kind) - fileSortKey(x.name, x.mtimeMs, kind) || y.mtimeMs - x.mtimeMs
  );
  return files[0];
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'drive-pdf-middleware',
      configureServer(server) {
        server.middlewares.use('/api/drive-pdf-search', (req, res) => {
          try {
            const urlObj = new URL(req.url || '', 'http://localhost');
            const rawCode = (urlObj.searchParams.get('code') || '').trim();
            const clean = rawCode.replace(/[-\s_]/g, '').toUpperCase();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            if (!clean) {
              res.end(JSON.stringify({ found: false }));
              return;
            }
            const escaped = clean.split('').map(c => {
              if (c === '0' || c === 'O') return '[0O]';
              return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            });
            const regex = new RegExp(escaped.join('[-_\\s]*'), 'i');

            const matches: { name: string; fullPath: string }[] = [];
            for (const rootPath of DRIVE_ROOT_PATHS) {
              findPdfRecursively(rootPath, regex, matches);
            }

            if (matches.length > 0) {
              // Pick highest revision first
              matches.sort((a, b) => extractRevNum(b.name) - extractRevNum(a.name));
              const best = matches[0];
              res.end(
                JSON.stringify({
                  found: true,
                  name: best.name,
                  url: `/api/drive-pdf-view?path=${encodeURIComponent(best.fullPath)}`,
                })
              );
              return;
            }
            res.end(JSON.stringify({ found: false }));
          } catch {
            res.statusCode = 500;
            res.end(JSON.stringify({ found: false }));
          }
        });

        // scan โฟลเดอร์ Drive หาไฟล์ .xlsx ล่าสุด: ?kind=overview|po  (&meta=1 = ส่งเฉพาะชื่อ/เวลา ไม่ส่งไฟล์)
        server.middlewares.use('/api/latest-file', (req, res) => {
          try {
            const urlObj = new URL(req.url || '', 'http://localhost');
            const kind = urlObj.searchParams.get('kind') || '';
            const latest = findLatestFile(kind);
            if (!latest) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ found: false }));
              return;
            }
            if (urlObj.searchParams.get('meta')) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ found: true, name: latest.name, mtime: latest.mtimeMs }));
              return;
            }
            res.setHeader('Content-Type', 'application/octet-stream');
            res.end(fs.readFileSync(latest.fullPath));
          } catch {
            res.statusCode = 500;
            res.end(JSON.stringify({ found: false }));
          }
        });

        server.middlewares.use('/api/drive-pdf-view', (req, res) => {
          try {
            const urlObj = new URL(req.url || '', 'http://localhost');
            const filePath = urlObj.searchParams.get('path') || '';
            const isAllowed = DRIVE_ROOT_PATHS.some(root => filePath.startsWith(root));
            if (!filePath || !isAllowed || !fs.existsSync(filePath) || !filePath.toLowerCase().endsWith('.pdf')) {
              res.statusCode = 404;
              res.end('PDF file not found');
              return;
            }
            const fileName = path.basename(filePath);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
            fs.createReadStream(filePath).pipe(res);
          } catch {
            res.statusCode = 500;
            res.end('Error reading PDF file');
          }
        });

        server.middlewares.use('/api/drive-pdf-refresh', async (req, res) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          try {
            const { execSync } = await import('child_process');
            execSync('python scripts/sync_dwg_index.py', { cwd: process.cwd(), timeout: 15000 });
            const indexPath = path.join(process.cwd(), 'src', 'data', 'drivePdfIndex.json');
            const content = fs.readFileSync(indexPath, 'utf-8');
            const items = JSON.parse(content);
            res.end(JSON.stringify({ success: true, count: items.length, items }));
          } catch (err: any) {
            console.error('Error refreshing DWG index:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err?.message || 'Error running sync' }));
          }
        });
      },
    },
  ],
  base: process.env.NODE_ENV === 'production' ? '/pirom_pdtrack/' : '/',
  server: {
    port: 3000,
    open: false
  }
});

