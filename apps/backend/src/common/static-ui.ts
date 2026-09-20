import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Only compiled public assets are served; API misses never become HTML.
export function registerStaticUi(server: FastifyInstance, directory: string) {
 const root = path.resolve(directory);
 const types: Record<string,string> = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
 server.get('/*', async (request, reply) => {
  let url: string;
  try { url = decodeURIComponent(request.url.split('?')[0]); } catch { return reply.code(400).send({error:'Invalid path'}); }
  if (url === '/api' || url.startsWith('/api/') || url.includes('\\') || url.split('/').some(p=>p.startsWith('.'))) return reply.code(404).send({error:'Not found'});
  if (url === '/robots.txt') return reply.type('text/plain').send('User-agent: *\nDisallow: /\n');
  const file = path.resolve(root, '.' + url);
  if (file !== root && !file.startsWith(root + path.sep)) return reply.code(404).send({error:'Not found'});
  const extension = path.extname(file);
  if (extension && !types[extension]) return reply.code(404).send({error:'Not found'});
  try {
   const target = extension ? file : path.join(root,'index.html');
   return reply.header('X-Robots-Tag','noindex, nofollow').type(types[extension || '.html']).send(await readFile(target));
  } catch { return reply.type('application/json').code(404).send({error:'Not found'}); }
 });
}
