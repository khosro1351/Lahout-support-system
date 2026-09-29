import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,unlinkSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {parseEnv} from 'node:util';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'.local','mobile'),stateFile=path.join(dir,'state.json');
const mode=process.argv[2]??'status';
const env={...parseEnv(readFileSync(path.join(root,'.env'),'utf8')),...process.env};
const cfgFile=path.join(root,'.env.lan');
if(existsSync(cfgFile))Object.assign(env,parseEnv(readFileSync(cfgFile,'utf8')));
const addresses=Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address));
const nic=addresses.find(x=>x.address===env.LAN_ADDRESS)??(!env.LAN_ADDRESS&&addresses.length===1?addresses[0]:null);
const port=Number(env.LAN_PORT??5175),upstream=new URL(env.FRONTEND_ORIGIN);
if(!['localhost','127.0.0.1'].includes(upstream.hostname)||upstream.protocol!=='http:'||!['development','test'].includes(env.APP_ENV??'development'))throw Error('LAN requires the existing local HTTP development server.');
const ipv4=s=>s.split('.').reduce((n,v)=>(n*256+Number(v))>>>0,0);
async function state(){try{const s=JSON.parse(readFileSync(stateFile,'utf8'));const r=await fetch(s.url+'/_local/lan-status',{signal:AbortSignal.timeout(1500)});const b=await r.json();return b.instance===s.instance?s:null;}catch{return null;}}
if(mode==='serve'){
 if(!nic||!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose one private LAN_ADDRESS and a valid LAN_PORT in .env.lan.');
 const url='http://'+nic.address+':'+port,instance=crypto.randomUUID();
 const server=http.createServer((req,res)=>{
  const remote=req.socket.remoteAddress?.replace('::ffff:','')??'';
  if(req.headers.host!==nic.address+':'+port||(ipv4(remote)&ipv4(nic.netmask))!==(ipv4(nic.address)&ipv4(nic.netmask))){res.writeHead(403).end('Local network only');return;}
  if(req.url==='/_local/lan-status'&&req.method==='GET'){res.setHeader('content-type','application/json');res.end(JSON.stringify({service:'lahout-lan',instance,pid:process.pid}));return;}
  if((req.headers.origin&&req.headers.origin!==url)||(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==url)){res.writeHead(403).end('Origin rejected');return;}
  const headers={...req.headers,host:upstream.host};
  for(const k of Object.keys(headers))if(k.startsWith('x-forwarded-')||['forwarded','connection','upgrade'].includes(k))delete headers[k];
  if(headers.origin)headers.origin=upstream.origin;
  const proxy=http.request({hostname:upstream.hostname,port:upstream.port||80,path:req.url,method:req.method,headers,timeout:180000},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'content-type':'text/plain; charset=utf-8'});res.end('Local application is not running. Start the desktop application first.');});
  proxy.on('timeout',()=>proxy.destroy());req.on('aborted',()=>proxy.destroy());req.pipe(proxy);
 });
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'LAN port is occupied.':'LAN startup failed.');process.exit(1);});
 server.listen(port,'0.0.0.0',()=>{mkdirSync(dir,{recursive:true});writeFileSync(stateFile,JSON.stringify({pid:process.pid,url,instance}));console.log('LAN ready: '+url+'/login');});
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
}else if(mode==='start'){
 const running=await state();if(running){console.log('Already running: '+running.url+'/login');process.exit(0);}
 if(!nic)throw Error('Set LAN_ADDRESS in .env.lan to one of: '+addresses.map(x=>x.address).join(', '));
 const ready=await fetch(upstream.origin+'/api/v1/health/ready',{signal:AbortSignal.timeout(3000)}).catch(()=>null);
 if(!ready?.ok)throw Error('Start the existing desktop application first (Start-Lahout.cmd).');
 mkdirSync(dir,{recursive:true});const log=openSync(path.join(dir,'gateway.log'),'a');
 const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'serve'],{cwd:root,env:{...process.env,LAN_ADDRESS:nic.address},detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();
 for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,300));const s=await state();if(s){console.log('LAN ready: '+s.url+'/login');process.exit(0);}}
 throw Error('LAN did not start. See .local/mobile/gateway.log');
}else if(mode==='stop'){
 const s=await state();if(s)process.kill(s.pid);if(existsSync(stateFile))unlinkSync(stateFile);console.log('LAN stopped; desktop and database remain running.');
}else if(mode==='status'){
 const s=await state();console.log(s?'LAN ready: '+s.url+'/login':'LAN stopped');console.log('Private adapters: '+addresses.map(x=>x.address+'/'+x.cidr.split('/')[1]).join(', '));
}else throw Error('Use start, stop or status.');
