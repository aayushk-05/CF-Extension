#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalize(text) {
  return String(text).replace(/\r/g, "").trim();
}

function runCommand(command, input) {
  const result = spawnSync(command, {
    input,
    encoding: "utf8",
    shell: true
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status
  };
}

function main() {
  const testsFile = process.argv[2] || "tests.json";
  const cmd = process.argv.slice(3).join(" ");

  if (!cmd) {
    console.error("Usage: node scripts/run-tests.js <tests.json> <command>");
    console.error('Example: node scripts/run-tests.js tests.json "python3 solution.py"');
    process.exit(1);
  }

  const absolute = path.resolve(process.cwd(), testsFile);
  if (!fs.existsSync(absolute)) {
    console.error(`tests file not found: ${absolute}`);
    process.exit(1);
  }

  const payload = readJson(absolute);
  const tests = Array.isArray(payload) ? payload : payload.tests;
  if (!Array.isArray(tests) || tests.length === 0) {
    console.error("No tests found in file.");
    process.exit(1);
  }

  let passCount = 0;
  let firstFail = null;

  tests.forEach((test, i) => {
    const idx = test.index || i + 1;
    const res = runCommand(cmd, `${test.input}\n`);
    const actual = normalize(res.stdout);
    const expected = normalize(test.output);
    const ok = actual === expected;

    if (ok) {
      passCount += 1;
      console.log(`[PASS] Test #${idx}`);
      return;
    }

    if (!firstFail) {
      firstFail = {
        index: idx,
        input: test.input,
        expected,
        actual,
        status: res.status,
        stderr: res.stderr
      };
    }

    console.log(`[FAIL] Test #${idx}`);
  });

  console.log(`\nPassed ${passCount}/${tests.length} tests.`);

  if (firstFail) {
    console.log("\nFirst failing test details:");
    console.log(JSON.stringify(firstFail, null, 2));
    process.exit(2);
  }
}

main();
