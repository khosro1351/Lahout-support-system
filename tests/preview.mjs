import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(new URL('../apps/frontend/package.json', import.meta.url));
const { preview } = await import(pathToFileURL(require.resolve('vite')).href);
await preview({ configFile:false, root:fileURLToPath(new URL('../apps/frontend',import.meta.url)), preview:{host:'127.0.0.1',port:Number(process.env.PREVIEW_PORT??5173),strictPort:true,proxy:{'/api':process.env.BACKEND_PROXY??'http://127.0.0.1:3000'}} });
