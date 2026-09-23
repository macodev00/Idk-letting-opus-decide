# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-23

### Added

- 22 checks across legal, documentation, community, security and quality, with a weighted score and A–F grade.
- `--fix` generates LICENSE (10 licenses), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue forms, PR template, CI workflow, Dependabot config, .gitignore, CHANGELOG and AGENTS.md, tailored to the project's ecosystem. Existing files are never overwritten.
- Secret scanner for 18 credential types with redacted output and inline ignore comments, plus `--history` to scan every past commit.
- Text, JSON, Markdown and SARIF output; `--min-score` and `--strict` for CI.
- GitHub Action with job summary, annotations, outputs and SARIF support.
- Configuration through `.repo-ready.json` or `package.json`.
- Programmatic API (`import { audit } from 'repo-ready'`).
