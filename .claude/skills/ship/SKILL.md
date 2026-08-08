---
description: Verify, changelog, commit, and push the current CareTime changes to main — the standard end-of-task workflow for this project.
argument-hint: [short title for the changelog entry]
---

# Ship CareTime changes

This project's standing workflow: push finished work straight to `main` (no branches/PRs), but only after verification and a CHANGELOG entry. Follow every step — don't skip verification to save time.

## 1. Identify what changed

Run `git status` and `git diff` to see everything modified/added since the last commit. Only touch files relevant to the task just completed — don't stage unrelated changes.

Ignore `tsconfig.tsbuildinfo` — it's a build artifact that changes on every `tsc` run and should never be committed.

## 2. Type-check

```
npx tsc --noEmit
```

Must be clean (or unchanged from before your edits) before continuing. Fix any errors your changes introduced.

## 3. Lint — filter pre-existing noise

This codebase has a large pre-existing baseline of `@typescript-eslint/no-explicit-any` and `react-hooks/exhaustive-deps` warnings/errors that are not your problem to fix. Only care about issues your edit *introduced*.

```
npx eslint <each touched/new file, space-separated>
```

For any file with errors, confirm whether they're pre-existing by diffing against HEAD:

```
git show HEAD:"<path>" | npx eslint --stdin --stdin-filename "<path>"
```

If the problem count matches (or the specific new lines you added aren't the ones flagged), it's pre-existing — leave it. If your edit added a *new* error (e.g. you wrote `(x: any) =>` where the codebase relies on implicit `any` and doesn't get flagged for it), fix it.

## 4. Write a CHANGELOG entry

Read `CHANGELOG.md`. Find the current top `## Session N` number and insert a **new** entry directly below the `---` divider (i.e. above the current top entry), incrementing to `Session N+1`:

```markdown
## Session N+1 — <today's date, "DD Month YYYY">

### <Short Title Describing The Change>

- What changed and why, in a few detailed bullets. Explain root causes for bug fixes, not just
  symptoms. Name the key files touched.
- Keep the tone matching existing entries — direct, technical, no marketing language.
```

Use today's real date. If `$1` (the skill argument) was given, use it as the title; otherwise infer a concise, accurate title from the diff.

## 5. Stage, commit, push

Stage only the relevant files by name (never `git add -A` or `git add .`):

```
git add CHANGELOG.md <touched files...>
```

Commit with a message explaining the *why*, not just the *what* — 1-2 sentences is enough for simple changes, more for anything with a non-obvious root cause. End every commit message with:

```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

Then push directly to `main`:

```
git push origin main
```

Do not use `--force`, do not skip hooks (`--no-verify`), and do not create a branch or PR unless the user explicitly asks for one this time — direct-to-main is the established convention for this project.

## 6. Report back

Tell the user concisely: what shipped, the commit hash, and anything they should manually verify (e.g. UI flows you couldn't click through because they require login credentials you don't have).
