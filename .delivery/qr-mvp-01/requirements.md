# QR-MVP-01 — Website quantum-readiness assessment and migration plan

## Role and delivery

You are a fresh production Codex lead. Use the saved Factory delivery workflow. Delegate implementation to a native builder and assessment to a different native verifier; do not accept the builder's explanation as proof. ChatGPT coordinates and performs final independent product verification. Deliver one small draft PR, unmerged, with a working demonstration and exact-commit evidence.

## Requirement and authority

The owner's new product request is: a tool that scans companies' software, initially exemplified by websites, for weaknesses relevant to quantum-computer attacks and delivers a plan/solutions.

This handoff translates that request into one bounded first product slice: an authorized website's externally observable cryptographic posture plus an evidence-backed migration plan. It does not authorize exploitation, changes to customer systems, public deployment, new spending, or scans of unspecified third parties.

Working implementation defaults, not claimed as previously specified owner requirements: a private, single-operator pilot; one explicitly authorized public HTTPS hostname at a time; a simple local browser interface and exportable HTML/JSON reports; no accounts, payments, external model API, scheduled scanning, multi-tenant service, or customer-specific integrations. These are reversible choices for demonstrating the product, not a settled commercial model or brand.

No live customer hostname or permission has been supplied. Demonstrate and test against isolated, task-owned endpoints. Do not ask the owner to operate Git, install dependencies, run commands, inspect logs, or relay specialist prompts. Agents perform all setup, testing and technical work.

## Repository and preservation

Use only `FlorisOrd/agent-software-factory` with existing authorized access. Last live main readback on 6 September 2026:

- Commit: `223850dd8f909fcddef52dcc2bb5aff865f4472f`
- Previously verified tree at that commit: `c2cca07b906792e7ea8bb2000aa754aec3a305b3`

Recheck live refs, open work, worktree and applicable instructions before writing. Read `AGENTS.md` and `.agents/skills/factory-delivery/SKILL.md`. The initial milestone's statement that the Factory itself was the product is historical context; the owner's new request establishes the first customer-facing product. Preserve that completed milestone rather than rewriting its history.

Keep the prototype in a clearly separated `products/quantum-readiness/` directory. Choose a small maintained stack based on the actual environment and supported cryptographic inspection APIs. Update root documentation or CI only where integration requires it, without weakening existing checks. Do not create or alter another repository, introduce a new orchestration platform, restart the foundation evaluation, or modify Tailor, factory-foundation-evaluation, or preserved bake-off evidence.

## Required user journey

1. The operator enters one public HTTPS hostname and explicitly confirms permission for this particular assessment. Optional business inputs are data sensitivity and how long confidentiality matters; omitted answers remain unknown.
2. The backend performs a small, bounded set of ordinary TLS handshakes to that hostname on port 443. No crawling, subdomain discovery, port sweep, login attempts, payload exploitation or customer-system modifications.
3. The report explains what was observed, the quantum-related implications, limitations and a prioritized migration plan. It includes a technical evidence appendix and downloadable HTML/JSON. Agents launch and demonstrate the interface; the owner is not the technical operator.

Use a real TLS-capable backend, not browser JavaScript pretending to inspect the remote connection. Use supported maintained cryptographic implementations; do not implement cryptography from scratch. Findings and suggested actions must be generated from explicit, versioned rules rather than an unconstrained language model. An AI explanation service is not needed for this slice.

## Observation and interpretation contract

Capture the normalized hostname, port, resolved/connected public IP, timestamp, SNI, scanner/runtime version, offered probe profile, negotiated protocol, cipher, actual key-exchange group where observable, and presented certificate public-key/signature metadata. Report certificate validation separately. Record only non-secret evidence, not private keys, session secrets, application traffic, cookies or credentials.

Support at least a classical profile and a standards-based hybrid-PQC-capable profile. Distinguish successful negotiation, a documented bounded negative result, and inconclusive/tool-unsupported/error. Record the client capability and offers. A classical negotiation is not proof that the server supports no hybrid configuration; a failed PQ probe may be a network/tool problem. Do not generalize beyond the profiles, endpoint, address and time tested.

Keep these concepts separate:

- Key establishment and confidentiality exposure, including possible future decryption of recorded traffic.
- Certificate/handshake authentication and signature migration.
- Symmetric encryption and hashes; do not automatically classify AES as broken by quantum computers.
- Conventional TLS hygiene findings, if collected, clearly separate from quantum-readiness findings.

A TLS 1.3 label or AES cipher does not establish PQ key exchange. An RSA/ECDSA certificate does not identify the negotiated key-exchange group. A hybrid key exchange does not establish PQ authentication or whole-company security. An increased RSA key size is not a PQ migration solution.

External observations cover the exposed TLS endpoint, potentially a provider edge. Do not infer the origin server, internal traffic, databases, backups, source code, VPN, signing infrastructure, all client behavior or all company assets. Provider attribution must be evidence-qualified; uncertain attribution remains unknown.

Do not report compromise, current quantum exploitability, a guaranteed date of quantum capability, legal compliance, certification, or a blanket "quantum safe" verdict. Use qualitative finding categories with evidence coverage, not an invented probability or security score out of 100.

## Remediation output

For each finding provide the observation reference, interpretation, confidence/limitation, priority rationale, suggested next action, responsible party to confirm, dependencies, validation method and rollback considerations. Business-priority assumptions must be labelled operator-supplied or unknown.

Recommend provider/library-supported standards-based migration where applicable, including hybrid ML-KEM key establishment where supported. Signature/certificate migration is a separate workstream; finalized signature algorithms do not imply deployable public-Web-PKI support everywhere. Check current vendor documentation before giving vendor/version-specific instructions. Never fabricate a setting, compatibility promise, cost or migration estimate.

Include a sequence of confirm scope and data lifetime, identify the responsible vendor/system, pilot a supported configuration in staging, test compatibility and performance, deploy only under separate authorization, then rescan. If only general advice is justified, label it as a proposed action requiring verification, not a verified solution. No automatic remediation in this slice.

## Scanner security and privacy

Bind permission to the normalized target; reject absent authorization before network probing. A declaration is a private-pilot workflow control, not independent proof of domain ownership. Public self-service release would need separate abuse prevention and authorization design.

Validate hostname and port, reject credentials/paths and unsafe URL forms, and avoid shell interpolation. Resolve and validate all applicable IPv4/IPv6 results; reject private, loopback, link-local, metadata, reserved and other non-public destinations in normal operation. Pin each connection to a validated address while retaining correct SNI/hostname validation; prevent DNS-rebinding and re-resolution bypasses. Do not follow redirects, certificate-supplied URLs, or proxy settings into other destinations. Cap connections, bytes, concurrency and deadlines; make limits testable.

The task-owned local test harness may use private endpoints only through an isolated test-only transport/configuration that is not exposed as a user-controlled production bypass. Never relax normal target validation to make a demonstration pass.

Bind the pilot interface to loopback, restrict origins/hosts, and protect scan actions from cross-site requests. Treat every hostname, certificate field and error string as untrusted data; escape report/UI output and prevent unsafe file paths and command injection. Do not log secrets or send reports to third-party services. Explain any local retention and export behavior.

## Acceptance and tests

A. A real task-owned classical endpoint produces a measured report with a quantum-migration finding tied to observed key establishment, not merely its certificate or TLS version.

B. A real task-owned hybrid-capable endpoint successfully negotiates a supported standardized hybrid group with the capable probe. The report recognizes that connection property while separately describing classical authentication and unassessed systems. Client support must be demonstrated, not inferred from a version string. A parser mock alone does not satisfy this criterion.

C. Missing probe capability, unrecognized algorithms, TLS failure, certificate-validation failure and timeout produce accurately scoped results or incomplete assessment. They never become "no risk", "no PQ support" or a clean overall pass without sufficient evidence. Do not silently disable certificate validation.

D. No permission and unsafe targets are rejected before connection. Independently test IPv4/IPv6, alternative input forms, DNS changes, scope escape and malicious report fields. Demonstrate bounded operation and the separation of the test-only transport.

E. Every finding links to actual observations and a dated authoritative rule source. The plan has actionable next steps and verification criteria, labels business assumptions and unknown provider details, and never changes the assessed system.

F. A browser-level happy path, error path and report export work. The technical report preserves the original observation data and scope limitations. Clearly label demo targets and fixture data.

G. Relevant unit, integration, security and browser checks run in the chosen environment and CI. Preserve original failures and fixes. Keep existing Factory checks passing. The independent verifier inspects the exact candidate, reruns relevant checks, reviews the cryptographic classifications and scanner network boundaries, and cites actual evidence.

H. Publish one draft PR with exact base/head/tree, original check results, tested CI SHA, demonstration references, separate native task IDs, remaining limitations and rollback. Read back the remote head. No merge, deployment or customer scan is authorized by this handoff.

If an essential requirement cannot be demonstrated, report the precise unmet criterion and preserved failure as PARTIAL/BLOCKED. Do not hide the gap behind a successful static check or restart broad infrastructure research.

## Authoritative implementation references

Checked for this brief on 6 September 2026. Recheck relevant current versions during implementation; distinguish final standards from drafts and vendor support from algorithm standardization.

- NIST, What Is Post-Quantum Cryptography? https://www.nist.gov/cybersecurity-and-privacy/what-post-quantum-cryptography
- NIST PQC standards and program: https://csrc.nist.gov/Projects/Post-Quantum-Cryptography
- NIST PQC FAQs, including symmetric-key guidance: https://csrc.nist.gov/Projects/post-quantum-cryptography/faqs
- NIST NCCoE, Migration to PQC: https://www.nccoe.nist.gov/applied-cryptography/migration-to-pqc
- IETF RFC 10024, PQ/traditional hybrid key agreement for TLS 1.3: https://datatracker.ietf.org/doc/rfc10024/
- IETF RFC 9846, TLS 1.3: https://www.rfc-editor.org/info/rfc9846/
- OWASP SSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

## Owner report

Return `IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION` or `PARTIAL/BLOCKED`, followed by what the owner can use, what was actually demonstrated, important limitations, any necessary business decision and the draft PR reference. Keep the technical evidence available without asking the owner to audit it.
