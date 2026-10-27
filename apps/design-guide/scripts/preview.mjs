import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { preview } from 'vite';

const port = Number(process.argv[2] ?? 3007);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Expected a TCP port from 1 to 65535');
const server = await preview({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  build: { outDir: '.vitepress/dist' },
  preview: { host: '127.0.0.1', port, strictPort: true }
});
server.printUrls();
