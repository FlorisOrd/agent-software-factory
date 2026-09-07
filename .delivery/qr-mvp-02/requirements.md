Implement **QR-MVP-02 — multi-address quantum-readiness coverage** in `FlorisOrd/agent-software-factory`.

Use the Factory delivery workflow already merged on `main`. The current production baseline is the merged QR-MVP-01 implementation. Inspect live `main`, existing instructions, product source, CI, issues and PRs before changing anything.

### Business outcome

Improve the private quantum-readiness website pilot once before its first real-world assessment.

The current scanner validates all DNS answers but measures only one selected address. QR-MVP-02 must give the owner a more representative, still tightly bounded view when one authorized hostname resolves to multiple public IPv4/IPv6 addresses.

Do not redesign the product or broaden it into a general vulnerability scanner.

### Required behavior

For one explicitly authorized hostname:

1. Resolve the hostname once using the existing bounded DNS process.
2. Validate **all** applicable returned IPv4/IPv6 destinations before making any connection.
3. If any required DNS result is unsafe, malformed, mismatched or otherwise violates the existing production target policy, fail closed before any probe.
4. Select a small deterministic, documented sample of validated addresses that improves IPv4/IPv6 and multi-edge coverage while maintaining strict limits.
5. Run the existing classical TLS 1.3 and `X25519MLKEM768` hybrid TLS 1.3 profiles against each selected address.
6. Pin each connection to its selected numeric address while retaining the requested hostname for SNI and certificate hostname verification.
7. Do not perform a second DNS resolution during probing.
8. Record:

   * every resolved validated address;
   * which addresses were selected;
   * which were not selected;
   * the reason/cap;
   * every observation's exact connected address;
   * time and client probe profile.
9. Aggregate the report without losing the per-address evidence.

### Cross-address interpretation

Add explicit, evidence-backed interpretation for observed differences between assessed addresses.

Examples include:

* hybrid key establishment measured on some assessed addresses but not successfully measured on others;
* different classical groups;
* certificate-validation or evidence-coverage differences.

Describe these as **observed deployment inconsistency / incomplete coverage**, not proof that an unmeasured capability is absent.

A bounded-negative hybrid offer still does not prove the endpoint lacks PQ support.

A successful hybrid handshake on one address still does not establish:

* post-quantum authentication;
* readiness of every address;
* readiness of the origin;
* readiness of internal systems;
* whole-company quantum safety.

Do not introduce an overall numeric score.

### UI/report

Make the owner-facing report clearly show:

* hostname;
* total validated DNS addresses;
* number assessed;
* exact assessed addresses;
* unassessed count and sampling limitation;
* per-address findings/evidence;
* any observed cross-address inconsistency;
* migration actions and validation steps.

HTML and JSON exports must preserve the complete original observations and sampling metadata.

Keep the report understandable in nontechnical language while retaining the technical appendix.

### Scope control

This iteration is intentionally limited.

Do NOT add:

* TLS 1.2 scanning;
* additional RFC 10024 hybrid groups;
* crawling/subdomain discovery;
* port scanning;
* internal network scanning;
* exploitation;
* authentication attempts;
* public SaaS/multi-tenancy;
* accounts/payments;
* scheduled scans;
* automatic remediation;
* deployment;
* customer scans.

Keep the existing trusted-local-operator model.

### Security requirements

Preserve or strengthen all current safeguards:

* target-bound permission before DNS/probing;
* strict hostname input;
* public IPv4/IPv6 validation;
* no private/loopback/link-local/metadata/reserved production destinations;
* DNS-rebinding resistance;
* numeric connection pinning;
* normal certificate and hostname verification;
* no redirects/proxy/certificate-URL fetching;
* connection, byte, concurrency and time limits;
* loopback UI;
* Host/Origin/CSRF protections;
* safe rendering and exports;
* ephemeral bounded report retention.

Update global limits deliberately for the new maximum number of probes. Keep the number of network connections low and documented.

Do not weaken validation merely to make multi-address tests work.

### Controlled acceptance

Use only task-owned controlled endpoints and instrumentation.

Acceptance requires at least:

A. A multi-address controlled hostname where two or more real task-owned endpoints are actually contacted and their connected addresses are separately preserved.

B. A controlled mixed-posture case that demonstrates an evidence-backed cross-address inconsistency finding.

C. A consistent multi-address case that does not manufacture an inconsistency.

D. Mixed safe/unsafe DNS results fail before **any** connection.

E. IPv4/IPv6 selection and the deterministic cap are independently tested, including more DNS results than the sampling cap.

F. No DNS re-resolution occurs after selection; each selected probe is pinned to the intended numeric address.

G. Classical/hybrid classification, certificate handling, error/inconclusive handling, exports and business-context logic from QR-MVP-01 remain correct.

H. Existing QR-MVP-01 product tests and Factory checks remain green.

I. Browser-level testing demonstrates the new coverage UI and exported sampling metadata.

J. A different native verifier reviews the exact final candidate, independently reruns relevant checks, examines the network-boundary changes and verifies the controlled multi-address behavior.

### Delivery

Use separate native builder and independent verifier agents.

Preserve failures and fixes.

Deliver one draft PR, unmerged, with:

* exact base/head/tree;
* changed files;
* controlled demonstrations;
* test results;
* CI results tied to the exact candidate/merge test commit;
* original builder/verifier identities and evidence;
* remaining limitations;
* rollback.

Do not ask me technical implementation questions. Make reasonable technical choices yourselves.

No customer or third-party system may be scanned during QR-MVP-02.

Proceed now.
