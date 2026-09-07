import net from 'node:net';
import tls from 'node:tls';
import { Duplex } from 'node:stream';
import { canonicalAddress } from './targets.mjs';
import { LIMITS } from './limits.mjs';

export { LIMITS };
export const PROFILES = Object.freeze([
  { id: 'classical-tls13-v1', protocol: 'TLSv1.3', groups: 'X25519:P-256:P-384', ciphers:'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256' },
  { id: 'hybrid-mlkem-tls13-v1', protocol: 'TLSv1.3', groups: 'X25519MLKEM768', ciphers:'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256' }
]);

export function capability(profile) {
  try {
    tls.createSecureContext({ minVersion: profile.protocol, maxVersion: profile.protocol, ecdhCurve: profile.groups, ciphers:profile.ciphers });
    return { status: 'configured', offeredGroups: profile.groups.split(':'), note: 'Local TLS context accepts this offer. A successful measured handshake separately demonstrates negotiation.' };
  } catch { return { status: 'unsupported', offeredGroups: profile.groups.split(':'), note: 'This runtime cannot configure the required probe group.' }; }
}

// This stream counts encrypted traffic, including handshake records; plaintext counters do not.
function boundedWire(raw, limits, counters, aggregateBytes) {
  const wire = new Duplex({
    read() { raw.resume(); },
    write(chunk, encoding, done) {
      counters.sent += chunk.length;
      aggregateBytes.sent += chunk.length;
      if (counters.sent > limits.outgoingBytes || aggregateBytes.sent > limits.assessmentOutgoingBytes) { const error = Object.assign(new Error('Encrypted outbound byte limit exceeded.'), {code:'QR_BYTE_LIMIT'}); done(error); raw.destroy(error); return; }
      raw.write(chunk, encoding, done);
    },
    destroy(error, done) { raw.destroy(); done(error); }
  });
  raw.on('data', chunk => {
    counters.received += chunk.length;
    aggregateBytes.received += chunk.length;
    if (counters.received > limits.incomingBytes || aggregateBytes.received > limits.assessmentIncomingBytes) { wire.destroy(Object.assign(new Error('Encrypted inbound byte limit exceeded.'), {code:'QR_BYTE_LIMIT'})); return; }
    if (!wire.push(chunk)) raw.pause();
  });
  raw.on('end', () => wire.push(null));
  raw.on('error', error => wire.destroy(error));
  raw.on('close', () => { if (!wire.destroyed) wire.destroy(); });
  return wire;
}

export function probeTls(endpoint, profile, { ca, limits = LIMITS, signal, aggregateBytes = {received:0,sent:0} } = {}) {
  const configured = capability(profile);
  const observation = {
    id: endpoint.observationId??profile.id, timestamp: new Date().toISOString(), hostname: endpoint.hostname, sni: endpoint.hostname,
    port: endpoint.port, resolvedAddress: endpoint.address, connectedAddress: null, connectionAttempted:false,
    profile, clientCapability: configured, status: 'inconclusive', certificateValidation: {status:'not-completed'},
    appliedLimits:{probeMs:limits.probeMs,incomingBytes:limits.incomingBytes,outgoingBytes:limits.outgoingBytes},
    bytes: {received:0,sent:0}, protocol:null, cipher:null, keyExchangeGroup:null, certificate:null
  };
  if (signal?.aborted) return Promise.resolve({...observation,status:'timeout',error:{code:'QR_TIMEOUT',message:'Assessment deadline exceeded before this connection; no connection attempted.'}});
  if (aggregateBytes.received >= limits.assessmentIncomingBytes || aggregateBytes.sent >= limits.assessmentOutgoingBytes) return Promise.resolve({...observation,status:'limit-exceeded',error:{code:'QR_BYTE_LIMIT',message:'Assessment byte budget exhausted before this connection; no connection attempted.'}});
  if (configured.status === 'unsupported') return Promise.resolve({...observation,status:'tool-unsupported'});
  return new Promise(resolve => {
    let completed = false;
    let secure;
    observation.connectionAttempted=true;
    const raw = net.connect({host:endpoint.address, port:endpoint.port, family:endpoint.family});
    const wire = boundedWire(raw, limits, observation.bytes, aggregateBytes);
    // Errors before TLS owns the stream must still be handled.
    wire.on('error', error => finish(error));
    const timer = setTimeout(() => finish(Object.assign(new Error('TLS probe deadline exceeded.'), {code:'QR_TIMEOUT'})), limits.probeMs);
    const onAbort = () => finish(Object.assign(new Error('Assessment deadline exceeded.'), {code:'QR_TIMEOUT'}));
    signal?.addEventListener('abort', onAbort, {once:true});
    function finish(error) {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error) {
        const code = String(error.code || 'TLS_ERROR').slice(0,100);
        const certificateError = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|HOSTNAME|ISSUER/.test(code);
        observation.status = code === 'QR_TIMEOUT' ? 'timeout' : code === 'QR_BYTE_LIMIT' ? 'limit-exceeded' : certificateError ? 'certificate-error' : /NO_SUITABLE|NO_SHARED|HANDSHAKE_FAILURE|ALERT_HANDSHAKE/.test(code) ? 'bounded-negative' : 'error';
        observation.error = {code, message:String(error.message).slice(0,500)};
        if (certificateError) observation.certificateValidation = {status:'failed', code};
      }
      observation.finishedAt=new Date().toISOString();
      // Close the local socket before another sequential probe may begin.
      if(raw.closed)resolve(observation);
      else raw.once('close',()=>resolve(observation));
      secure?.destroy(); wire.destroy(); raw.destroy();
    }
    raw.once('connect', () => {
      observation.connectedAddress = raw.remoteAddress;
      try {
        if(canonicalAddress(raw.remoteAddress)!==canonicalAddress(endpoint.address)) throw Object.assign(new Error('Connected numeric address did not match the selected destination.'),{code:'QR_ADDRESS_MISMATCH'});
        secure = tls.connect({socket:wire, servername:endpoint.hostname, rejectUnauthorized:true,
          checkServerIdentity:tls.checkServerIdentity, ca, minVersion:profile.protocol, maxVersion:profile.protocol,
          ecdhCurve:profile.groups, ciphers:profile.ciphers, ALPNProtocols:['http/1.1'] });
        secure.once('error', finish);
        secure.once('secureConnect', () => {
          try {
            const cert = secure.getPeerX509Certificate();
            const group = secure.getEphemeralKeyInfo();
            observation.protocol = secure.getProtocol();
            observation.cipher = secure.getCipher();
            observation.keyExchangeGroup = group?.name ?? null;
            observation.ephemeralKey = group || null;
            observation.certificateValidation = {status:secure.authorized ? 'verified':'failed', trust:ca ? 'isolated demonstration CA':'runtime public trust store', hostnameChecked:endpoint.hostname};
            observation.certificate = cert ? {
              subject:cert.subject, issuer:cert.issuer, subjectAltName:cert.subjectAltName,
              validFrom:cert.validFrom, validTo:cert.validTo, fingerprint256:cert.fingerprint256,
              publicKeyType:cert.publicKey.asymmetricKeyType ?? 'unknown', publicKeyDetails:Object.fromEntries(Object.entries(cert.publicKey.asymmetricKeyDetails ?? {}).map(([name,value])=>[name,typeof value==='bigint'?value.toString():value])),
              signatureAlgorithm:cert.signatureAlgorithm ?? null, signatureAlgorithmOid:cert.signatureAlgorithmOid ?? null
            } : null;
            observation.status = secure.authorized ? 'negotiated':'certificate-error';
            finish();
          } catch(error) { finish(error); }
        });
      } catch(error) { finish(error); }
    });
    if (signal?.aborted) onAbort();
  });
}
