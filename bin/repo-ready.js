#!/usr/bin/env node
import { main } from '../src/cli.js';

main().then((code) => {
  process.exitCode = code;
}, (err) => {
  process.stderr.write(`repo-ready: ${err.stack || err.message}\n`);
  process.exitCode = 2;
});
