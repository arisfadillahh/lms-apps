import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../..');
export default {
  root,
  publicDir: path.join(repo, 'public'),
  resolve: { alias: { 'next/image': path.join(root, 'image.tsx'), 'next/navigation':path.join(root,'navigation.ts'), '@': path.join(repo, 'src') } },
  plugins:[{
    name:'official-software-logo-qa',
    configureServer(server) {
      server.middlewares.use(async (req,res,next) => {
        if (!req.url?.startsWith('/api/software/logos/')) return next();
        try {
          const { GET } = await server.ssrLoadModule(path.join(repo,'src/app/api/software/logos/[brand]/route.ts'));
          const brand = new URL(req.url,'http://localhost').pathname.split('/').at(-1);
          const result = await GET(new Request('http://localhost'+req.url),{params:Promise.resolve({brand})});
          res.statusCode=result.status;
          result.headers.forEach((value,key)=>res.setHeader(key,value));
          res.end(Buffer.from(await result.arrayBuffer()));
        } catch { res.statusCode=500;res.end(); }
      });
    },
  }],
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 4175, strictPort: true, fs: { allow: [repo] } },
};
