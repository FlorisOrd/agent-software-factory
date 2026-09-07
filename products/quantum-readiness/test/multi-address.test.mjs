import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { Resolver } from 'node:dns/promises';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolvePublicTarget } from '../src/targets.mjs';
import { createPublicScanner,buildReport } from '../src/assessment.mjs';
import { probeTls,PROFILES,LIMITS } from '../src/tls-probe.mjs';
import { renderReport,escapeHtml } from '../src/report.mjs';
import { startFixtures } from './harness.mjs';

const input=hostname=>({hostname,authorized:true,authorizedHostname:hostname});
const answer=(address,family=4)=>({address,family});
const addresses=['8.8.8.8','1.1.1.1','9.9.9.9'].map(address=>answer(address));
const ipv6=[answer('2606:4700::1111',6),answer('2001:4860:4860::8888',6)];

test('selection canonicalizes only after validation, numeric-sorts both families, interleaves and caps deterministically',async()=>{
  const raw=[...addresses,...ipv6,answer('2606:4700:0:0:0:0:0:1111',6)];
  const target=await resolvePublicTarget('selection.qr.test',{resolver:async()=>raw});
  const reordered=await resolvePublicTarget('selection.qr.test',{resolver:async()=>[...raw].reverse()});
  assert.deepEqual(target.sampling,reordered.sampling);
  assert.deepEqual(target.sampling.selectedAddresses,[answer('1.1.1.1'),answer('2001:4860:4860::8888',6),answer('8.8.8.8')]);
  assert.deepEqual(target.sampling.unselectedAddresses,[answer('2606:4700::1111',6),answer('9.9.9.9')]);
  assert.equal(target.sampling.dnsAnswerCount,6);assert.equal(target.sampling.totalValidatedAddresses,5);assert.equal(target.sampling.duplicateAnswers,1);
  assert.deepEqual(target.validatedDnsAnswers,raw);
  for(const family of [4,6]) {
    const rawFamily=family===4?['11.0.0.10','11.0.0.2','11.0.0.100','11.0.0.1'].map(address=>answer(address)):
      ['2606::10','2606::2','2606::100','2606::1'].map(address=>answer(address,6));
    const only=await resolvePublicTarget('selection.qr.test',{resolver:async()=>rawFamily});
    assert.deepEqual(only.sampling.selectedAddresses.map(a=>a.address),family===4?['11.0.0.1','11.0.0.2','11.0.0.10']:['2606::1','2606::2','2606::10']);
    assert.equal(only.sampling.unselectedAddresses.length,1);
  }
});

test('production validates unsafe, malformed, mismatched and incomplete answers beyond the cap before ANY connection',async t=>{
  let connections=0;
  t.mock.method(net,'connect',()=>{connections++;throw new Error('Forbidden connection: controlled instrumentation only');});
  let v4=[],v6=[];
  t.mock.method(Resolver.prototype,'resolve4',async()=>v4);
  t.mock.method(Resolver.prototype,'resolve6',async()=>v6);
  const scan=createPublicScanner();
  for(const invalid of ['127.0.0.1','169.254.169.254','not-an-ip',null,42,'::1']) {
    v4=['1.1.1.1','8.8.8.8','9.9.9.9',invalid];v6=['2606:4700::1111'];
    await assert.rejects(scan(input('unsafe.qr.test')));
    assert.equal(connections,0);
  }
  for(const invalid of ['::1','2001:db8::1','8.8.8.8','2606::xyz']) {
    v4=['1.1.1.1','8.8.8.8','9.9.9.9'];v6=['2606:4700::1111',invalid];
    await assert.rejects(scan(input('unsafe.qr.test')));assert.equal(connections,0);
  }
  v4=Array(17).fill('8.8.8.8');v6=[];
  await assert.rejects(scan(input('unsafe.qr.test')),/16-address/);assert.equal(connections,0);
  t.mock.method(Resolver.prototype,'resolve6',async()=>{throw Object.assign(new Error('Controlled incomplete AAAA lookup'),{code:'ETIMEOUT'});});
  v4=['1.1.1.1'];
  await assert.rejects(scan(input('unsafe.qr.test')),/incomplete/);assert.equal(connections,0);
  for(const invalid of [null,{},answer('8.8.8.8',6),answer('not-an-ip')])await assert.rejects(resolvePublicTarget('unsafe.qr.test',{resolver:async()=>[...addresses,invalid]}));
});

test('production instruments exactly one A/AAAA lookup and six sequential pinned attempts; no public network contact',async t=>{
  let aCalls=0,aaaaCalls=0,active=0,maxActive=0;
  t.mock.method(Resolver.prototype,'resolve4',async()=>{aCalls++;return aCalls===1?['9.9.9.9','8.8.8.8','1.1.1.1']:['127.0.0.1'];});
  t.mock.method(Resolver.prototype,'resolve6',async()=>{aaaaCalls++;return aaaaCalls===1?['2606:4700::1111']:['::1'];});
  const attempts=[];
  t.mock.method(net,'connect',options=>{
    attempts.push(options);active++;maxActive=Math.max(maxActive,active);
    const socket=new net.Socket();socket.on('close',()=>active--);
    process.nextTick(()=>socket.emit('error',Object.assign(new Error('Controlled refusal: no network call made'),{code:'ECONNREFUSED'})));
    return socket;
  });
  const report=await createPublicScanner()(input('pinning.qr.test'));
  assert.equal(aCalls,1);assert.equal(aaaaCalls,1);assert.equal(attempts.length,6);assert.equal(maxActive,1);assert.equal(active,0);
  const expected=[answer('1.1.1.1'),answer('2606:4700::1111',6),answer('8.8.8.8')];
  assert.deepEqual(attempts,expected.flatMap(({address,family})=>Array.from({length:2},()=>({host:address,family,port:443}))));
  assert.equal(report.scope.sampling.assessedCount,3);assert.equal(report.scope.sampling.unassessedCount,1);
  assert.equal(new Set(report.observations.map(o=>o.id)).size,6);
  assert.ok(report.observations.every(o=>o.status==='error' && o.connectedAddress===null && o.sni==='pinning.qr.test'));
  assert.equal(report.crossAddressFindings.length,0,'uniform connection failures must remain incomplete without a manufactured difference');
  assert.equal(report.limits.connections,6);assert.equal(report.limits.assessmentMs,30000);
  console.log(JSON.stringify({demonstration:'production boundary instrumentation; no public network contact',aCalls,aaaaCalls,maxActive,attempts,sampling:report.scope.sampling}));
});

test('global deadline stops active work and records remaining selected profiles without opening connections',async t=>{
  t.mock.method(Resolver.prototype,'resolve4',async()=>['1.1.1.1','8.8.8.8','9.9.9.9']);
  t.mock.method(Resolver.prototype,'resolve6',async()=>[]);
  let attempts=0;
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(net,'connect',()=>{
    attempts++;
    const socket=new net.Socket();
    setImmediate(()=>t.mock.timers.tick(LIMITS.assessmentMs+1));
    return socket;
  });
  const report=await createPublicScanner()(input('deadline.qr.test'));
  assert.equal(attempts,1);assert.equal(report.observations.length,6);
  assert.equal(report.scope.sampling.selectedCount,3);assert.equal(report.scope.sampling.assessedCount,1);assert.equal(report.scope.sampling.unassessedCount,2);
  assert.ok(report.observations.every(o=>o.status==='timeout'));
  assert.ok(report.observations.slice(1).every(o=>o.connectionAttempted===false && o.connectedAddress===null));
  const controller=new AbortController();controller.abort();
  const aborted=await probeTls({hostname:'deadline.qr.test',address:'1.1.1.1',family:4,port:443},PROFILES[0],{signal:controller.signal});
  assert.equal(aborted.connectionAttempted,false);assert.equal(attempts,1);
});

test('real distinct IPv4/IPv6 fixture addresses demonstrate mixed, consistent and capped coverage with complete exports',async t=>{
  const fixtures=await startFixtures();t.after(()=>fixtures.close());
  const reports={};
  for(const hostname of ['mixed.qr.test','consistent.qr.test','sampled.qr.test']) {
    const report=await fixtures.scan({...input(hostname),sensitivity:'sensitive',confidentiality:'over-10-years'});reports[hostname]=report;
    const sampling=report.scope.sampling;
    assert.equal(report.observations.length,sampling.selectedCount*2);
    assert.equal(new Set(report.observations.map(o=>o.id)).size,report.observations.length);
    for(const address of sampling.selectedAddresses) {
      const observations=report.observations.filter(o=>o.resolvedAddress===address.address);
      assert.equal(observations.length,2);assert.ok(observations.every(o=>o.connectedAddress===address.address && o.connectionAttempted && o.sni===hostname && o.timestamp));
      assert.deepEqual(observations.map(o=>o.profile.id),PROFILES.map(p=>p.id));
      assert.equal(fixtures.counts.byEndpoint[`${hostname}|${address.address}`],2);
    }
    assert.equal(new Set(report.observations.map(o=>o.connectedAddress)).size,sampling.selectedCount);
    for(const finding of report.findings)assert.ok(finding.observationRefs.every(ref=>report.observations.filter(o=>o.id===ref).length===1));
    const html=renderReport(report);
    assert.ok(html.includes(escapeHtml(JSON.stringify(report,null,2))),'HTML preserves full original report and sampling');
    for(const observation of report.observations)assert.ok(html.includes(`id="observation-${encodeURIComponent(observation.id)}"`));
    assert.deepEqual(JSON.parse(JSON.stringify(report)).scope.sampling,sampling);
  }
  const mixed=reports['mixed.qr.test'];
  assert.equal(mixed.observations[0].keyExchangeGroup,'prime256v1');
  assert.equal(mixed.observations[1].status,'bounded-negative');
  assert.equal(mixed.observations[3].keyExchangeGroup,'X25519MLKEM768');
  assert.ok(mixed.crossAddressFindings.some(f=>f.id==='cross-address-hybrid'));
  assert.ok(mixed.crossAddressFindings.some(f=>f.id==='cross-address-classical-group'));
  assert.match(mixed.crossAddressFindings.find(f=>f.id==='cross-address-hybrid').interpretation,/not proof.*absent/);
  assert.ok(mixed.findings.filter(f=>f.id.startsWith('classical-')).every(f=>f.priority==='Prioritize staging assessment'));
  const consistent=reports['consistent.qr.test'];
  assert.equal(consistent.crossAddressFindings.length,0);assert.ok(consistent.addressSummaries.every(a=>a.coverage.startsWith('Both profiles')));
  assert.equal(consistent.scope.sampling.assessedCount,2);assert.equal(consistent.scope.sampling.unassessedCount,0);
  const sampled=reports['sampled.qr.test'];
  assert.equal(sampled.scope.sampling.totalValidatedAddresses,4);assert.equal(sampled.scope.sampling.selectedCount,3);assert.equal(sampled.scope.sampling.assessedCount,3);assert.equal(sampled.scope.sampling.unassessedCount,1);
  assert.deepEqual(sampled.scope.sampling.unselectedAddresses,[answer('127.0.0.3')]);assert.equal(fixtures.counts.byEndpoint['sampled.qr.test|127.0.0.3'],undefined);
  assert.equal(sampled.crossAddressFindings.length,0);assert.equal(fixtures.counts.accepted,14);
  await mkdir(new URL('../.artifacts/',import.meta.url),{recursive:true});
  await writeFile(new URL('../.artifacts/controlled-multi-address-reports.json',import.meta.url),JSON.stringify({reports,serverConnections:fixtures.counts.connections},null,2));
  console.log(JSON.stringify({demonstration:'real task-owned distinct IPv4 and IPv6 endpoints, one shared port per hostname',connections:fixtures.counts.accepted,byEndpoint:fixtures.counts.byEndpoint,mixedFindings:mixed.crossAddressFindings.map(f=>f.id),consistentFindings:consistent.crossAddressFindings,sampling:sampled.scope.sampling}));
});

test('cross-address certificate and metadata gaps remain incomplete; equivalent bounded negatives do not manufacture inconsistency',async t=>{
  const fixtures=await startFixtures();t.after(()=>fixtures.close());
  const original=await fixtures.scan(input('consistent.qr.test'));
  const rebuild=observations=>buildReport({hostname:'consistent.qr.test',sensitivity:'unknown',confidentiality:'unknown'},fixtures.endpoints['consistent.qr.test'],observations,true);
  const certificate=structuredClone(original.observations);
  certificate[2].status='certificate-error';certificate[2].certificateValidation={status:'failed',code:'ERR_TLS_CERT_ALTNAME_INVALID'};
  assert.ok(rebuild(certificate).crossAddressFindings.some(f=>f.id==='cross-address-certificate-classical-tls13-v1'));
  const metadata=structuredClone(original.observations);metadata[2].certificate.signatureAlgorithm=null;
  const incomplete=rebuild(metadata);assert.match(incomplete.coverage,/Incomplete/);
  assert.ok(incomplete.crossAddressFindings.some(f=>f.id==='cross-address-coverage-classical-tls13-v1'));
  const negatives=structuredClone(original.observations);
  for(const obs of negatives.filter(o=>o.profile.id===PROFILES[1].id)){obs.status='bounded-negative';obs.certificateValidation={status:'not-completed'};obs.keyExchangeGroup=null;obs.certificate=null;}
  const consistentNegative=rebuild(negatives);assert.equal(consistentNegative.crossAddressFindings.length,0);assert.match(consistentNegative.coverage,/Incomplete/);
});

test('shared encrypted-byte budget prevents later connections after real controlled budget exhaustion',async t=>{
  const fixtures=await startFixtures();t.after(()=>fixtures.close());
  const aggregateBytes={received:0,sent:0};const limits={...LIMITS,assessmentIncomingBytes:64};
  const endpoint=fixtures.endpoints['hybrid.qr.test'];
  const first=await probeTls(endpoint,PROFILES[0],{ca:fixtures.ca,aggregateBytes,limits});
  assert.equal(first.status,'limit-exceeded');assert.ok(aggregateBytes.received>64);
  const second=await probeTls(endpoint,PROFILES[1],{ca:fixtures.ca,aggregateBytes,limits});
  assert.equal(second.status,'limit-exceeded');assert.equal(second.connectionAttempted,false);assert.equal(fixtures.counts.accepted,1);
});
