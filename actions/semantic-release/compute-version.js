const fs = require('fs');
const { execSync } = require('child_process');

function setOutput(name, value) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function parseVersion(v) {
  const stripped = String(v).replace(/^v/, '').replace(/\+.*$/, '');
  const m = stripped.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!m) throw new Error(`Cannot parse version: ${v}`);
  const out = {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    preSuffix: null,
    preNum: null,
  };
  if (m[4]) {
    const pre = m[4].match(/^([a-zA-Z][a-zA-Z0-9-]*)\.(\d+)$/);
    if (pre) {
      out.preSuffix = pre[1];
      out.preNum = parseInt(pre[2], 10);
    } else {
      out.preSuffix = m[4];
      out.preNum = 0;
    }
  }
  return out;
}

function bumpXYZ({ major, minor, patch }, type) {
  switch (type) {
    case 'major': return { major: major + 1, minor: 0, patch: 0 };
    case 'minor': return { major, minor: minor + 1, patch: 0 };
    case 'patch': return { major, minor, patch: patch + 1 };
    default: throw new Error(`Invalid bump type: ${type}`);
  }
}

const xyz = ({ major, minor, patch }) => `${major}.${minor}.${patch}`;
const xyzEqual = (a, b) => a.major === b.major && a.minor === b.minor && a.patch === b.patch;

const bumpType = process.env.BUMP_TYPE;
const isPrerelease = process.env.IS_PRERELEASE === 'true';
const suffix = process.env.PRERELEASE_SUFFIX;

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const current = parseVersion(pkg.version);

let lastFinal = null;
try {
  const tags = execSync('git tag -l "v*.*.*" --sort=-v:refname', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const tag of tags) {
    try {
      const v = parseVersion(tag);
      if (!v.preSuffix) { lastFinal = v; break; }
    } catch { /* skip unparseable tags */ }
  }
} catch { /* no tags */ }

if (!lastFinal) {
  lastFinal = { major: current.major, minor: current.minor, patch: current.patch };
}

const target = bumpXYZ(lastFinal, bumpType);

let newVersion;
if (!isPrerelease) {
  newVersion = xyz(target);
} else if (current.preSuffix && xyzEqual(current, target) && current.preSuffix === suffix) {
  newVersion = `${xyz(target)}-${suffix}.${current.preNum + 1}`;
} else {
  newVersion = `${xyz(target)}-${suffix}.0`;
}

const newTag = `v${newVersion}`;

let previousTag = '';
try {
  previousTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
} catch { /* no previous tag */ }

console.log(`Last final version: ${xyz(lastFinal)}`);
console.log(`Current package.json version: ${pkg.version}`);
console.log(`Target X.Y.Z: ${xyz(target)}`);
console.log(`New version: ${newVersion}`);
console.log(`New tag: ${newTag}`);
console.log(`Previous tag: ${previousTag || '(none)'}`);

setOutput('new_version', newVersion);
setOutput('new_tag', newTag);
setOutput('previous_tag', previousTag);
