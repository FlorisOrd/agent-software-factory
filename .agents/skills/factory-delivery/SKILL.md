---
name: factory-delivery
description: Coordinate repository software setup, implementation and maintenance from an owner request through separate native builder and verifier agents to a tested draft PR and owner report.
---

# Factory delivery

Use this workflow for one bounded software delivery item in this repository. The
main task is the lead. The saved workflow is part of the product, so use it during
maintenance of the Factory itself. Read the current request, root `AGENTS.md` and
[the initial requirement](../../../docs/ASF-MVP-01.md); preserve later owner intent.
Record the instruction/skill paths actually loaded and available native task IDs.

## Establish the work

Inspect live repository instructions, worktree, branch and open PRs before writing.
Preserve other work. Record the base commit and tree. Convert the owner's request
into a short brief: outcome, included work, excluded work and observable acceptance
criteria. Use available context first; ask at most three necessary business
questions. The lead resolves technical choices and operates internal handoffs.

Check that native delegation and authorized repository access are available. Use
the installed client's supported tools/configuration, verifying uncertain behavior
against local capability evidence and current official documentation. Do not add
custom role files or model pins merely to give agents different labels. If an
essential capability fails, preserve its non-sensitive original failure and name
the unmet criterion; do not simulate another agent or ask the owner to diagnose it.

## Delegate and independently check

1. Invoke a native builder agent with the brief, acceptance criteria, repository
   path, base commit, allowed scope, relevant instructions and check expectations.
   Give it implementation, tests and fixes. Preserve the real native identifier,
   original completion result and check output. The builder does not accept its
   own implementation.
2. Establish an exact candidate commit and tree after implementation; inspect the
   actual working tree and changed files before committing. Never include unrelated
   changes. Record the candidate and test results against that revision.
3. Invoke a different native verifier agent. Send the requirement, acceptance
   criteria, exact base and candidate commits, changed-file scope and where original
   evidence lives. The verifier must inspect the actual files/diff, confirm its
   checkout/revision, run relevant checks independently and review code/configuration,
   QA and security within scope. Builder explanations are context, not proof. The
   verifier reports findings with severity, location and evidence, or reports no
   blocking findings and remaining limitations; it does not silently edit the work.
4. Return findings to the builder. Preserve the failure, fix and recheck trail. Any
   new candidate commit requires appropriate checks and independent review tied to
   that new commit. Keep roles distinct during rechecking. Do not treat an old clean
   review or green run as approval of a newer head.

Use existing native coordination tools for these handoffs; never require the owner
to relay specialist prompts. Separate task IDs prove separate agent execution, not
separate permissions, independent hardware or an enforced security boundary.

## Evidence and readiness

This is a procedural gate operated by the lead, not a technical access control.
Use `IN PROGRESS` while required evidence is missing/stale, `CHANGES REQUESTED`
when a relevant check fails or the verifier reports a blocking finding, and
`READY FOR OWNER REVIEW` only when all of the following are observable:

- The brief and criteria are recorded, with actual distinct builder/verifier IDs
  and original results linked from the delivery record or PR discussion.
- The verifier inspected the exact candidate and independently ran appropriate
  checks; relevant checks pass and blocking findings are resolved on that candidate.
- Local check evidence and review evidence name the current candidate commit.
  Read back the remote PR head and ensure it is the candidate. Required CI must be
  complete and successful for that candidate or an explicitly identified PR merge
  commit containing it; record both SHAs and the merge base when CI tests a merge.
- The requested live behavior is evidenced separately from static checks. For this
  configuration product, using Node 22 or newer, the static check is `node scripts/check-workflow.mjs`
  (with `node --check scripts/check-workflow.mjs` for helper syntax). These checks
  verify installation structure; they cannot prove native loading or delegation.

Exercise a bounded negative scenario for workflow changes. Label it `TEST SCENARIO`:
evaluate a candidate with missing verifier evidence, then a changed candidate with
only the earlier commit's check/review evidence. Both must remain `IN PROGRESS`;
neither can be ready. Record inputs and actual decisions. This can be an independent
verifier's procedural assessment, clearly described as such; do not manufacture a
runtime enforcement claim or turn these scenarios into production failures.

For changes to discovery or coordination, also use a fresh native task without the
bootstrap conversation. Give it a concrete small Factory maintenance request and
repository location, letting repository instructions route it to this skill. Record
what it actually loaded and the builder/verifier it invoked. Keep its change within
the same delivery PR. An inherited prompt or static file scan alone is not a live
workflow demonstration. If the environment cannot start a fresh context, report the
limitation and unmet acceptance criterion.

## Draft PR and owner handoff

Use authorized GitHub access to publish or update one draft PR; leave it unmerged.
Read back its draft state and remote head. Preserve post-commit check/review results
in the PR discussion where practical to avoid unnecessary evidence-only commits.
Include exact base/head/tree, changed files, executed checks with original results,
CI run links and tested SHA, native capability/permission observations, separate
builder/verifier evidence, failures/fixes and the fresh-task trace when applicable.
Evidence added to a comment must be sourced from actual results, not reconstructed
identities or assumed execution.

Report the outcome in plain language: what works, what was checked, what failed and
was fixed, remaining uncertainty, needed decision and rollback. For ASF-MVP-01 use
`IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION`, or `PARTIAL/BLOCKED` naming the
unmet criterion. `READY FOR OWNER REVIEW` is a handoff state, not independent product
acceptance, permission to merge or deployment. ChatGPT retains the final independent
verification role. A later explicitly authorized rollback can revert the delivery
commit/PR; do not perform destructive cleanup as part of handoff.

## Authority

Operate only in the requested repository and through existing authorized access.
Inspect effective session/tool permissions rather than inferring them from role or
configuration names. Shared-workspace agents can affect the same files; coordinate
ownership. Protect credentials, avoid unrelated data, and preserve safeguards.
No new paid service, deployment, merge, expanded access or destructive operation is
authorized by this workflow. Reuse authorization already present in the owner's
request; escalate only when a necessary decision exceeds it.
