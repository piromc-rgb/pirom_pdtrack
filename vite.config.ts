import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const DRIVE_FOLDER_PATH = 'G:\\.shortcut-targets-by-id\\1M-QDPilC7Nn-YW_5YxLQITUS6ZOYEyFm';

function findPdfRecursively(dir: string, regex: RegExp, results: { name: string; fullPath: string }[] = []) {
  try {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findPdfRecursively(fullPath, regex, results);
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
            const escaped = clean.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const regex = new RegExp(escaped.join('[-_\\s]*'), 'i');
            const matches = findPdfRecursively(DRIVE_FOLDER_PATH, regex);
            if (matches.length > 0) {
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

        server.middlewares.use('/api/drive-pdf-view', (req, res) => {
          try {
            const urlObj = new URL(req.url || '', 'http://localhost');
            const filePath = urlObj.searchParams.get('path') || '';
            if (!filePath || !filePath.startsWith(DRIVE_FOLDER_PATH) || !fs.existsSync(filePath)) {
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
      },
    },
  ],
  base: process.env.NODE_ENV === 'production' ? '/pirom_pdtrack/' : '/',
  server: {
    port: 3000,
    open: false
  }
});

