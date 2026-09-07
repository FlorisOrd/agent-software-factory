// ISOLATED TEST TRANSPORT. Production src/main.mjs never imports this module.
// No request-controlled destination: only these task-owned listening endpoints.
import tls from 'node:tls';
import net from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateRequest} from '../src/targets.mjs';
import {probeTls,PROFILES,LIMITS} from '../src/tls-probe.mjs';
import {buildReport} from '../src/assessment.mjs';

const openssl=process.env.QR_OPENSSL ?? (process.platform==='win32'?'C:\\Program Files\\Git\\usr\\bin\\openssl.exe':'openssl');
export async function startFixtures() {
  const directory=await mkdtemp(path.join(tmpdir(),'qr-mvp-fixtures-'));
  const ownedServers=[];
  const sockets=new Set();
  const counts={accepted:0,active:0,maxActive:0};
  const closed=async()=>{
    for(const socket of sockets)socket.destroy();
    await Promise.all(ownedServers.map(server=>new Promise(resolve=>server.close(resolve))));
    // This absolute path was returned by mkdtemp under the OS temp directory and
    // contains only generated fixture material. Never read or retain its private key.
    if(path.dirname(directory)!==path.resolve(tmpdir()) || !path.basename(directory).startsWith('qr-mvp-fixtures-'))throw new Error('Unexpected fixture cleanup path.');
    await rm(directory,{recursive:true,force:true});
  };
  try {
    execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(directory,'key.pem'),'-out',path.join(directory,'cert.pem'),'-days','2','-subj','/CN=Controlled QR fixture','-addext','subjectAltName=DNS:classical.qr.test,DNS:hybrid.qr.test,DNS:timeout.qr.test','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore',windowsHide:true});
    const key=await readFile(path.join(directory,'key.pem'));
    const cert=await readFile(path.join(directory,'cert.pem'));
    const endpoints={};
    for(const [hostname,groups] of [['classical.qr.test','X25519:P-256'],['hybrid.qr.test','X25519MLKEM768:X25519:P-256'],['invalid.qr.test','X25519MLKEM768:X25519']]) {
      const server=tls.createServer({key,cert,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ecdhCurve:groups},socket=>socket.end());
      server.on('tlsClientError',()=>{});
      await listen(server);
      endpoints[hostname]={hostname,address:'127.0.0.1',family:4,port:server.address().port,resolvedAddresses:[{address:'127.0.0.1',family:4}]};
    }
    const timeout=net.createServer(()=>{});
    await listen(timeout);
    endpoints['timeout.qr.test']={hostname:'timeout.qr.test',address:'127.0.0.1',family:4,port:timeout.address().port,resolvedAddresses:[{address:'127.0.0.1',family:4}]};
    async function listen(server) {
      ownedServers.push(server);
      server.on('connection',socket=>{
        counts.accepted++;counts.active++;counts.maxActive=Math.max(counts.maxActive,counts.active);sockets.add(socket);
        socket.on('close',()=>{counts.active--;sockets.delete(socket);});
      });
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    }
    let active=false;
    return {endpoints,ca:cert,counts,close:closed,async scan(input){
      const request=validateRequest(input);
      const endpoint=endpoints[request.hostname];
      if(!endpoint)throw new Error('Controlled demonstration accepts only its four listed task-owned fixtures.');
      if(active)throw new Error('A fixture assessment is already running.');
      active=true;
      try {
        const limits=request.hostname==='timeout.qr.test'?{...LIMITS,probeMs:250}:LIMITS;
        const observations=[];
        for(const profile of PROFILES)observations.push(await probeTls(endpoint,profile,{ca:cert,limits}));
        return buildReport(request,endpoint,observations,true);
      } finally{active=false;}
    }};
  }catch(error){await closed();throw error;}
}
