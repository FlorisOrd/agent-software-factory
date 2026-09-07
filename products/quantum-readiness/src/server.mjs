import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { renderReport } from './report.mjs';

const assets=new Map([['/', ['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/style.css',['style.css','text/css; charset=utf-8']]]);
export async function startServer({scan,port=8787,demo=false,targets=[]}={}) {
  if (typeof scan!=='function') throw new Error('An assessment implementation is required.');
  const csrfToken=randomBytes(32).toString('hex');
  const reports=new Map();
  const recent=[];
  let busy=false;
  let origin;
  const send=(res,status,body,type='application/json; charset=utf-8',extra={})=>{
    res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",...extra});
    res.end(type.startsWith('application/json')?JSON.stringify(body):body);
  };
  const server=http.createServer(async(req,res)=>{
    try {
      if (req.headers.host!==origin.slice(7)) { send(res,403,{error:'Unrecognized local interface host.'}); return; }
      if (req.headers.origin && req.headers.origin!==origin) { send(res,403,{error:'Cross-origin access is not allowed.'}); return; }
      if (req.headers['sec-fetch-site']==='cross-site') { send(res,403,{error:'Cross-site access is not allowed.'}); return; }
      const path=req.url;
      if (req.method==='GET' && assets.has(path)) {
        const [file,type]=assets.get(path);
        send(res,200,await readFile(new URL(`../public/${file}`,import.meta.url)),type); return;
      }
      if (req.method==='GET' && path==='/api/config') { send(res,200,{csrfToken,demo,targets}); return; }
      if (req.method==='POST' && path==='/api/assess') {
        const token=req.headers['x-qr-csrf'];
        if (req.headers.origin!==origin || typeof token!=='string' || token.length!==csrfToken.length || !timingSafeEqual(Buffer.from(token),Buffer.from(csrfToken))) { send(res,403,{error:'Assessment requires this local page and its request token.'}); return; }
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??'')) { send(res,415,{error:'A JSON request is required.'}); return; }
        if (busy) { send(res,429,{error:'An assessment is already running. Wait for it to finish.'}); return; }
        const now=Date.now();
        while(recent.length && now-recent[0]>=60000) recent.shift();
        if (recent.length>=6) {send(res,429,{error:'Private pilot limit: six assessment attempts per minute. Try again later.'});return;}
        recent.push(now);
        let bytes=0;
        const chunks=[];
        const bodyTimer=setTimeout(()=>req.destroy(),5000);
        try {for await(const chunk of req) {
          bytes+=chunk.length;
          if (bytes>2048) {send(res,413,{error:'Assessment request exceeds 2048 bytes.'}); return;}
          chunks.push(chunk);
        }} finally {clearTimeout(bodyTimer);}
        let input;
        try {input=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {send(res,400,{error:'Invalid JSON request.'});return;}
        if (busy) {send(res,429,{error:'An assessment is already running. Wait for it to finish.'});return;}
        busy=true;
        try {
          const report=await scan(input);
          while(reports.size>=20) {const id=reports.keys().next().value;clearTimeout(reports.get(id).expiryTimer);reports.delete(id);}
          const expiryTimer=setTimeout(()=>reports.delete(report.id),1800000);
          expiryTimer.unref();
          reports.set(report.id,{report,savedAt:Date.now(),expiryTimer});
          send(res,200,{report});
        } catch(error) {send(res,400,{error:String(error.message).slice(0,500)});}
        finally {busy=false;}
        return;
      }
      const match=/^\/api\/reports\/([a-f0-9-]{36})\.(json|html)$/.exec(path);
      if(req.method==='GET' && match) {
        const entry=reports.get(match[1]);
        if(!entry || Date.now()-entry.savedAt>1800000) {if(entry)clearTimeout(entry.expiryTimer);reports.delete(match[1]);send(res,404,{error:'Report expired or does not exist in this process.'});return;}
        const filename=`quantum-readiness-${match[1]}.${match[2]}`;
        send(res,200,match[2]==='json'?entry.report:renderReport(entry.report),match[2]==='json'?'application/json; charset=utf-8':'text/html; charset=utf-8',{
          'Content-Disposition':`attachment; filename="${filename}"`,
          ...(match[2]==='html'?{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox"}:{})
        });return;
      }
      send(res,404,{error:'Route not found.'});
    } catch {if(!res.headersSent)send(res,400,{error:'Request could not be completed.'});else res.destroy();}
  });
  server.maxConnections=16;
  server.requestTimeout=5000;
  server.headersTimeout=5000;
  server.keepAliveTimeout=1000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin=`http://127.0.0.1:${server.address().port}`;
  return {server,url:origin,close:()=>new Promise(resolve=>{for(const entry of reports.values())clearTimeout(entry.expiryTimer);reports.clear();server.close(resolve);server.closeIdleConnections();})};
}
