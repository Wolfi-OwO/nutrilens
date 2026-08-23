#!/usr/bin/env node
// Mechanizes the "move Unreleased under a version heading, bump versions"
// half of cutting a release (see CONTRIBUTING.md). Does NOT push, open a
// PR, or tag anything — those still go through the normal
// branch-protected PR flow, same as any other change to main.
//
// Usage: node scripts/cut-release.mjs 0.3.0

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('Usage: node scripts/cut-release.mjs X.Y.Z');
    process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const changelogPath = 'CHANGELOG.md';
const changelog = readFileSync(changelogPath, 'utf8');

const unreleasedHeading = '## [Unreleased]';
const headingIndex = changelog.indexOf(unreleasedHeading);
if (headingIndex === -1) {
    console.error(`No "${unreleasedHeading}" heading found in ${changelogPath}.`);
    process.exit(1);
}

const afterHeading = changelog.slice(headingIndex + unreleasedHeading.length);
const nextHeadingMatch = afterHeading.match(/^\s*\n## \[/);
if (nextHeadingMatch) {
    console.error('Unreleased section is empty — nothing to release. Merge some PRs first.');
    process.exit(1);
}

const newChangelog =
    changelog.slice(0, headingIndex) +
    `${unreleasedHeading}\n\n## [${version}] - ${today}` +
    afterHeading;
writeFileSync(changelogPath, newChangelog);
console.log(`${changelogPath}: moved Unreleased entries under [${version}] - ${today}`);

const rootPkgPath = 'package.json';
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
const previousVersion = rootPkg.version;
if (previousVersion === version) {
    console.error(`${rootPkgPath} is already at ${version}.`);
    process.exit(1);
}

const versionedFiles = [
    { path: rootPkgPath, pattern: `"version": "${previousVersion}"`, replacement: `"version": "${version}"` },
    {
        path: 'apps/api/package.json',
        pattern: `"version": "${previousVersion}"`,
        replacement: `"version": "${version}"`,
    },
    {
        path: 'apps/ai-server/pyproject.toml',
        pattern: `version = "${previousVersion}"`,
        replacement: `version = "${version}"`,
    },
    // apps/frontend/package.json used to be absent from this list, so it never got
    // bumped by the script — it drifted to 0.5.0 while everything else moved on,
    // and nothing caught it until someone diffed package-lock.json by hand.
    {
        path: 'apps/frontend/package.json',
        pattern: `"version": "${previousVersion}"`,
        replacement: `"version": "${version}"`,
    },
];

// A non-matching pattern used to just log a warning and `continue`, which is how
// apps/frontend/package.json (and, before that, apps/ai-server/pyproject.toml) drifted
// unnoticed in a wall of npm output. A missed bump must stop the release, not scroll past it.
for (const { path, pattern, replacement } of versionedFiles) {
    const contents = readFileSync(path, 'utf8');
    if (!contents.includes(pattern)) {
        console.error(`${path}: expected to find ${JSON.stringify(pattern)} — not bumped, fix by hand and re-run.`);
        process.exit(1);
    }
    writeFileSync(path, contents.replace(pattern, replacement));
    console.log(`${path}: ${previousVersion} -> ${version}`);
}

execFileSync('npm', ['install', '--package-lock-only'], { stdio: 'inherit' });

console.log(`\nDone. Review the diff, then:
  git checkout -b release-${version}
  git add -A && git commit -m "Release v${version}"
  git push -u origin release-${version}
  gh pr create --title "Release v${version}" --fill
`);
