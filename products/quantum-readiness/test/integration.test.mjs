import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startFixtures} from './harness.mjs';
import {probeTls,PROFILES,LIMITS} from '../src/tls-probe.mjs';
import {interpret} from '../src/rules.mjs';
import {buildReport,createPublicScanner} from '../src/assessment.mjs';
import {startServer} from '../src/server.mjs';

const input=hostname=>({hostname,authorized:true,authorizedHostname:hostname});
test('controlled real TLS: classical, standardized hybrid, certificate failure and timeout evidence',async t=>{
  const fixtures=await startFixtures();t.after(()=>fixtures.close());
  const reports={};
  for(const hostname of ['classical.qr.test','hybrid.qr.test','invalid.qr.test','timeout.qr.test'])reports[hostname]=await fixtures.scan(input(hostname));
  const classical=reports['classical.qr.test'];
  assert.equal(classical.observations[0].keyExchangeGroup,'X25519');
  assert.equal(classical.observations[1].status,'bounded-negative');
  assert.ok(classical.findings.some(f=>f.id==='classical-classical-tls13-v1'));
  assert.match(classical.coverage,/Incomplete/);
  const hybrid=reports['hybrid.qr.test'];
  assert.equal(hybrid.observations[1].status,'negotiated');
  assert.equal(hybrid.observations[1].keyExchangeGroup,'X25519MLKEM768');
  assert.equal(hybrid.observations[1].ephemeralKey.type,'TLSGroup');
  assert.equal(hybrid.observations[1].certificateValidation.status,'verified');
  assert.equal(hybrid.observations[1].certificate.publicKeyType,'rsa');
  assert.equal(hybrid.observations[1].certificate.publicKeyDetails.publicExponent,'65537');
  assert.ok(hybrid.observations[1].certificate.signatureAlgorithm);
  assert.ok(hybrid.findings.some(f=>f.title==='Classical certificate authentication key observed'));
  assert.ok(hybrid.findings.some(f=>f.title==='Standardized hybrid key establishment observed'));
  assert.ok(hybrid.observations.every(o=>o.connectedAddress==='127.0.0.1' && o.sni==='hybrid.qr.test' && o.bytes.received>0 && o.bytes.sent>0));
  const invalid=reports['invalid.qr.test'];
  assert.ok(invalid.observations.every(o=>o.status==='certificate-error' && o.certificateValidation.code==='ERR_TLS_CERT_ALTNAME_INVALID' && o.keyExchangeGroup===null));
  assert.match(invalid.coverage,/Incomplete/);
  assert.ok(reports['timeout.qr.test'].observations.every(o=>o.status==='timeout'));
  assert.equal(fixtures.counts.accepted,8);
  for(const report of Object.values(reports))for(const finding of report.findings){
    assert.ok(finding.observationRefs.every(ref=>report.observations.some(o=>o.id===ref)));
    assert.ok(finding.sources.every(source=>source.url.startsWith('https://') && source.reviewedOn==='2026-09-06'));
    for(const field of ['action','owner','dependencies','validation','rollback','priorityRationale'])assert.ok(finding[field]);
  }
  await mkdir(new URL('../.artifacts/',import.meta.url),{recursive:true});
  await writeFile(new URL('../.artifacts/controlled-reports.json',import.meta.url),JSON.stringify(reports,null,2));
  console.log(JSON.stringify({demonstration:'real task-owned TLS handshakes',node:process.versions.node,openssl:process.versions.openssl,acceptedConnections:fixtures.counts.accepted,groups:hybrid.observations.map(o=>o.keyExchangeGroup),classicalHybridOffer:classical.observations[1].status,invalid:invalid.observations.map(o=>o.status),timeout:reports['timeout.qr.test'].observations.map(o=>o.status)}));
});

test('unsupported configured group, unknown measured group and unknown authentication remain incomplete',async t=>{
  const fixtures=await startFixtures();t.after(()=>fixtures.close());
  const unsupported=await probeTls(fixtures.endpoints['hybrid.qr.test'],{...PROFILES[1],groups:'NOT_A_REAL_GROUP'});
  assert.equal(unsupported.status,'tool-unsupported');assert.equal(fixtures.counts.accepted,0);
  const report=await fixtures.scan(input('hybrid.qr.test'));
  const obs=structuredClone(report.observations[1]);obs.keyExchangeGroup='UNKNOWN-ALGORITHM';obs.certificate.publicKeyType='unknown-future-key';
  const altered=buildReport({hostname:'hybrid.qr.test',sensitivity:'unknown',confidentiality:'unknown'},fixtures.endpoints['hybrid.qr.test'],[obs],true);
  assert.match(altered.coverage,/Incomplete/);assert.ok(altered.findings.some(f=>f.id.startsWith('unknown-group-')));
  assert.ok(altered.findings.some(f=>f.title==='Certificate authentication needs classification'));
  assert.ok(!interpret([unsupported],{confidentiality:'unknown',sensitivity:'unknown'}).some(f=>f.title==='Standardized hybrid key establishment observed'));
});

test('certificate trust is never disabled and ciphertext/timeout limits end actual connections',async t=>{
  const fixtures=await startFixtures();t.after(()=>fixtures.close());
  const endpoint=fixtures.endpoints['hybrid.qr.test'];
  const untrusted=await probeTls(endpoint,PROFILES[1]);assert.equal(untrusted.status,'certificate-error');assert.equal(untrusted.certificateValidation.status,'failed');
  const inbound=await probeTls(endpoint,PROFILES[1],{ca:fixtures.ca,limits:{...LIMITS,incomingBytes:64}});assert.equal(inbound.status,'limit-exceeded');assert.equal(inbound.error.code,'QR_BYTE_LIMIT');
  const outbound=await probeTls(endpoint,PROFILES[1],{ca:fixtures.ca,limits:{...LIMITS,outgoingBytes:128}});assert.equal(outbound.status,'limit-exceeded');
  const controller=new AbortController();setTimeout(()=>controller.abort(),30);
  const start=Date.now();const aborted=await probeTls(fixtures.endpoints['timeout.qr.test'],PROFILES[0],{ca:fixtures.ca,signal:controller.signal});assert.equal(aborted.status,'timeout');assert.ok(Date.now()-start<500);
});

test('fixture target escape and missing permission make no connections; production has no fixture bypass',async t=>{
  const fixtures=await startFixtures();t.after(()=>fixtures.close());
  await assert.rejects(fixtures.scan({hostname:'hybrid.qr.test'}),/permission/);
  await assert.rejects(fixtures.scan(input('example.com')),/only/);
  await assert.rejects(createPublicScanner()({...input('127.0.0.1'),testMode:true,ca:fixtures.ca.toString()}));
  assert.equal(fixtures.counts.accepted,0);
});

test('API exposes original JSON and escaped HTML exports only for process-owned report IDs',async t=>{
  const fixtures=await startFixtures();const app=await startServer({port:0,scan:fixtures.scan,demo:true,targets:Object.keys(fixtures.endpoints)});t.after(async()=>{await app.close();await fixtures.close();});
  const {csrfToken}=await(await fetch(`${app.url}/api/config`)).json();
  const response=await fetch(`${app.url}/api/assess`,{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json','X-QR-CSRF':csrfToken},body:JSON.stringify(input('hybrid.qr.test'))});
  assert.equal(response.status,200);const {report}=await response.json();
  const exported=await fetch(`${app.url}/api/reports/${report.id}.json`);assert.deepEqual(await exported.json(),report);assert.match(exported.headers.get('content-disposition'),/attachment/);
  const html=await(await fetch(`${app.url}/api/reports/${report.id}.html`)).text();assert.match(html,/CONTROLLED DEMONSTRATION/);assert.match(html,/X25519MLKEM768/);
  assert.equal((await fetch(`${app.url}/api/reports/00000000-0000-0000-0000-000000000000.json`)).status,404);
});
