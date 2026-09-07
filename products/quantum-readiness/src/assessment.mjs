import { randomUUID } from 'node:crypto';
import { validateRequest,resolvePublicTarget } from './targets.mjs';
import { probeTls,PROFILES,LIMITS } from './tls-probe.mjs';
import { RULESET,interpret,SCOPE_LIMITATIONS,PLAN } from './rules.mjs';

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
      for (const profile of PROFILES) observations.push(await probeTls(endpoint,profile,{signal:controller.signal}));
      return buildReport(request,endpoint,observations,false);
    } finally { clearTimeout(timer); active=false; }
  };
}

export function buildReport(request,endpoint,observations,demo) {
  const business={sensitivity:request.sensitivity,confidentiality:request.confidentiality,source:'Selected values are operator-supplied. Omitted values remain unknown.'};
  const findings=interpret(observations,business);
  const complete=observations.length===PROFILES.length && observations.every(o=>o.status==='negotiated' && o.certificateValidation.status==='verified' && o.keyExchangeGroup && o.certificate?.signatureAlgorithm) && !findings.some(f=>f.id.startsWith('unknown-group-') || f.confidence.startsWith('Unknown'));
  return {
    id:randomUUID(),createdAt:new Date().toISOString(),scanner:{name:'Quantum readiness private pilot',version:'0.1.0',node:process.versions.node,openssl:process.versions.openssl},
    ruleset:RULESET,scope:{hostname:request.hostname,port:endpoint.port,address:endpoint.address,resolvedAddresses:endpoint.resolvedAddresses,demo,
      permission:'Operator declaration bound to this hostname; not independent ownership proof.',provider:'unknown',limitations:[...(demo?['CONTROLLED DEMONSTRATION: task-owned local endpoints and ephemeral test certificates; not a customer assessment.']:[]),...SCOPE_LIMITATIONS]},
    business,coverage:complete?'Both offered profiles produced classified, validated connections. Scope remains limited.':'Incomplete profile coverage; inspect each observation and evidence gap.',
    summary:'Measured endpoint posture and a proposed migration plan. No blanket quantum-safe verdict is issued.',
    retention:'Reports remain in this local process for at most 30 minutes, with a maximum of 20 reports. Restart clears them. Downloads are retained wherever the operator saves them. No third-party report service is used.',
    limits:LIMITS,findings,plan:PLAN,observations
  };
}
