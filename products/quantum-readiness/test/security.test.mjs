import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {Resolver} from 'node:dns/promises';
import {normalizeHostname,isPublicAddress,validateRequest,resolvePublicTarget} from '../src/targets.mjs';
import {createPublicScanner,buildReport} from '../src/assessment.mjs';
import {startServer} from '../src/server.mjs';
import {renderReport} from '../src/report.mjs';

const authorized=hostname=>({hostname,authorized:true,authorizedHostname:hostname});

test('hostname normalization rejects URL, credentials, paths, ports and alternative IP forms',()=>{
  assert.equal(normalizeHostname(' EXAMPLE.COM '),'example.com');
  for(const value of ['https://example.com','https://user:pass@example.com','example.com/path','example.com:443','example.com?x','example.com#x','example.com.','localhost','127.0.0.1','0177.0.0.1','0x7f.0.0.1','2130706433','[::1]','example.com\\@127.0.0.1','example%2ecom','a..com','-a.com','a-.com','<script>.com','a\n.com','例子.com'])assert.throws(()=>normalizeHostname(value),undefined,value);
  assert.throws(()=>validateRequest({...authorized('example.com'),port:444}),/443/);
});

test('authorization is bound to exact normalized hostname and business context remains unknown',()=>{
  for(const input of [{hostname:'example.com'}, {...authorized('example.com'),authorized:false},{...authorized('example.com'),authorizedHostname:'other.example'}])assert.throws(()=>validateRequest(input),/permission/);
  assert.equal(validateRequest(authorized('example.com')).confidentiality,'unknown');
  assert.throws(()=>validateRequest({...authorized('example.com'),sensitivity:'invented'}),/listed/);
});

test('IPv4 and IPv6 deny private, reserved, documentation, metadata and transition ranges',()=>{
  const unsafe=['0.0.0.0','10.0.0.1','100.64.0.1','127.255.255.255','169.254.169.254','172.16.0.1','172.31.255.255','192.0.0.9','192.0.2.1','192.88.99.1','192.168.1.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::','::1','::ffff:127.0.0.1','::ffff:7f00:1','64:ff9b::7f00:1','100::1','2001::1','2001:2::1','2001:db8::1','2002:7f00:1::','3fff::1','fc00::1','fd00::1','fe80::1','fe80::1%eth0','ff02::1','not-an-ip'];
  for(const ip of unsafe)assert.equal(isPublicAddress(ip),false,ip);
  for(const ip of ['8.8.8.8','1.1.1.1','172.32.0.1','2606:4700:4700::1111','2001:4860:4860::8888'])assert.equal(isPublicAddress(ip),true,ip);
});

test('mixed DNS results, missing results and address-family mismatch fail before pinning',async()=>{
  for(const answers of [[],[{address:'8.8.8.8',family:4},{address:'::1',family:6}],[{address:'127.0.0.1',family:4}],[{address:'8.8.8.8',family:6}],Array(17).fill({address:'8.8.8.8',family:4})])await assert.rejects(resolvePublicTarget('example.com',{resolver:async()=>answers}));
  const pinned=await resolvePublicTarget('example.com',{resolver:async()=>[{address:'8.8.8.8',family:4},{address:'2606:4700::1111',family:6}]});
  assert.equal(pinned.address,'8.8.8.8');assert.equal(pinned.resolvedAddresses.length,2);assert.equal(pinned.port,443);
});

test('production permission and unsafe DNS targets make zero connection attempts',async t=>{
  let dnsCalls=0,connections=0;
  t.mock.method(Resolver.prototype,'resolve4',async()=>{dnsCalls++;return ['127.0.0.1'];});
  t.mock.method(Resolver.prototype,'resolve6',async()=>[]);
  t.mock.method(net,'connect',()=>{connections++;throw new Error('No connection allowed');});
  const scan=createPublicScanner();
  await assert.rejects(scan({hostname:'example.com'}),/permission/);assert.equal(dnsCalls,0);
  await assert.rejects(scan(authorized('example.com')),/public/);assert.equal(connections,0);
});

test('production single-address regression pins both probes without DNS re-resolution',async t=>{
  let dnsCalls=0;
  t.mock.method(Resolver.prototype,'resolve4',async()=>{dnsCalls++;return dnsCalls===1?['8.8.8.8']:['127.0.0.1'];});
  t.mock.method(Resolver.prototype,'resolve6',async()=>[]);
  const attempts=[];
  t.mock.method(net,'connect',options=>{
    attempts.push(options);
    const socket=new net.Socket();
    process.nextTick(()=>socket.emit('error',Object.assign(new Error('Controlled connection refusal; no network call made.'),{code:'ECONNREFUSED'})));
    return socket;
  });
  const report=await createPublicScanner()(authorized('example.com'));
  assert.equal(dnsCalls,1);assert.equal(attempts.length,2);
  assert.deepEqual(attempts,[{host:'8.8.8.8',port:443,family:4},{host:'8.8.8.8',port:443,family:4}]);
  assert.equal(report.scope.demo,false);assert.equal(report.observations.every(o=>o.status==='error'),true);
});

test('DNS deadline cancels the owned resolver and rejects incomplete resolution',async t=>{
  let cancelled=0;
  t.mock.method(Resolver.prototype,'resolve4',()=>new Promise(()=>{}));
  t.mock.method(Resolver.prototype,'resolve6',()=>new Promise(()=>{}));
  t.mock.method(Resolver.prototype,'cancel',()=>{cancelled++;});
  const start=Date.now();
  await assert.rejects(resolvePublicTarget('example.com',{deadlineMs:30}),/deadline/);
  assert.ok(cancelled>=1);assert.ok(Date.now()-start<500);
});

test('HTML exports escape malicious evidence and use safe source links and observation anchors',()=>{
  const malicious='</pre><script>alert("x")</script><img src=x onerror=alert(1)>';
  const obs={id:'bad-observation',status:'error',certificateValidation:{status:'not-completed'},error:{message:malicious},hostname:malicious};
  const report=buildReport({hostname:'example.com',sensitivity:'unknown',confidentiality:'unknown'},{address:'8.8.8.8',port:443,resolvedAddresses:[]},[obs],false);
  report.scope.provider=malicious;
  const html=renderReport(report);
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.match(html,/&lt;script&gt;/);
  assert.match(html,/href="https:\/\/nodejs.org/);assert.match(html,/href="#observation-bad-observation"/);assert.match(html,/id="observation-bad-observation"/);
});

test('local server rejects hostile Host/Origin, missing CSRF, unsafe paths and oversized bodies',async t=>{
  let calls=0;
  const app=await startServer({port:0,scan:async()=>{calls++;throw new Error('should not scan');}});t.after(()=>app.close());
  const config=await (await fetch(`${app.url}/api/config`)).json();
  // Undici's fetch normalizes Host; raw HTTP is needed to send the hostile value.
  const hostileHostStatus=await new Promise((resolve,reject)=>{const req=http.get(`${app.url}/api/config`,{headers:{Host:'evil.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});
  assert.equal(hostileHostStatus,403);
  assert.equal((await fetch(`${app.url}/api/config`,{headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(`${app.url}/api/assess`,{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(`${app.url}/api/assess`,{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json','X-QR-CSRF':config.csrfToken},body:'{}'})).status,403);
  assert.equal((await fetch(`${app.url}/api/assess`,{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-QR-CSRF':config.csrfToken},body:'x'.repeat(2049)})).status,413);
  assert.equal((await fetch(`${app.url}/api/reports/../../src/main.mjs`)).status,404);
  assert.equal(calls,0);
});

test('concurrent delayed bodies cannot enter the assessment simultaneously',async t=>{
  let release,entered;
  const enteredPromise=new Promise(resolve=>{entered=resolve;});
  let active=0,maxActive=0,calls=0;
  const app=await startServer({port:0,scan:async()=>{calls++;active++;maxActive=Math.max(maxActive,active);entered();await new Promise(resolve=>{release=resolve;});active--;throw new Error('Controlled scan complete');}});t.after(()=>app.close());
  const {csrfToken}=await(await fetch(`${app.url}/api/config`)).json();
  const body=JSON.stringify(authorized('example.com'));
  function request(){let resolve;const response=new Promise(r=>{resolve=r;});const req=http.request(`${app.url}/api/assess`,{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'X-QR-CSRF':csrfToken}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.write(body.slice(0,5));return {req,response};}
  const a=request(),b=request();
  await new Promise(resolve=>setTimeout(resolve,25));
  a.req.end(body.slice(5));await enteredPromise;b.req.end(body.slice(5));
  assert.equal(await b.response,429);release();assert.equal(await a.response,400);assert.equal(maxActive,1);assert.equal(calls,1);
});

test('report retention expires without another assessment and global attempt limits are enforced',async t=>{
  const report=buildReport({hostname:'example.com',sensitivity:'unknown',confidentiality:'unknown'},{address:'8.8.8.8',port:443,resolvedAddresses:[]},[],false);
  const app=await startServer({port:0,scan:async()=>report});t.after(()=>app.close());
  const {csrfToken}=await(await fetch(`${app.url}/api/config`)).json();
  t.mock.timers.enable({apis:['setTimeout']});
  const options={method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-QR-CSRF':csrfToken},body:JSON.stringify(authorized('example.com'))};
  assert.equal((await fetch(`${app.url}/api/assess`,options)).status,200);
  assert.equal((await fetch(`${app.url}/api/reports/${report.id}.json`)).status,200);
  t.mock.timers.tick(1800001);
  assert.equal((await fetch(`${app.url}/api/reports/${report.id}.json`)).status,404);
  t.mock.timers.reset();
  for(let index=0;index<5;index++)assert.equal((await fetch(`${app.url}/api/assess`,options)).status,200);
  assert.equal((await fetch(`${app.url}/api/assess`,options)).status,429);
});
