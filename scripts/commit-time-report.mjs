#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const ONE_HOUR_MS = 60 * 60 * 1000;
const GIT_LOG_FORMAT = '%H%x09%cI%x09%s';

function readCommits() {
  const output = execFileSync(
    'git',
    ['log', '--reverse', `--pretty=format:${GIT_LOG_FORMAT}`],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );

  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, committedAt, ...subjectParts] = line.split('\t');
      const subject = subjectParts.join('\t');

      return {
        hash,
        committedAt,
        committedAtMs: Date.parse(committedAt),
        subject,
      };
    });
}

function normalizeEpic(epicValue) {
  return epicValue.replace(/\s+/g, '-').replace(/-+/g, '-').toUpperCase();
}

function normalizeFeature(feature) {
  const trimmedFeature = feature.trim();

  if (/^docs?$/i.test(trimmedFeature)) {
    return 'docs';
  }

  if (/^gm$/i.test(trimmedFeature)) {
    return 'game-master';
  }

  if (/^epic(?:[-.\s]|$)/i.test(trimmedFeature)) {
    const suffix = trimmedFeature
      .replace(/^epic[-.\s]*/i, '')
      .replace(/\s+/g, '-')
      .replace(/_+/g, '-')
      .replace(/-+/g, '-')
      .toUpperCase()
      .replace(/^(\d+)-(\d+[A-Z]?)$/, '$1.$2');

    return `EPIC-${suffix}`;
  }

  return trimmedFeature;
}

function inferFeature(subject) {
  const epicMatch = subject.match(/\[(EPIC[^\]]*)\]/i);
  if (epicMatch) {
    return normalizeFeature(normalizeEpic(epicMatch[1]));
  }

  const scopedMatch = subject.match(/^[a-z]+(?:\([^)]+\))?:/i);
  if (scopedMatch) {
    const scopeOnlyMatch = subject.match(/^[a-z]+\(([^)]+)\):/i);
    if (scopeOnlyMatch) {
      return normalizeFeature(scopeOnlyMatch[1]);
    }

    const typeOnlyMatch = subject.match(/^([a-z]+):/i);
    if (typeOnlyMatch) {
      return normalizeFeature(typeOnlyMatch[1]);
    }
  }

  return normalizeFeature('uncategorized');
}

function formatHours(minutes) {
  const hours = minutes / 60;
  return `${hours.toFixed(2)}h`;
}

function formatMinutes(minutes) {
  return `${minutes.toFixed(1)}m`;
}

function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

function addToBucket(map, key, minutes) {
  map.set(key, (map.get(key) ?? 0) + minutes);
}

function sortedEntriesDescending(map) {
  return [...map.entries()].sort((left, right) => right[1] - left[1]);
}

function buildReport(commits) {
  if (commits.length === 0) {
    throw new Error('No commits found.');
  }

  const shortGapMinutes = [];
  for (let index = 1; index < commits.length; index += 1) {
    const deltaMs = commits[index].committedAtMs - commits[index - 1].committedAtMs;
    if (deltaMs > 0 && deltaMs < ONE_HOUR_MS) {
      shortGapMinutes.push(deltaMs / 60000);
    }
  }

  const fallbackMinutes =
    shortGapMinutes.length === 0
      ? 0
      : shortGapMinutes.reduce((sum, value) => sum + value, 0) / shortGapMinutes.length;

  const monthlyTotals = new Map();
  const featureTotals = new Map();
  const monthlyFeatureTotals = new Map();

  let commitsUsingFallback = 0;
  let allocatedMinutesTotal = 0;

  const allocations = commits.map((commit, index) => {
    if (index === 0) {
      return {
        ...commit,
        feature: inferFeature(commit.subject),
        month: monthKey(commit.committedAt),
        rawGapMinutes: null,
        allocatedMinutes: 0,
        usedFallback: false,
      };
    }

    const rawGapMinutes = (commit.committedAtMs - commits[index - 1].committedAtMs) / 60000;
    const usedFallback = rawGapMinutes >= 60;
    const allocatedMinutes = usedFallback ? fallbackMinutes : Math.max(rawGapMinutes, 0);
    const feature = inferFeature(commit.subject);
    const month = monthKey(commit.committedAt);

    if (usedFallback) {
      commitsUsingFallback += 1;
    }

    allocatedMinutesTotal += allocatedMinutes;
    addToBucket(monthlyTotals, month, allocatedMinutes);
    addToBucket(featureTotals, feature, allocatedMinutes);

    const monthlyFeatureKey = `${month}\t${feature}`;
    addToBucket(monthlyFeatureTotals, monthlyFeatureKey, allocatedMinutes);

    return {
      ...commit,
      feature,
      month,
      rawGapMinutes,
      allocatedMinutes,
      usedFallback,
    };
  });

  return {
    allocations,
    fallbackMinutes,
    commitsUsingFallback,
    totalCommits: commits.length,
    allocatedMinutesTotal,
    monthlyTotals,
    featureTotals,
    monthlyFeatureTotals,
  };
}

function printTable(title, headers, rows) {
  console.log(`\n${title}`);
  console.log(headers.join(' | '));
  console.log(headers.map(() => '---').join(' | '));
  for (const row of rows) {
    console.log(row.join(' | '));
  }
}

function main() {
  const commits = readCommits();
  const report = buildReport(commits);

  console.log('Commit Time Report');
  console.log(`Repository: ${process.cwd()}`);
  console.log(`Commits analyzed: ${report.totalCommits}`);
  console.log(`Fallback average for breaks >= 1h: ${formatMinutes(report.fallbackMinutes)}`);
  console.log(`Commits using fallback: ${report.commitsUsingFallback}`);
  console.log(`Total estimated development time: ${formatHours(report.allocatedMinutesTotal)}`);
  console.log('Assumption: the first commit gets 0 minutes because there is no previous commit timestamp.');

  printTable(
    'Monthly Totals',
    ['Month', 'Estimated time', 'Estimated minutes'],
    [...report.monthlyTotals.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([month, minutes]) => [month, formatHours(minutes), minutes.toFixed(1)]),
  );

  printTable(
    'Feature Totals',
    ['Feature', 'Estimated time', 'Estimated minutes'],
    sortedEntriesDescending(report.featureTotals).map(([feature, minutes]) => [
      feature,
      formatHours(minutes),
      minutes.toFixed(1),
    ]),
  );

  const monthlyFeatureRows = [...report.monthlyTotals.keys()]
    .sort((left, right) => left.localeCompare(right))
    .flatMap((month) => {
      const featureRows = sortedEntriesDescending(
        new Map(
          [...report.monthlyFeatureTotals.entries()]
            .filter(([key]) => key.startsWith(`${month}\t`))
            .map(([key, minutes]) => [key.split('\t')[1], minutes]),
        ),
      );

      return featureRows.map(([feature, minutes]) => [
        month,
        feature,
        formatHours(minutes),
        minutes.toFixed(1),
      ]);
    });

  printTable(
    'Monthly Feature Breakdown',
    ['Month', 'Feature', 'Estimated time', 'Estimated minutes'],
    monthlyFeatureRows,
  );
}

main();
