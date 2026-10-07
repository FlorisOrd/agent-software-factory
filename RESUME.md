# Resume Agent Software Factory

## Start here

1. Read this file, [AGENTS.md](AGENTS.md), [.agents/skills/factory-delivery/SKILL.md](.agents/skills/factory-delivery/SKILL.md), [README.md](README.md), and [docs/ASF-MVP-01.md](docs/ASF-MVP-01.md).
2. Read the recovery mapping and exact preservation commit in [FlorisOrd/project-index](https://github.com/FlorisOrd/project-index). Restore the selected preservation state and original delivery evidence before changing anything.
3. Inspect the live GitHub branches and [PR #3](https://github.com/FlorisOrd/agent-software-factory/pull/3). Its unmerged draft is not approved production work.
4. Establish a bounded owner request and follow the saved delivery workflow with separate native implementation and verification agents.

## Purpose and current state

Canonical repository: [FlorisOrd/agent-software-factory](https://github.com/FlorisOrd/agent-software-factory), private. The project supplies a reusable Codex development team through its repository skill. Its first product is a private, single-operator quantum-readiness HTTPS assessment interface.

Verified GitHub state on 7 October 2026:
- Approved/merged development baseline: main, dbdee018e5a128b08b413f4d1a71128256a58aec (QR-MVP-01).
- Latest implemented alternative: codex/qr-mvp-02, e8fab07547c6ccaaae9b83be350332caf47e1a6b, tree 3bef42af1bde25afb715ff69efbe06117b599ea5.
- PR #3 remains open, draft and unmerged. QR-MVP-02 adds deterministic bounded assessment of up to three validated IPv4/IPv6 addresses and at most six TLS probes.
- Earlier delivery lines codex/asf-mvp-01-native-delivery and codex/qr-mvp-01, local reflog-only work, and original delivery artifacts are retained through the project-index recovery map.

The original delivery records are [.delivery/qr-mvp-01/SESSION.md](.delivery/qr-mvp-01/SESSION.md) and [QR-MVP-02 session at its original commit](https://github.com/FlorisOrd/agent-software-factory/blob/e8fab07547c6ccaaae9b83be350332caf47e1a6b/.delivery/qr-mvp-02/SESSION.md). They record starting status; final outcomes are in the linked PR discussions and preserved ignored evidence. The final QR-MVP-02 [delivery record](https://github.com/FlorisOrd/agent-software-factory/pull/3#issuecomment-5568373722) and [independent review](https://github.com/FlorisOrd/agent-software-factory/pull/3#pullrequestreview-5130212078) report 23 product checks, 16 browser checks, six additional adversarial checks and Factory checks passing on that exact candidate. These are historical results, not a new verification of a later change.

## Restore, install and check

Use Git and a maintained Node.js 24 release at least 24.19.0. Original local validation used Node 24.19.0/OpenSSL 3.5.7; CI used Node 24.20.0. The old laptop's PATH Node 16.13.2 was unsuitable. Native Codex delegation and authorized GitHub access are prerequisites for the Factory workflow.

From repository root:

```sh
node --check scripts/check-workflow.mjs
node scripts/check-workflow.mjs
cd products/quantum-readiness
npm ci
npm test
npm start
```

The interface listens at http://127.0.0.1:8787. For controlled demonstrations and browser checks:

```sh
npm run demo
npx playwright install chromium
npm run test:browser
```

The demo listens at http://127.0.0.1:8788. OpenSSL CLI is required for ephemeral synthetic fixture certificates; IPv6 loopback is required for multi-address checks. Optional environment variables: QR_OPENSSL selects a trusted OpenSSL executable; QR_BROWSER_EXECUTABLE selects an installed compatible browser. No application secret values are required. GitHub authorization must be restored through the authorized account's existing credential mechanism; do not place tokens in this repository.

## Assets, evidence and limits

Preserve and restore the original .delivery/qr-mvp-01 and .delivery/qr-mvp-02 logs, reports, screenshots, original review source, CI logs and CI ZIPs, plus products/quantum-readiness/.artifacts. These were ignored locally but are material historical evidence. Their final archive locations and SHA-256 manifests are recorded in project-index. Do not rely on GitHub Actions artifact retention alone.

node_modules is a restorable dependency installation from package-lock.json. Fixture keys are ephemeral synthetic keys, generated in an OS temporary directory; they are not required recovery secrets. Downloaded customer reports, if separately present in the recovery index, require their own preservation route. Ordinary reports are in-memory only (30-minute expiry, maximum 20).

The scanner requires explicit authorization for the exact hostname. Cleanup does not authorize customer assessments, releases, deployment, or merging PR #3. Results are bounded point-in-time evidence; successful hybrid negotiation does not prove whole-company readiness. Read the detailed coverage and network boundaries in [the product README](products/quantum-readiness/README.md).

## Historical foundation and next actions

The practical foundation is Codex-native + GitHub + minimal Bootstrap assurance, provisionally chosen after a terminated bake-off with zero valid scored runs and three non-scoreable attempts. It is not a comparative winner. [factory-foundation-bakeoff](https://github.com/FlorisOrd/factory-foundation-bakeoff) preserves the closure and attempts; [factory-foundation-evaluation](https://github.com/FlorisOrd/factory-foundation-evaluation) preserves paused Protocol-v3 research. Do not restart either as part of resuming production development.

Next actions: restore the intended approved or experimental line and evidence; rerun proportionate checks; review the latest owner decision on PR #3; then implement only a newly bounded authorized outcome. Preserve existing draft status until an authorized product decision changes it.


## Exact archive restoration

This preservation branch is based on approved main at dbdee018e5a128b08b413f4d1a71128256a58aec. It does not merge the recorded unapproved development snapshot. Read [.preservation/2026-10-07/README.md](.preservation/2026-10-07/README.md) and [MANIFEST.json](.preservation/2026-10-07/MANIFEST.json). Run the included recover.py into a new directory to recover the original working files and every original Git object/ref. The original top-level development checkout is r001.
