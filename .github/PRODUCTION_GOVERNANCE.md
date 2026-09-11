# HOPSCOTCH production governance

HOPSCOTCH uses one production path:

`pull request -> required GitHub validation -> main -> Cloudflare Workers Builds production deployment`

GitHub Actions is validation-only. It must not become a second production deployer.

## Stable required checks

Repository protection for `main` should require these exact job names:

- `build` from `.github/workflows/ci.yml`
- `production-profile` from `.github/workflows/performance.yml`
- `compatibility-gate` from `.github/workflows/compatibility.yml`

`compatibility-gate` is the aggregate contract for the complete browser, replay, visual, GPU, and Journey compatibility matrix. Individual compatibility jobs should not be configured as separate branch-protection requirements unless there is a specific debugging reason to do so.

All three workflows run on `pull_request`, `merge_group`, and pushes to `main`. This allows a merge queue to validate the synthesized merge commit and also revalidates the exact commit that Cloudflare sees after merge.

## GitHub ruleset for `main`

Create a repository ruleset targeting the `main` branch with the following controls:

1. Require a pull request before merging.
2. Require the status checks `build`, `production-profile`, and `compatibility-gate`.
3. Enable merge queue. If merge queue is unavailable, require branches to be up to date before merging.
4. Block force pushes.
5. Block branch deletion.
6. Do not require the Cloudflare Workers build as a pre-merge check. Cloudflare is the post-merge production deployer and should consume the already validated `main` commit.
7. Human approval is not required for a single-maintainer repository. Add approval requirements only when there is a real independent reviewer rather than creating a ceremonial self-approval step.

The repository-side governance contract cannot create or modify GitHub rulesets itself. The ruleset is an administrative control and must be enabled in repository settings.

## Cloudflare boundary

Cloudflare Workers Builds owns production deployment from `main`. GitHub Actions must not contain Cloudflare credentials, production environments, or effectful Worker deploy commands.

The repository may retain a local `npm run deploy` command for deliberate operator use, but CI must never invoke it. Adding any GitHub Actions deployment path requires an explicit architecture review and an update to this document and `scripts/production-governance-contract.mjs`.

## Machine-verifiable contract

`CI / build` executes `scripts/production-governance-contract.mjs`. The check fails when any of these invariants drift:

- a stable workflow or required job id is renamed;
- PR or merge-queue validation is removed;
- exact-`main` post-merge validation is removed;
- a required workflow gains write permissions;
- the high-severity dependency audit disappears;
- `compatibility-gate` stops depending on the complete compatibility matrix;
- a GitHub Actions workflow gains Cloudflare deployment credentials, production deployment permissions, or an effectful deployment command.

This contract is intentionally conservative. A future architecture change should update the contract deliberately rather than weakening it merely to make CI green.
