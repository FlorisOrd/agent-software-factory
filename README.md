# Agent Software Factory

This repository is the owner's reusable Codex development team. Open a Codex task
in this repository and describe the software outcome you want in plain language.
The lead uses the saved [delivery workflow](.agents/skills/factory-delivery/SKILL.md)
to prepare a bounded brief, delegate implementation, arrange independent checking
and hand back a tested draft pull request with an understandable report.

Agents handle technical work and internal handoffs. They raise decisions when
business information or authorization is actually needed. The owner receives what
works, what was checked, any failures and fixes, remaining uncertainty and the
decision needed. Implementation is not independent acceptance or deployment.

For example, a small Factory maintenance request could be:

> In this Factory repository, add a short checklist to README.md explaining what
> I should include in a maintenance request: the desired outcome, what may change,
> what must stay unchanged, and how I can tell it is done. Change only README.md,
> preserve the existing guidance, and deliver an unmerged draft pull request with
> the check and independent review results.

The lead turns that request into a bounded brief and keeps the technical handoffs
within the team. The owner receives these progress states:

| State | What it means for the owner |
| --- | --- |
| `IN PROGRESS` | Work or required evidence is still incomplete. Missing review evidence, or results for an earlier revision, cannot make the current change ready. |
| `CHANGES REQUESTED` | A relevant check failed or the separate verifier found a blocking issue. The builder fixes it, then the updated change receives fresh checks and independent review. |
| `READY FOR OWNER REVIEW` | The brief, separate builder and verifier results, and required live workflow evidence are recorded. The verifier reviewed the current change, required checks and CI pass for it, no blocking findings remain, and the draft pull request matches that change. The owner can review the report and any decision needed. |

For [ASF-MVP-01](docs/ASF-MVP-01.md), the delivery report uses
`IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION` when implementation is delivered
for final independent verification, or `PARTIAL/BLOCKED` with the exact unmet
criterion when delivery is incomplete. ChatGPT retains the final independent
verification role. `READY FOR OWNER REVIEW` is a handoff state; it grants neither
independent product acceptance nor permission to merge or deploy.

The [initial requirement and acceptance criteria](docs/ASF-MVP-01.md) define this
first slice. The repository skill is the reusable functionality; it requires a
Codex session with native agent delegation and authorized GitHub access. Missing
capabilities or current evidence produce a partial report, never simulated success.

The repository check verifies static installation structure. CI reports the
revision it checks; live delegation and independent review need separate session
and commit-specific evidence. Agent roles and readiness rules are procedural:
they do not isolate agents or replace the session's effective permission controls.

The first customer-facing pilot is the
[quantum-readiness assessment](products/quantum-readiness/README.md): a private
local interface for an explicitly authorized HTTPS endpoint, evidence-backed
findings, and a proposed migration plan. Its controlled demonstration uses only
task-owned local TLS endpoints. It is separate from the completed Factory setup
and does not grant permission to scan customers, deploy, or merge changes.
