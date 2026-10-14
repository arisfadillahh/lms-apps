import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../..');
export default {
  root,
  publicDir: path.join(repo, 'public'),
  resolve: { alias: { 'next/image': path.join(root, 'image.tsx'), '@': path.join(repo, 'src') } },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 4175, strictPort: true, fs: { allow: [repo] } },
};
