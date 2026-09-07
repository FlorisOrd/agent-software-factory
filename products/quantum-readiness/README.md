# Quantum-readiness private pilot

A local, single-operator assessment of an explicitly authorized HTTPS hostname.
The backend selects at most three validated addresses and makes two ordinary TLS
1.3 handshake offers per address, with at most six sequential connections. It
measures negotiated groups and certificate metadata, compares per-address evidence,
and creates an evidence-backed proposed migration plan.
It does not crawl, exploit, authenticate to, or modify the target.

Use a maintained Node.js **24.19 or newer in the Node 24 line**. The measured local
baseline is Node 24.19.0 with OpenSSL 3.5.7. CI uses the latest Node 24 release.
Cryptography comes from Node/OpenSSL. Group capability is checked by configuring a
real TLS context; a successful measured handshake, rather than the version label,
demonstrates hybrid negotiation. There are no production npm dependencies.

From this product directory:

```sh
npm ci
npm start
```

The private interface listens only at `http://127.0.0.1:8787`. Enter a bare public
hostname (not a URL or IP address), confirm permission for that exact normalized
target, optionally supply sensitivity/confidentiality lifetime, and assess it.
Port 443 is fixed. No customer target is preauthorized by this repository or demo.

For the entirely controlled demonstration:

```sh
npm run demo
```

Open `http://127.0.0.1:8788`. The separate demonstration entry point creates seven
task-owned loopback fixtures: classical TLS, standardized hybrid TLS, invalid
certificate hostname, a silent endpoint that times out, mixed-posture IPv4/IPv6,
consistent IPv4/IPv6, and four-address sampling with three selected destinations.
Each multi-address hostname has real task-owned listeners on distinct numeric
addresses at the same port; IPv6 loopback support is required for these checks.
OpenSSL CLI is needed
only to generate ephemeral fixture certificates. On Windows it defaults to Git's
OpenSSL; `QR_OPENSSL` may select a trusted executable for this test harness. Keys
are generated in a task-owned OS temporary directory, never reported or committed,
and removed when the harness closes normally. An abrupt OS/process termination
may leave that temporary directory; it contains only synthetic fixture keys.
The normal scanner imports no harness or test bypass. Demo input can select only
the seven owned fixtures, and every demo report is explicitly labelled. Fixture
address inventory is not presented as public DNS validation. Production policy is
tested separately with DNS and socket instrumentation that makes no public connection.

Reports display findings, dated rule sources, observation links, a six-step plan,
and a technical appendix. Downloadable JSON preserves the original report; HTML
includes all original observations and a complete JSON appendix. Reports are
stored only in process memory, expire after 30 minutes, and are capped at 20;
restarting clears them. Downloaded files remain where the operator saves them.
No report or target is sent to a model, analytics service or third-party store.

## Interpretation and coverage

The versioned rules in `src/rules.mjs` were reviewed on 6 September 2026 using
[RFC 10024](https://datatracker.ietf.org/doc/rfc10024/),
[NIST PQC guidance](https://www.nist.gov/cybersecurity-and-privacy/what-post-quantum-cryptography),
[NIST symmetric-key guidance](https://csrc.nist.gov/Projects/post-quantum-cryptography/faqs),
and [NCCoE migration guidance](https://www.nccoe.nist.gov/applied-cryptography/migration-to-pqc).
Runtime evidence uses supported
[Node TLS](https://nodejs.org/docs/latest-v24.x/api/tls.html#tlssocketgetephemeralkeyinfo)
and [X509 certificate APIs](https://nodejs.org/docs/latest-v24.x/api/crypto.html#x509signaturealgorithm).

| Probe | Exact offer | What it establishes |
| --- | --- | --- |
| Classical TLS 1.3 | X25519, P-256, P-384 | The measured classical connection; does not rule out hybrid support under another offer. |
| Hybrid TLS 1.3 | X25519MLKEM768 only | If successfully negotiated, this standardized hybrid key establishment property on this connection. |

Both profiles offer TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256,
and TLS_AES_128_GCM_SHA256. Validation uses the runtime trust store and the
normalized hostname. The isolated harness explicitly trusts its own ephemeral
certificate while retaining hostname verification. Verification is never disabled.

Evidence is limited to up to three selected validated addresses, two profiles and
one time. A single bounded A/AAAA resolution is completed first; all answers must
pass the public destination and family policy before deduplication or sampling.
An unsafe answer beyond the sampling cap still prevents every connection.

Sampling strategy `numeric-sort-family-interleave-v1` canonicalizes equivalent
IPv6 spellings, deduplicates numeric addresses, sorts each family numerically, then
alternates IPv4 first and IPv6 second while available. The first three are selected.
Both families are therefore included when both exist. This repeatable sample gives
more edge coverage but is not random, exhaustive, or representative of every edge.
The 16-answer input cap includes duplicate answers and is checked before sampling.

`scope.validatedDnsAnswers` preserves every original returned address/family,
including duplicate spellings. `scope.resolvedAddresses` lists unique canonical
validated destinations; `scope.sampling` records original/unique/duplicate counts,
strategy, cap/reason, selected and unselected lists, and actually assessed addresses.
An address is **assessed** when at least one numeric connection was attempted,
including refusal or timeout; this does not mean TLS succeeded. Deadline/budget
skips remain selected but unassessed. Each original observation records whether a
connection was attempted, its selected and actual connected address, profile,
SNI, timestamp, outcome and certificate evidence. Multi-address observation IDs
include the address; `profile.id` stays stable for like-for-like comparisons.

The report separates per-address profile gaps from cross-address differences.
Different measured hybrid outcomes, classical groups, certificate-validation
outcomes or evidence completeness produce scoped inconsistency/coverage findings.
Equivalent outcomes do not manufacture a difference, including uniformly rejected
hybrid offers. Missing or unsuccessful measurements never prove absent PQ support.
TLS 1.2, other groups, unselected addresses and client populations are untested.
Key establishment, classical certificate authentication, symmetric
ciphers and incomplete/conventional TLS evidence remain separate. The live
CertificateVerify signature algorithm and full certificate-chain algorithms are
not exposed/inventoried; presented leaf key/signature metadata is recorded.

Invalid trust/hostname, unknown algorithms, missing client capability, TLS errors,
byte limits and timeouts produce scoped incomplete evidence. A rejected hybrid
offer does not prove that an endpoint has no PQ support. TLS 1.3, AES and an RSA/EC
certificate do not identify the key-exchange group. AES is not automatically
classified as quantum-broken. A hybrid handshake does not establish PQ
authentication, readiness of every address or the origin, or whole-company safety.

Provider attribution is unknown. Internal systems, source code, databases,
backups, VPNs and other assets are unassessed. No security score, quantum-computer
arrival date, compliance/certification or compromise claim is produced. Actions
are proposed and require provider verification, staging tests and separate
deployment authorization; there are no invented vendor settings or automatic
remediations. Business answers are operator-supplied or explicitly unknown.

## Network and local-interface boundaries

- Permission must match the normalized target before DNS or probing. The
  declaration is a workflow control, not independent proof of ownership. A public
  or multi-tenant service requires a separate authorization/abuse-prevention design.
- Hostnames use a strict ASCII hostname grammar; URLs, IP literals, userinfo,
  ports other than 443, paths, zones and alternative numeric IP forms are rejected.
  IDNs must use their ASCII punycode representation. Trailing-dot names are rejected.
- All returned IPv4/IPv6 addresses must be public. Special/private/reserved ranges,
  metadata, mapped/transition addresses and documentation blocks are conservatively
  rejected. IPv6 is limited to ordinary global 2000::/3 excluding special blocks.
  This conservative policy can reject otherwise usable exceptional addresses.
- Each assessment owns a cancellable DNS resolver, checks A and AAAA, and pins each
  numeric TCP connection to its selected validated address while retaining the requested
  SNI and certificate hostname validation. There is no second hostname resolution,
  proxy use, redirect following, certificate-URL fetching or application request.
- Per assessment: at most three addresses and six sequential connections, one
  active assessment, a 2-second DNS deadline, 4.5 seconds per TLS probe and a
  30-second overall abort deadline. The prior socket is closed before the next
  probe starts. Expired deadlines and exhausted aggregate byte budgets prevent
  subsequent connections and retain skipped observations as incomplete evidence.
  A bounded stream below TLS stops before processing data beyond 128 KiB incoming
  or 32 KiB outgoing encrypted traffic per probe; counters include the read/write
  chunk that triggers the stop. Aggregate encrypted-byte processing budgets are
  768 KiB incoming and 192 KiB outgoing per assessment; a shared counter stops
  later probes once exhausted. Kernel buffering can receive the triggering chunk,
  so reported byte counters can exceed a budget by that chunk; these are processing
  stop limits, not a hard bound on bytes delivered by the kernel.
- The loopback interface requires its exact Host, same Origin and an unpredictable
  request token for assessment. It rejects cross-site requests, limits bodies to
  2 KiB with a 5-second body deadline, permits six attempts per minute, caps sockets
  at 16 and stores at most 20 timed reports. Strict content policy, text rendering,
  escaped HTML and fixed export names protect against untrusted evidence fields.
  Each batch of six admitted assessments permits at most 36 probe connection
  attempts and nominal total processing budgets of 4.5 MiB incoming / 1.125 MiB
  outgoing, with the same triggering-chunk qualification. Admission is capped at
  six attempts per minute; probes can span admission windows. No retry is performed.

These controls follow the
[OWASP SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
and conservative interpretation of the
[IANA IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/) and
[IPv6 special-purpose registries](https://www.iana.org/assignments/iana-ipv6-special-registry/).
This pilot assumes a trusted local operator and machine, with no hostile local
process reading browser memory or modifying the installed source/runtime.

## Reproducible checks

```sh
npm test
npx playwright install chromium
npm run test:browser
```

The unit/security suite exercises authorization, IPv4/IPv6 and unsafe inputs,
mixed DNS (including invalid answers beyond the sample cap), deterministic IPv4/IPv6
selection, duplicate handling, cancellation before later probes, numeric
pinning/rebinding resistance, local request
boundaries, concurrency and malicious HTML. Integration tests use real TLS for
classical/hybrid negotiation, trust/hostname failure, unknown/unsupported groups,
timeouts, byte limits and exports. Only specifically labelled unit transport
instrumentation and hostile-rendering cases are mocked; they do not stand in for
the real hybrid demonstration. Multi-address integration contacts real distinct
IPv4/IPv6 loopback endpoints for mixed and consistent posture and proves the
fourth address is unselected and uncontacted. Browser tests cover the full form,
seven fixtures, coverage counts, per-address findings, complete HTML/JSON sampling
exports, unique evidence links and narrow-screen report layout. The additional
browser demonstration uses a second isolated process with its own normal rate
window; the production rate limit is not bypassed. CI runs all these checks and
preserves the original Factory checks.

`QR_BROWSER_EXECUTABLE` can select a locally installed compatible browser (for
example Edge) for the browser suite; CI installs Playwright's Chromium. Generated
non-secret evidence is under `.artifacts/`, ignored by Git and selectively uploaded
by CI. Local builder/verifier logs live in the delivery evidence directory. No
private-key glob is uploaded. Reverting the QR-MVP-02 delivery PR restores the
QR-MVP-01 single-address scanner; no
remote customer configuration or deployment needs rollback.
