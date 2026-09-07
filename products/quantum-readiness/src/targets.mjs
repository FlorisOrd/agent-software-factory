import { isIP } from 'node:net';
import { Resolver } from 'node:dns/promises';

export function normalizeHostname(value) {
  if (typeof value !== 'string' || value.length > 253) throw new Error('Enter one bare public hostname, without a URL, port or path.');
  const host = value.trim().toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host) || !host.includes('.') || isIP(host) || host.endsWith('.') || host.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('Enter one bare public hostname, without a URL, port or path.');
  }
  // Numeric and alternative numeric-address forms are never treated as hostnames.
  if (/^[\d.]+$/.test(host) || /^(?:0x[\da-f]+|\d+)(?:\.(?:0x[\da-f]+|\d+))*$/i.test(host)) throw new Error('IP address input is not supported.');
  return host;
}

function ipv4Number(ip) { return ip.split('.').reduce((n, part) => n * 256 + Number(part), 0); }
function v4Range(ip, base, bits) { const size = 2 ** (32 - bits); return Math.floor(ip / size) === Math.floor(ipv4Number(base) / size); }
function ipv6Number(address) {
  const parts = address.toLowerCase().split('::');
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  const words = parts.length === 1 ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return words.reduce((n, word) => (n << 16n) | BigInt(`0x${word}`), 0n);
}
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4Number(address);
    return ![['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]].some(([base,bits]) => v4Range(value,base,bits));
  }
  if (family !== 6 || address.includes('.') || address.includes('%')) return false;
  const value = ipv6Number(address);
  const inRange = (base,bits) => value >> BigInt(128-bits) === ipv6Number(base) >> BigInt(128-bits);
  return inRange('2000::',3) && ![['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]].some(([base,bits]) => inRange(base,bits));
}

export function validateRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('An assessment request is required.');
  const hostname = normalizeHostname(input.hostname);
  if (input.port !== undefined && input.port !== 443) throw new Error('Only HTTPS port 443 is supported.');
  if (input.authorized !== true || input.authorizedHostname !== hostname) throw new Error('Confirm permission for this exact normalized hostname before assessment.');
  const sensitivity = input.sensitivity ?? 'unknown';
  const confidentiality = input.confidentiality ?? 'unknown';
  if (!['unknown','public','internal','sensitive'].includes(sensitivity) || !['unknown','under-1-year','1-10-years','over-10-years'].includes(confidentiality)) throw new Error('Choose a listed business context, or leave it unknown.');
  return { hostname, port: 443, sensitivity, confidentiality };
}

export async function resolvePublicTarget(hostname, { resolver, deadlineMs = 2000 } = {}) {
  const ownedResolver = resolver ? null : new Resolver({timeout:deadlineMs,tries:1});
  const resolve = resolver ?? (async name => {
    const answers = await Promise.allSettled([ownedResolver.resolve4(name),ownedResolver.resolve6(name)]);
    const result=[];
    for (const [index,answer] of answers.entries()) {
      if (answer.status==='fulfilled') result.push(...answer.value.map(address=>({address,family:index===0?4:6})));
      else if (!['ENODATA','ENOTFOUND'].includes(answer.reason?.code)) throw new Error('DNS lookup was incomplete; no connection was attempted.');
    }
    return result;
  });
  let timer;
  const results = await Promise.race([
    resolve(hostname),
    new Promise((_,reject) => { timer = setTimeout(() => { ownedResolver?.cancel(); reject(new Error('DNS resolution deadline exceeded.')); }, deadlineMs); })
  ]).finally(() => { clearTimeout(timer); ownedResolver?.cancel(); });
  if (!Array.isArray(results) || !results.length || results.length > 16) throw new Error('DNS returned no addresses or exceeded the 16-address limit.');
  if (results.some(item => !isPublicAddress(item.address) || isIP(item.address) !== item.family)) throw new Error('All resolved IPv4 and IPv6 addresses must be public destinations.');
  // All applicable answers have passed validation. Both probes use this same pinned IP.
  return { hostname, port: 443, address: results[0].address, family: results[0].family, resolvedAddresses: results.map(({address,family}) => ({address,family})) };
}
