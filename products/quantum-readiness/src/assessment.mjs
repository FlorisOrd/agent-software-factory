import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { validateRequest,resolvePublicTarget,sampleValidatedAddresses } from './targets.mjs';
import { probeTls,PROFILES,LIMITS } from './tls-probe.mjs';
import { RULESET,interpret,interpretAcrossAddresses,SCOPE_LIMITATIONS,PLAN } from './rules.mjs';

// Only production construction is exported here. The isolated fixture harness constructs
// reports from measured test probes without adding any production address override.
export function createPublicScanner() {
  let active=false;
  return async input => {
    const request=validateRequest(input); // Permission checked before DNS or connections.
    if (active) throw new Error('An assessment is already running. Wait for it to finish.');
    active=true;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),LIMITS.assessmentMs);
    try {
      const endpoint=await resolvePublicTarget(request.hostname,{deadlineMs:LIMITS.dnsMs});
      const observations=[];
      const aggregateBytes={received:0,sent:0};
      for (const address of endpoint.sampling.selectedAddresses) for (const profile of PROFILES) {
        const observationId=endpoint.sampling.selectedCount===1?profile.id:`${profile.id}@${address.address}`;
        observations.push(await probeTls({...endpoint,...address,observationId},profile,{signal:controller.signal,aggregateBytes}));
      }
      return buildReport(request,endpoint,observations,false);
    } finally { clearTimeout(timer); active=false; }
  };
}

export function buildReport(request,endpoint,observations,demo) {
  const business={sensitivity:request.sensitivity,confidentiality:request.confidentiality,source:'Selected values are operator-supplied. Omitted values remain unknown.'};
  const selected=endpoint.sampling ?? sampleValidatedAddresses(endpoint.resolvedAddresses?.length?endpoint.resolvedAddresses:[{address:endpoint.address,family:endpoint.family??isIP(endpoint.address)}]);
  const findings=interpret(observations,business);
  const addressSummaries=selected.selectedAddresses.map(address=>{
    const evidence=observations.filter(o=>o.resolvedAddress===address.address);
    const classified=evidence.length===PROFILES.length && PROFILES.every(profile=>evidence.filter(o=>(o.profile?.id??o.id)===profile.id).length===1) && evidence.every(o=>o.status==='negotiated' && o.certificateValidation.status==='verified' && o.keyExchangeGroup && o.certificate?.signatureAlgorithm) && !findings.some(f=>f.observationRefs.some(ref=>evidence.some(o=>o.id===ref)) && (f.id.startsWith('unknown-group-') || f.confidence.startsWith('Unknown')));
    return {...address,assessed:evidence.some(o=>o.connectionAttempted===true),coverage:classified?'Both profiles produced classified, validated connections.':'Incomplete profile coverage; inspect the observations.',
      observationRefs:evidence.map(o=>o.id),profiles:PROFILES.map(profile=>{
        const obs=evidence.find(o=>(o.profile?.id??o.id)===profile.id);
        return {id:profile.id,status:obs?.status??'not-recorded',connectedAddress:obs?.connectedAddress??null,keyExchangeGroup:obs?.keyExchangeGroup??null,certificateValidation:obs?.certificateValidation??{status:'not-completed'}};
      })};
  });
  const assessedAddresses=addressSummaries.filter(a=>a.assessed).map(({address,family})=>({address,family}));
  const sampling={...selected,assessedCount:assessedAddresses.length,assessedAddresses,unassessedCount:selected.totalValidatedAddresses-assessedAddresses.length};
  const crossAddressFindings=interpretAcrossAddresses(observations,addressSummaries);
  findings.push(...crossAddressFindings);
  const complete=addressSummaries.every(a=>a.coverage.startsWith('Both profiles'));
  return {
    id:randomUUID(),createdAt:new Date().toISOString(),scanner:{name:'Quantum readiness private pilot',version:'0.2.0',node:process.versions.node,openssl:process.versions.openssl},
    ruleset:RULESET,scope:{hostname:request.hostname,port:endpoint.port,address:endpoint.address,resolvedAddresses:endpoint.resolvedAddresses,validatedDnsAnswers:endpoint.validatedDnsAnswers??endpoint.resolvedAddresses,sampling,demo,
      permission:'Operator declaration bound to this hostname; not independent ownership proof.',provider:'unknown',limitations:[...(demo?['CONTROLLED DEMONSTRATION: task-owned local endpoints and ephemeral test certificates; not a customer assessment.']:[]),...SCOPE_LIMITATIONS]},
    business,coverage:complete?`Both offered profiles produced classified, validated connections on all ${sampling.selectedCount} selected address(es). ${sampling.unassessedCount} validated address(es) remain unassessed; scope remains limited.`:'Incomplete profile coverage; inspect each address, observation and evidence gap.',
    summary:'Measured endpoint posture and a proposed migration plan. No blanket quantum-safe verdict is issued.',
    retention:'Reports remain in this local process for at most 30 minutes, with a maximum of 20 reports. Restart clears them. Downloads are retained wherever the operator saves them. No third-party report service is used.',
    limits:LIMITS,traffic:observations.reduce((total,o)=>({received:total.received+(o.bytes?.received??0),sent:total.sent+(o.bytes?.sent??0)}),{received:0,sent:0}),
    addressSummaries,crossAddressFindings,findings,plan:PLAN,observations
  };
}
