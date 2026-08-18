# Symphony development workflow

HOPSCOTCH uses GitHub issues as its Symphony work queue. An issue is eligible
for agent execution only when a human applies the `symphony-ready` label and
provides an explicit ownership contract.

Each task runs in an isolated `symphony/GH-<issue>` branch. The agent must keep
its changes within the issue's owned paths and must stop if they overlap a
protected path, another active task, or an open pull request.

Completed work is handed back to maintainers as a draft pull request targeting
`main`. At handoff, `symphony-review` means human review is required. Agents
must keep their pull requests in draft and must never merge their own work,
enable auto-merge, or otherwise bypass that review.

## Engineering guardrails

Agent changes must preserve HOPSCOTCH's canonical simulation truth,
deterministic behavior, evidence provenance, and existing contracts. A task
may present or document established truth, but it must not introduce an
alternate source of simulation outcomes or weaken the boundaries and checks
that keep those outcomes reproducible and attributable.
