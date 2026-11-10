import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const PORT=Number(process.env.PORT)||4173;
export const PUBLIC_PATH=/^\/(?:index\.html|app\.js|styles\.css|sw\.js|manifest\.webmanifest|assets\/[a-zA-Z0-9._-]+|models\/nba-(?:pregame|live)\.json|lib\/(?:model|value|utils|stats|market)\.mjs|lib\/nba\/(?:ratings|pregame|live|predict|availability)\.mjs)$/;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
const ROUTES=Object.freeze({scores:'scores.mjs',game:'game.mjs',markets:'markets.mjs',quote:'quote.mjs',book:'book.mjs',health:'health.mjs','push-register':'push-register.mjs'});
export const server=createServer(async (req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(url.pathname.startsWith('/api/')){
    const route=url.pathname.slice('/api/'.length);
    if(!ROUTES[route]){res.writeHead(404);res.end('Unknown API route');return;}
    try{
      const module=await import(`../netlify/functions/${ROUTES[route]}`);
      const response=await module.default(new Request(url,{method:'GET'}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch(e){res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:false,error:String(e.message)}));}
    return;
  }
  // Whitelisted served file types only; no .env, server code, docs, or other secrets.
  const path=url.pathname==='/'?'/index.html':url.pathname;
  if(!PUBLIC_PATH.test(path)){
    res.writeHead(404);res.end('Not found');return;
  }
  const full=resolve(ROOT,'.'+path);
  if(!full.startsWith(ROOT+'/')){res.writeHead(403);res.end('Forbidden');return;}
  try{const data=await readFile(full);res.writeHead(200,{'Content-Type':MIME[extname(full)]||'application/octet-stream','Cache-Control':path==='/sw.js'?'no-cache':'public, max-age=60','X-Content-Type-Options':'nosniff'});res.end(data);}
  catch{res.writeHead(404);res.end('Not found');}
});
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){server.listen(PORT,'127.0.0.1',()=>console.log(`SportsPilot research terminal: http://127.0.0.1:${PORT} (no install required)`));}
