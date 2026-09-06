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

The [initial requirement and acceptance criteria](docs/ASF-MVP-01.md) define this
first slice. The repository skill is the reusable functionality; it requires a
Codex session with native agent delegation and authorized GitHub access. Missing
capabilities or current evidence produce a partial report, never simulated success.

The repository check verifies static installation structure. CI reports the
revision it checks; live delegation and independent review need separate session
and commit-specific evidence. Agent roles and readiness rules are procedural:
they do not isolate agents or replace the session's effective permission controls.
