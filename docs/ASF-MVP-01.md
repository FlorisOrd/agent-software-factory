# ASF-MVP-01: reusable Codex delivery team

## Requirement and scope

The owner describes a software outcome in plain language. A lead coordinates
agents that specify, build, test and review; agents perform technical operations.
No agent independently accepts its own implementation. GitHub preserves source,
changes, test results and review evidence. Progress and approval reports must be
understandable to the owner. Escalate only necessary business, financial, legal,
brand, authorization or irreversible decisions after checking available context.

This first slice configures the Factory itself as that team, one work item at a
time. The settled foundation is Codex-native + GitHub + minimal Bootstrap
assurance, recorded in
[PROVISIONAL_FOUNDATION.md](https://github.com/FlorisOrd/factory-foundation-bakeoff/blob/861a0403519a75e7dbdeecd916dc626261e7cab0/PROVISIONAL_FOUNDATION.md).
The starting target main is `fd5295a1b05c3559b3eaeb7cf9c7c8ed3e6483da`, tree
`1c1934ca91c4e6a3ea640c1e37535f918a1bc69b`; verify live state before using it.

Deliver root discovery guidance, one reusable native skill, relevant checks and
one tested draft PR, left unmerged. Demonstrate the saved workflow in a fresh task
with a small maintenance change in this repository. Do not add an application,
orchestrator, dashboard, registry, task capsules, benchmark or governance service.
Do not modify Tailor, factory-foundation-evaluation or bake-off history, merge
repair PR #2, restart Protocol-v3, or import invalidated implementations.

## Observable acceptance

| ID | Criterion | Required evidence |
| --- | --- | --- |
| A | A clear request becomes a bounded brief with observable criteria. Ask at most three necessary questions when business context is missing. | Brief, criteria and any actual questions. |
| B | The lead invokes a builder and a different verifier. | Native identifiers and original task results, not role labels. |
| C | The verifier reads the requirement and exact candidate, inspects files and independently runs relevant checks; findings go back to the builder. | Base/head SHA, actual review and original check results. |
| D | Configuration syntax/discovery checks and live workflow behavior are distinguished. | Static check/CI results plus a separate live delegation trace. |
| E | Missing or stale evidence cannot yield readiness; changes receive evidence for the new candidate. | Labelled missing/stale evidence scenarios and any failures/fixes. |
| F | A fresh task discovers and uses saved instructions without owner-operated specialist handoffs. | Loaded paths and separate native lead/builder/verifier task results. |
| G | One draft PR is published and its remote head read back, with evidence tied to exact commits. | PR URL, remote head/tree, CI SHA and any tested merge-SHA distinction. |
| H | The owner understands the outcome and its limits. | What works, checks, failures/fixes, uncertainty and needed decision. |

Keep post-commit execution evidence in the PR discussion where practical, rather
than making evidence-only commits that immediately change the reviewed candidate.
The report status is `IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION`, or
`PARTIAL/BLOCKED` with the precise unmet criterion. ChatGPT remains the coordination
and final independent-verification role; implementation is neither independent
acceptance nor deployment.
