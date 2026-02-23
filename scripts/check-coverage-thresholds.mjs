#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Trace: DESIGN-storybook-coverage-threshold-gate-2026-02-23

function parseArgs(argv) {
  const args = {
    file: "coverage/coverage-final.json",
    statements: 70,
    branches: 55,
    functions: 70,
    lines: 70,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) continue;
    if (key === "file") args.file = value;
    if (key === "statements") args.statements = Number(value);
    if (key === "branches") args.branches = Number(value);
    if (key === "functions") args.functions = Number(value);
    if (key === "lines") args.lines = Number(value);
    i += 1;
  }

  return args;
}

function countMetric(map) {
  const values = Object.values(map ?? {});
  if (values.length === 0) return { covered: 0, total: 0 };
  let covered = 0;
  for (const value of values) {
    if (value > 0) covered += 1;
  }
  return { covered, total: values.length };
}

function countBranches(branches) {
  const values = Object.values(branches ?? {});
  if (values.length === 0) return { covered: 0, total: 0 };
  let covered = 0;
  let total = 0;
  for (const branchArray of values) {
    if (!Array.isArray(branchArray)) continue;
    total += branchArray.length;
    for (const hitCount of branchArray) {
      if (hitCount > 0) covered += 1;
    }
  }
  return { covered, total };
}

function aggregateTotals(report) {
  const totals = {
    statements: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    lines: { covered: 0, total: 0 },
  };

  for (const fileCoverage of Object.values(report)) {
    const statements = countMetric(fileCoverage.s);
    const functions = countMetric(fileCoverage.f);
    const lines = countMetric(fileCoverage.l && Object.keys(fileCoverage.l).length > 0 ? fileCoverage.l : fileCoverage.s);
    const branches = countBranches(fileCoverage.b);

    totals.statements.covered += statements.covered;
    totals.statements.total += statements.total;
    totals.functions.covered += functions.covered;
    totals.functions.total += functions.total;
    totals.lines.covered += lines.covered;
    totals.lines.total += lines.total;
    totals.branches.covered += branches.covered;
    totals.branches.total += branches.total;
  }

  return totals;
}

function percent(metric) {
  if (metric.total === 0) return 100;
  return (metric.covered / metric.total) * 100;
}

const args = parseArgs(process.argv);
const reportPath = resolve(args.file);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const totals = aggregateTotals(report);

const actual = {
  statements: percent(totals.statements),
  branches: percent(totals.branches),
  functions: percent(totals.functions),
  lines: percent(totals.lines),
};

console.log("Coverage totals");
console.log(`- statements: ${actual.statements.toFixed(2)}% (min ${args.statements}%)`);
console.log(`- branches:   ${actual.branches.toFixed(2)}% (min ${args.branches}%)`);
console.log(`- functions:  ${actual.functions.toFixed(2)}% (min ${args.functions}%)`);
console.log(`- lines:      ${actual.lines.toFixed(2)}% (min ${args.lines}%)`);

const failures = [];
if (actual.statements < args.statements) failures.push("statements");
if (actual.branches < args.branches) failures.push("branches");
if (actual.functions < args.functions) failures.push("functions");
if (actual.lines < args.lines) failures.push("lines");

if (failures.length > 0) {
  console.error(`Coverage threshold check failed for: ${failures.join(", ")}`);
  process.exit(1);
}

console.log("Coverage thresholds satisfied.");
