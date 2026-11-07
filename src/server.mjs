import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fail} from './contracts.mjs';
const statuses={INVALID:400,UNAUTHORIZED:401,FORBIDDEN:403,NOT_FOUND:404,CONFLICT:409,EXPIRED:410,UNSUPPORTED:422,LIMIT:413,MEMORY_DISABLED:403};
const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
function authorized(header,token){const a=Buffer.from(header??''),b=Buffer.from('Bearer '+token);return a.length===b.length&&timingSafeEqual(a,b);}
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>65536)fail('LIMIT','Request exceeds 64 KiB');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{fail('INVALID','Invalid JSON');}}
export async function startServer({service,tokens,port=0}){
 if(!tokens||typeof tokens.ingest!=='string'||typeof tokens.ui!=='string'||tokens.ingest===tokens.ui||tokens.ingest.length<32||tokens.ui.length<32)fail('INVALID','Separate strong credentials required');
 let origin;
 const server=createServer(async(req,res)=>{
  const json=(status,value)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try{
   if(req.headers.host!==new URL(origin).host)fail('FORBIDDEN','Invalid host');
   if(req.headers.origin&&req.headers.origin!==origin)fail('FORBIDDEN','Invalid origin');
   const url=new URL(req.url,origin),route=url.pathname;
   if(route.startsWith('/api/')||route==='/ingest'||route==='/host/rpc'){
    const hostRoute=route==='/ingest'||route==='/host/rpc';
    if(!authorized(req.headers.authorization,hostRoute?tokens.ingest:tokens.ui))fail('UNAUTHORIZED');
    if(req.method==='POST'&&!hostRoute&&req.headers.origin!==origin)fail('FORBIDDEN','Same-origin request required');
    const data=req.method==='POST'?await body(req):null;
    if(route==='/ingest'&&req.method==='POST')return json(200,service.ingest(data));
    if(route==='/api/sessions'&&req.method==='GET')return json(200,service.sessions());
    if(route==='/api/events'&&req.method==='GET')return json(200,service.events(url.searchParams.get('sessionKey'),Number(url.searchParams.get('after')??0)));
    if(service.handleRoute){const value=await service.handleRoute({route,method:req.method,data,url,req,res});if(value!==undefined)return json(200,value);}
    fail('NOT_FOUND');
   }
   if(req.method!=='GET')fail('NOT_FOUND');
   const filename=path.resolve(publicRoot,'.'+decodeURIComponent(route==='/'?'/index.html':route));
   if(!filename.startsWith(publicRoot+path.sep)&&filename!==path.join(publicRoot,'index.html'))fail('NOT_FOUND');
   const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
   if(!types[path.extname(filename)])fail('NOT_FOUND');
   const bytes=await readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)],'Cache-Control':'no-store'});res.end(bytes);
  }catch(e){const code=e.code==='ENOENT'?'NOT_FOUND':statuses[e.code]?e.code:'INTERNAL';json(statuses[code]??500,{error:{code,message:code==='INTERNAL'?'Internal service error':e.message}});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
 origin='http://127.0.0.1:'+server.address().port;
 return {origin,close:()=>new Promise((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();})};
}
