// ISOLATED TEST TRANSPORT. Production src/main.mjs never imports this module.
// No request-controlled destination: only these task-owned listening endpoints.
import tls from 'node:tls';
import net from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateRequest,sampleValidatedAddresses} from '../src/targets.mjs';
import {probeTls,PROFILES,LIMITS} from '../src/tls-probe.mjs';
import {buildReport} from '../src/assessment.mjs';

const openssl=process.env.QR_OPENSSL ?? (process.platform==='win32'?'C:\\Program Files\\Git\\usr\\bin\\openssl.exe':'openssl');
export async function startFixtures() {
  const directory=await mkdtemp(path.join(tmpdir(),'qr-mvp-fixtures-'));
  const ownedServers=[];
  const sockets=new Set();
  const counts={accepted:0,active:0,maxActive:0,byEndpoint:{},connections:[]};
  const closed=async()=>{
    for(const socket of sockets)socket.destroy();
    await Promise.all(ownedServers.map(server=>new Promise(resolve=>server.close(resolve))));
    // This absolute path was returned by mkdtemp under the OS temp directory and
    // contains only generated fixture material. Never read or retain its private key.
    if(path.dirname(directory)!==path.resolve(tmpdir()) || !path.basename(directory).startsWith('qr-mvp-fixtures-'))throw new Error('Unexpected fixture cleanup path.');
    await rm(directory,{recursive:true,force:true});
  };
  try {
    execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(directory,'key.pem'),'-out',path.join(directory,'cert.pem'),'-days','2','-subj','/CN=Controlled QR fixture','-addext','subjectAltName=DNS:classical.qr.test,DNS:hybrid.qr.test,DNS:timeout.qr.test,DNS:mixed.qr.test,DNS:consistent.qr.test,DNS:sampled.qr.test','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore',windowsHide:true});
    const key=await readFile(path.join(directory,'key.pem'));
    const cert=await readFile(path.join(directory,'cert.pem'));
    const endpoints={};
    for(const [hostname,groups] of [['classical.qr.test','X25519:P-256'],['hybrid.qr.test','X25519MLKEM768:X25519:P-256'],['invalid.qr.test','X25519MLKEM768:X25519']]) {
      const server=tls.createServer({key,cert,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ecdhCurve:groups},socket=>socket.end());
      server.on('tlsClientError',()=>{});
      await listen(server,hostname);
      endpoints[hostname]=target(hostname,server.address().port,[{address:'127.0.0.1',family:4}]);
    }
    const timeout=net.createServer(()=>{});
    await listen(timeout,'timeout.qr.test');
    endpoints['timeout.qr.test']=target('timeout.qr.test',timeout.address().port,[{address:'127.0.0.1',family:4}]);
    for(const hostname of ['mixed.qr.test','consistent.qr.test','sampled.qr.test']) {
      const addresses=[{address:'127.0.0.1',family:4},{address:'::1',family:6},...(hostname==='sampled.qr.test'?[{address:'127.0.0.2',family:4},{address:'127.0.0.3',family:4}]:[])];
      let port=0;
      for(const [index,address] of addresses.entries()) {
        const groups=hostname==='mixed.qr.test' && index===0?'P-256':'X25519MLKEM768:X25519:P-256';
        const server=tls.createServer({key,cert,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ecdhCurve:groups},socket=>socket.end());
        server.on('tlsClientError',()=>{});
        await listen(server,hostname,address.address,port);
        port=server.address().port;
      }
      endpoints[hostname]=target(hostname,port,addresses);
    }
    function target(hostname,port,addresses) {
      const sampling=sampleValidatedAddresses(addresses);
      return {hostname,port,...sampling.selectedAddresses[0],resolvedAddresses:[...sampling.selectedAddresses,...sampling.unselectedAddresses],validatedDnsAnswers:addresses,
        sampling:{...sampling,validation:'ISOLATED FIXTURE: task-owned loopback address inventory; no public DNS validation is claimed.'}};
    }
    async function listen(server,hostname,address='127.0.0.1',port=0) {
      ownedServers.push(server);
      server.on('connection',socket=>{
        counts.accepted++;counts.active++;counts.maxActive=Math.max(counts.maxActive,counts.active);sockets.add(socket);
        const endpointKey=`${hostname}|${address}`;
        counts.byEndpoint[endpointKey]=(counts.byEndpoint[endpointKey]??0)+1;
        counts.connections.push({hostname,localAddress:socket.localAddress,localPort:socket.localPort,remoteAddress:socket.remoteAddress,timestamp:new Date().toISOString()});
        socket.on('close',()=>{counts.active--;sockets.delete(socket);});
      });
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({port,host:address,ipv6Only:address==='::1'},resolve);});
    }
    let active=false;
    return {endpoints,ca:cert,counts,close:closed,async scan(input){
      const request=validateRequest(input);
      const endpoint=endpoints[request.hostname];
      if(!endpoint)throw new Error('Controlled demonstration accepts only its listed task-owned fixtures.');
      if(active)throw new Error('A fixture assessment is already running.');
      active=true;
      try {
        const limits=request.hostname==='timeout.qr.test'?{...LIMITS,probeMs:250}:LIMITS;
        const observations=[];
        const aggregateBytes={received:0,sent:0};
        for(const address of endpoint.sampling.selectedAddresses)for(const profile of PROFILES) {
          const observationId=endpoint.sampling.selectedCount===1?profile.id:`${profile.id}@${address.address}`;
          observations.push(await probeTls({...endpoint,...address,observationId},profile,{ca:cert,limits,aggregateBytes}));
        }
        return buildReport(request,endpoint,observations,true);
      } finally{active=false;}
    }};
  }catch(error){await closed();throw error;}
}
