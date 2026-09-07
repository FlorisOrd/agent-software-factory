export const RULESET = Object.freeze({id:'qr-tls-posture', version:'1.0.0', reviewedOn:'2026-09-06'});
const sources = {
  quantum:{title:'NIST: What is post-quantum cryptography?',url:'https://www.nist.gov/cybersecurity-and-privacy/what-post-quantum-cryptography',reviewedOn:RULESET.reviewedOn},
  hybrid:{title:'IETF RFC 10024: Post-quantum traditional hybrid ECDHE-MLKEM for TLS 1.3',url:'https://datatracker.ietf.org/doc/rfc10024/',reviewedOn:RULESET.reviewedOn},
  symmetric:{title:'NIST PQC FAQ: symmetric cryptography',url:'https://csrc.nist.gov/Projects/post-quantum-cryptography/faqs',reviewedOn:RULESET.reviewedOn},
  migration:{title:'NIST NCCoE: Migration to post-quantum cryptography',url:'https://www.nccoe.nist.gov/applied-cryptography/migration-to-pqc',reviewedOn:RULESET.reviewedOn},
  tls:{title:'Node.js 24 TLS: measured ephemeral-key information',url:'https://nodejs.org/docs/latest-v24.x/api/tls.html#tlssocketgetephemeralkeyinfo',reviewedOn:RULESET.reviewedOn}
};
const classicalGroups = new Set(['X25519','X448','prime256v1','secp256r1','P-256','secp384r1','P-384','secp521r1','P-521']);
const hybridGroups = new Set(['X25519MLKEM768','SecP256r1MLKEM768','SecP384r1MLKEM1024']);

export const SCOPE_LIMITATIONS = [
  'This is a point-in-time assessment of two TLS 1.3 client profiles at one pinned address on the named endpoint. Other addresses, TLS versions and client offers are untested.',
  'The exposed endpoint may be a provider edge. Provider identity and the origin server remain unknown.',
  'Internal traffic, databases, backups, source code, VPNs, signing infrastructure and other company assets are unassessed.',
  'A negotiated hybrid connection does not establish post-quantum authentication or whole-company security. Certificate signing and the live handshake signature are different; the live signature algorithm is not exposed by this backend.',
  'No score, certification, compliance determination, compromise claim or date of quantum-computer capability is inferred. No system was modified.',
  'A declaration of permission is a private-pilot workflow control, not independent proof of ownership. Public release requires separate authorization and abuse-prevention design.'
];

function finding(id, obs, fields) {
  return {id,ruleVersion:RULESET.version,observationRefs:obs.map(o=>o.id),confidence:'Measured for the listed profile, address and time only.',
    owner:'Operator to identify the responsible TLS endpoint/provider owner; attribution is unknown.',
    dependencies:'Confirm actual provider/library support and authorized staging access. No vendor setting or compatibility promise has been verified.',
    validation:'Repeat the same measured probes after an authorized staging change and compare protocol, group, certificate validation and client compatibility.',
    rollback:'Before any separately authorized change, preserve the prior configuration and define rollback triggers for handshake errors, compatibility or performance regressions.',
    sources:[sources.migration],...fields};
}

export function interpret(observations,business) {
  const findings=[];
  for (const obs of observations) {
    if (obs.status !== 'negotiated' || obs.certificateValidation.status !== 'verified') {
      findings.push(finding(`coverage-${obs.id}`,[obs],{
        title:'Probe did not establish a validated connection',category:obs.status==='certificate-error'?'Conventional TLS hygiene / incomplete evidence':'Evidence coverage',priority:'Resolve evidence gap',
        observation:`Profile ${obs.id}: ${obs.status}. Certificate validation: ${obs.certificateValidation.status}.`,
        interpretation:obs.status==='bounded-negative'?'This bounded handshake offer was not accepted. It does not prove that the endpoint has no hybrid configuration; tool, network and server policy can affect the outcome.':'This probe is incomplete. Missing capability, TLS errors, invalid certificates, byte limits and timeouts cannot establish absence of quantum-related exposure or absence of PQ support.',
        confidence:'Incomplete; no successful, validated negotiation for this offer.',priorityRationale:'Reliable endpoint evidence is needed before selecting a migration change.',
        action:obs.status==='certificate-error'?'Ask the endpoint owner to investigate the trust/hostname failure and repeat with normal certificate validation. Do not disable verification.':'Confirm client capability, endpoint availability and server TLS policy with its owner, then repeat this bounded assessment.',sources:[sources.tls,sources.migration]
      }));
      continue;
    }
    const group=obs.keyExchangeGroup;
    if (classicalGroups.has(group)) findings.push(finding(`classical-${obs.id}`,[obs],{
      title:'Classical key establishment observed',category:'Key establishment and confidentiality',priority:business.confidentiality==='over-10-years' || business.sensitivity==='sensitive'?'Prioritize staging assessment':'Plan migration assessment',
      observation:`${obs.id} negotiated ${group} with ${obs.protocol}.`,
      interpretation:'This measured connection used classical key establishment, which may expose recorded traffic to future decryption by a sufficiently capable quantum computer. A classical offer cannot establish whether the server supports hybrid key establishment under another offer.',
      priorityRationale:business.confidentiality==='unknown'?'Confidentiality lifetime is unknown; confirm it before setting a business deadline.':'Priority uses operator-supplied confidentiality lifetime and sensitivity; this is not a verified risk estimate.',
      action:'Confirm sensitive-data lifetime and test a provider/library-supported RFC 10024 hybrid ML-KEM configuration in authorized staging. Increasing an RSA key size is not a PQ migration solution.',sources:[sources.quantum,sources.hybrid,sources.migration]
    }));
    else if (hybridGroups.has(group)) findings.push(finding(`hybrid-${obs.id}`,[obs],{
      title:'Standardized hybrid key establishment observed',category:'Key establishment and confidentiality',priority:'Validate coverage',
      observation:`${obs.id} actually negotiated ${group} with ${obs.protocol}; client hybrid support was demonstrated by this handshake.`,
      interpretation:'This connection combined classical ECDHE with ML-KEM as standardized in RFC 10024. This finding is limited to key establishment on the tested connection; authentication and other clients/systems require separate review.',
      priorityRationale:'Preserve this connection property while confirming client compatibility, performance and coverage across authorized infrastructure.',
      action:'Have the endpoint owner confirm this supported configuration and test representative clients in staging. Inventory other addresses and systems under separate scoped authorization.',sources:[sources.hybrid,sources.migration]
    }));
    else findings.push(finding(`unknown-group-${obs.id}`,[obs],{
      title:'Negotiated group cannot be classified',category:'Evidence coverage',priority:'Resolve evidence gap',observation:`Measured group: ${group ?? 'unavailable'}.`,
      interpretation:'The negotiated key-establishment algorithm is unavailable or is not recognized by this versioned rule set. TLS 1.3, an AES cipher and certificate key type do not identify it.',confidence:'Unknown key-establishment classification.',priorityRationale:'An algorithm label alone is insufficient until verified against an authoritative specification.',action:'Confirm the negotiated group using a supported diagnostic and update reviewed rules with authoritative algorithm evidence.',sources:[sources.tls,sources.hybrid]
    }));
    const type=obs.certificate?.publicKeyType;
    const knownClassical=['rsa','rsa-pss','ec','ed25519','ed448'].includes(type);
    findings.push(finding(`authentication-${obs.id}`,[obs],{
      title:knownClassical?'Classical certificate authentication key observed':'Certificate authentication needs classification',category:'Authentication and signature migration',priority:'Separate migration workstream',
      observation:`Certificate public key: ${type ?? 'unknown'}; certificate signature: ${obs.certificate?.signatureAlgorithm ?? 'unknown'}. Live handshake signature algorithm: unobserved.`,
      interpretation:knownClassical?'The presented certificate uses a classical public key. Hybrid key establishment does not make this authentication post-quantum. Certificate-chain signatures and the live handshake signature need separate inventory.':'This rule set cannot classify the presented certificate public key. It does not establish post-quantum authentication.',
      confidence:knownClassical?'Certificate metadata measured; live handshake signature and full chain algorithm inventory unassessed.':'Unknown authentication classification.',
      priorityRationale:'Signature migration depends on CA, browser/client and provider support, separately from recorded-traffic confidentiality.',
      action:'Identify the certificate/CA owner and track supported signature and certificate migration options. Finalized PQ signature algorithms do not imply deployable public-Web-PKI support everywhere; verify current ecosystem support before a pilot.',sources:[sources.quantum,sources.migration]
    }));
    findings.push(finding(`symmetric-${obs.id}`,[obs],{
      title:'Symmetric cipher recorded separately',category:'Symmetric encryption and hashes',priority:'Inventory',observation:`Negotiated cipher: ${obs.cipher?.standardName ?? obs.cipher?.name ?? 'unknown'}.`,
      interpretation:'An AES cipher is not automatically quantum-broken, and its presence does not establish PQ key exchange. This scanner does not derive company-wide symmetric or hash readiness from one TLS cipher.',
      priorityRationale:'Keep symmetric encryption and hashes separate from public-key migration decisions.',action:'Record the measured cipher in the inventory and have the responsible owner assess symmetric and hash requirements using current standards.',sources:[sources.symmetric]
    }));
  }
  return findings;
}

export const PLAN=[
  'Confirm assessment scope, authority, data sensitivity and required confidentiality lifetime; unknown answers need owner confirmation.',
  'Identify the actual endpoint/provider, TLS library and certificate/CA owners; verify their current supported migration options.',
  'Pilot supported standardized hybrid ML-KEM key establishment in authorized staging; maintain a separate authentication/signature migration workstream.',
  'Measure representative client compatibility, handshake performance and failure rates; define acceptance and rollback thresholds with the service owner.',
  'Deploy only under separate explicit authorization after the staging criteria are met. This tool does not make changes.',
  'Rescan the same authorized endpoint with the same offers, compare measured evidence, and extend inventory only under separately confirmed scope.'
];
