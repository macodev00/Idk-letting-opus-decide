# repo-ready launch kit

Everything needed to launch `repo-ready` and get real users. Every piece of text below is ready to paste.
This file lives on its own branch so it doesn't clutter the product repo. **Don't merge it.**

Ground rules that protect the project (and a later Codex for Open Source application):

- **No bought or swapped stars, no sock-puppet accounts, no vote rings.** GitHub removes fake stars and
  can flag the account. Hacker News and Reddit ban vote manipulation. OpenAI's program terms require accurate
  information and it looks at *real usage*: dependents, downloads, active maintenance.
- Post from your own account, disclose that you built it, and stay in the comments to answer questions.
  Replying to feedback quickly matters more than anything else on launch day.

---

## Part 1: One-time setup (about 20 minutes, all free)

Do these in order. Each step needs your GitHub or npm login, which is why I couldn't do them.

1. **Merge the product PR** ([#1](https://github.com/macodev00/Idk-letting-opus-decide/pull/1)) into `main`.
   The release workflow then creates the `v1.0.0` and `v1` tags plus a GitHub Release automatically.
2. **Rename the repository** to `repo-ready` (Settings → General → Repository name). A name like
   `Idk-letting-opus-decide` costs you clicks on every post. GitHub redirects the old URLs. Afterwards, ask me
   to "update links for the rename" (or run the one-liner at the bottom of this file).
3. **Repository details** (the gear icon next to "About" on the repo page):
   - Description: `Check if your repository is ready for open source, and fix what's missing. License, README, community files, CI, leaked secrets. Zero dependencies.`
   - Topics: `open-source`, `github-action`, `cli`, `linter`, `repolinter`, `community-health`, `secrets-detection`, `license`, `readme`, `developer-tools`, `nodejs`, `oss`
   - Check "Releases" and "Packages" under "Include in the home page".
4. **Social preview:** Settings → General → Social preview → upload `docs/social-preview.png`.
5. **Security:** Settings → Code security → enable *Private vulnerability reporting* (SECURITY.md links to it),
   *Dependabot alerts* and *Secret scanning*.
6. **Enable Discussions** (Settings → General → Features) so questions don't turn into issues.
7. **Publish to npm** (free) so `npx repo-ready` works:
   - Create an account at <https://www.npmjs.com/signup> and turn on 2FA.
   - Either run `npm login && npm publish --access public` once from the repo,
   - or create a "Granular Access Token" with publish rights, add it as the repo secret `NPM_TOKEN`
     (Settings → Secrets and variables → Actions), then re-run the "Release" workflow. Future version bumps publish automatically.
   - Then change the README's install commands from `npx github:macodev00/…` to `npx repo-ready` (or ask me to).
8. **List the Action on GitHub Marketplace:** Releases → edit `v1.0.0` → check "Publish this Action to the GitHub
   Marketplace" → primary category *Code quality*, secondary *Continuous integration*. (Free. It asks you to
   accept the Marketplace agreement once.) Marketplace search is a steady, long-term source of users.

---

## Part 2: Launch posts

Spread these over 1–2 weeks rather than one day. Each gets its own audience, and you'll learn from the
feedback between posts. Good times: Tuesday–Thursday, 8–10am US Eastern.

### Hacker News: Show HN

Submit at <https://news.ycombinator.com/submit>. **Title** (max 80 chars):

```
Show HN: Repo-ready – check if a repo is ready to open-source, and fix the gaps
```

**URL:** the GitHub repo. Then immediately add this as the first comment:

```
Hi HN! I built repo-ready because every time I open-source something I forget half the checklist: a
license that matches package.json, CONTRIBUTING/SECURITY files, issue templates, CI, and — the scary one
— making sure there's no API key or .env file in the history of the thing I'm about to make public.

It's a single zero-dependency Node CLI (also a GitHub Action):

  npx repo-ready          # audit, score out of 100
  npx repo-ready --fix    # generate what's missing

--fix writes files tailored to the project (it knows npm/pnpm/yarn/bun, Python, Go, Rust, Java, Ruby,
PHP, .NET), bundles 10 licenses, and never overwrites anything. The secret scanner covers 18 token
types and is tuned for low false positives: I ran it against rails, vite, vscode, deno, go, react and
~10 others and fixed every false alarm I found (PEM headers in docs, localhost DB URLs, test certs…).

TODO Group's repolinter used to fill this niche but was archived; OpenSSF Scorecard is great but focuses
on supply-chain security via the GitHub API. This one works offline on any git host.

I'd love feedback on which checks are missing or too noisy.
```

### Reddit

Read each subreddit's rules first. Some only allow self-promotion on certain days.

**r/opensource** (title):
```
I made a CLI that checks whether your repo is ready to open-source (license, docs, community files, leaked secrets) and generates what's missing
```
Body:
```
Every time I open-sourced a project I'd forget something: a CONTRIBUTING guide, a SECURITY policy,
issue templates, or worse, a committed .env. So I built repo-ready:

- `npx repo-ready` gives a score out of 100 with 21 checks
- `npx repo-ready --fix` generates LICENSE (10 licenses), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY,
  issue forms, PR template, CI workflow, Dependabot config, .gitignore and AGENTS.md, tailored to your
  language. It never overwrites existing files.
- Scans for 18 kinds of leaked credentials
- Zero dependencies, MIT, also available as a GitHub Action

Out of curiosity I ran it on 16 well-known projects: React scored 100, Rails 98, uv 95. The most commonly
missing file was CODE_OF_CONDUCT.md (11 of 16).

Repo: <link>. Feedback very welcome, especially checks you think are missing!
```

**r/github**: same body; title: `GitHub Action + CLI that grades your repo's community health and opens a PR with the missing files`

**r/node**: title `repo-ready: zero-dependency CLI to audit and fix open-source readiness (npx repo-ready --fix)`.
Lead with "zero dependencies, node:test, ESM, works on Node 18–24" since that audience cares.

**r/SideProject** and **r/coolgithubprojects**: short version of the r/opensource post plus the demo image.

### dev.to / Hashnode / Medium article

Cross-post the same article (use the canonical URL setting to avoid duplicate-content issues).
Tags: `opensource`, `github`, `node`, `devops`.

```markdown
---
title: I graded 16 famous GitHub repos on open-source readiness. Here's what even they miss
published: true
tags: opensource, github, node, devops
cover_image: <upload docs/social-preview.png>
---

What does a "healthy" open-source repository look like? GitHub has a Community Standards checklist, but
it only lives in the browser. So I wrote [repo-ready](<link>), a small CLI that checks 21 things people
expect from an open-source project and scores them out of 100, then pointed it at some of the most
popular projects on GitHub.

## The results

| Project | Score | Missing (examples) |
|---|---|---|
| react | 100 | — |
| rails | 98 | Dependabot/Renovate |
| uv | 95 | Code of conduct |
| deno | 91 | Dependabot/Renovate, a large binary file |
| requests | 91 | PR template, AGENTS.md |
| vite | 89 | Code of conduct |
| vscode | 86 | Code of conduct, large files |
| flask | 82 | Code of conduct, security policy |
| cobra | 81 | Code of conduct, issue templates, changelog |
| ollama | 81 | Code of conduct, PR template, changelog |
| express | 80 | CONTRIBUTING, CoC, SECURITY* |
| got | 80 | CONTRIBUTING, CoC, changelog |
| ripgrep | 79 | CoC, security policy, PR template |
| typer | 73 | CoC, security policy, issue templates |
| fastapi | 70 | CONTRIBUTING, CoC, SECURITY* |
| go | 70 | CI config in repo, changelog, a committed test key |

\* Some organizations share community files through an org-level `.github` repository, which isn't visible
in a clone. The score is about what's *in the repo*, not a judgment of these (excellent) projects.

## What I learned

1. **Code of conduct is the most commonly missing file** (11 of 16).
2. **AGENTS.md is catching on fast.** 7 of the 16 already ship an AGENTS.md (or CLAUDE.md / Cursor rules), the
   file that tells Codex, Cursor, Copilot and friends how to build and test a project. For everyone else it's the
   cheapest win on the list.
3. **Secret scanners are noisy.** My first version flagged PEM headers inside documentation strings, test
   certificates and `postgres://postgres:postgres@localhost` in CI templates. Now a private key only counts
   when real key material follows the header, and localhost URLs and default credentials are ignored.
   If a tool cries wolf, people stop listening.

## Try it on your repo

    npx repo-ready          # score + findings
    npx repo-ready --fix    # generate LICENSE, CONTRIBUTING, SECURITY, CI, templates...

Or add it to CI:

    - uses: macodev00/repo-ready@v1
      with:
        min-score: 80

It's MIT-licensed with zero dependencies. What check would you add?
```

### X / Bluesky / Mastodon / LinkedIn thread

```
1/ I built repo-ready: one command to check if your repo is ready for open source, and fix what's missing.

npx repo-ready --fix

License, README, CONTRIBUTING, SECURITY, issue templates, CI, leaked secrets. Zero dependencies. 🧵

2/ --fix generates files tailored to your stack (npm/pnpm/yarn/bun, Python, Go, Rust, Java, Ruby, PHP,
.NET) and never overwrites anything.

3/ I graded 16 famous repos. React: 100. Rails: 98. uv: 95.
Most commonly missing file? CODE_OF_CONDUCT.md (11/16).

4/ It's also a GitHub Action with job summaries, annotations and SARIF for the Security tab.
MIT licensed: <link>
```
Attach `docs/social-preview.png` (or a screen recording of `--fix`) to the first post. Posts with media get far more reach.

### Product Hunt (optional, later)

- Name: repo-ready
- Tagline: `Get your GitHub repo ready for open source in one command`
- Description: `repo-ready checks 21 things every open-source project needs (license, README, contributing and security policies, CI, and leaked secrets), scores your repo out of 100, and generates the missing files. Free, MIT, zero dependencies, also a GitHub Action.`
- Topics: Developer Tools, Open Source, GitHub

---

## Part 3: Curated lists (submit one PR each)

These bring slow, steady discovery. Read each list's CONTRIBUTING first.

| List | Section | Entry | When |
|---|---|---|---|
| [todogroup/awesome-ospo](https://github.com/todogroup/awesome-ospo) | Project Quality (next to RepoLinter) | `- [repo-ready](https://github.com/macodev00/repo-ready) - Audit a repository for open source readiness (license, docs, community files, CI, leaked secrets) and generate missing files.` | Now. Their template asks why it's needed: "repolinter, listed in this section, is archived; repo-ready covers the same ground with zero config and auto-fix." |
| [agarrharr/awesome-cli-apps](https://github.com/agarrharr/awesome-cli-apps) | Development | `- [repo-ready](https://github.com/macodev00/repo-ready) - Check if a repository is ready for open source and fix what's missing.` | Now |
| [toolleeo/awesome-cli-apps-in-a-csv](https://github.com/toolleeo/awesome-cli-apps-in-a-csv) | Development | CSV row per their format | Now |
| [analysis-tools-dev/static-analysis](https://github.com/analysis-tools-dev/static-analysis) | Multiple languages | Per their YAML format | **Wait** until the repo is 6 months old with 20+ stars and 2+ human contributors (their bot enforces this) |
| [sindresorhus/awesome-nodejs](https://github.com/sindresorhus/awesome-nodejs) | Command-line apps | | Later. Strict quality bar, and they prefer established packages |

---

## Part 4: Keep it growing (this matters more than launch day)

- **Answer every issue and PR within a day** for the first month. Early users become contributors.
- **Label 3–5 issues `good first issue`** (for example: "add a secret pattern for X", "detect Y CI provider",
  "add a Swift/Kotlin CI template"). A second human contributor also unlocks lists like static-analysis.
- **Ship small releases often.** Bump `version` in package.json and add a CHANGELOG entry; the release workflow does the rest.
  Each release notifies watchers.
- **Help people directly:** when someone on Reddit/HN asks "how do I prepare my project for open source?", answer
  the question properly first and mention the tool only where it genuinely helps.
- **Track what the program looks at:** stars, npm weekly downloads (npm-stat.com), and "Used by" (the repo's
  Insights → Dependency graph → Dependents, which counts repositories using the Action).

## Part 5: Applying to Codex for Open Source

Apply at <https://openai.com/form/codex-for-oss/> once there's real traction. There's no fixed threshold,
but they weigh ecosystem importance, repository usage and active maintenance. A new repo with no users
is unlikely to be selected, so give the launch time to work. The form asks for:

- Your ChatGPT account email, public GitHub username, and the public repository URL.
- **How you'd use the API credits** (max 500 characters). A draft you can adjust with real numbers:

  > repo-ready audits repositories for open-source readiness and generates missing community files. I'd use
  > credits to (1) run Codex on incoming PRs to review new checks and secret-detection rules for false
  > positives, (2) triage issues and draft fixes, and (3) add an optional `--explain` mode that suggests
  > README improvements. Currently: [N] stars, [N] weekly npm downloads, used by [N] repositories.

Only claim numbers you can show on the repo and npm pages.

---

### Rename one-liner

After renaming the repository to `repo-ready`, run from the repo root:

```sh
git grep -l 'macodev00/Idk-letting-opus-decide' | xargs sed -i 's#macodev00/Idk-letting-opus-decide#macodev00/repo-ready#g'
git commit -am "Update links after rename" && git push
```

(On macOS use `sed -i ''`.)
