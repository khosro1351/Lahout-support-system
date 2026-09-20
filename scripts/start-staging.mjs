import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
if(process.env.APP_ENV!=='staging')throw new Error('This launcher is staging-only');
const origin=process.env.FRONTEND_ORIGIN || process.env.RENDER_EXTERNAL_URL;
if(!origin?.startsWith('https://'))throw new Error('An HTTPS staging origin is required');
Object.assign(process.env,{FRONTEND_ORIGIN:origin,BACKEND_HOST:'0.0.0.0',BACKEND_PORT:process.env.PORT||'10000',COOKIE_SECURE:'true',STATIC_UI_DIR:path.join(root,'apps/frontend/dist')});
process.chdir(path.join(root,'apps/backend'));
await import(pathToFileURL(path.join(root,'apps/backend/dist/main.js')).href);
