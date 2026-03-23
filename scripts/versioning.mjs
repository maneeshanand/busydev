import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const cargoTomlPath = path.join(repoRoot, "src-tauri", "Cargo.toml");
const tauriConfPath = path.join(repoRoot, "src-tauri", "tauri.conf.json");

const supportedBumps = new Set(["patch", "minor", "major", "prepatch", "preminor", "premajor", "prerelease"]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(stderr || stdout || `${command} ${args.join(" ")} failed`);
  }

  return (result.stdout || "").trim();
}

function readPackageVersion() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  return packageJson.version;
}

function readCargoVersion() {
  const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error("could not find version in src-tauri/Cargo.toml");
  }
  return match[1];
}

function readTauriVersion() {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
  if (!tauriConf.version) {
    throw new Error("could not find version in src-tauri/tauri.conf.json");
  }
  return tauriConf.version;
}

function isSemver(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value);
}

function syncVersions(targetVersion) {
  if (!isSemver(targetVersion)) {
    throw new Error(`package.json version is not valid semver: ${targetVersion}`);
  }

  const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
  const nextCargoToml = cargoToml.replace(/^version\s*=\s*"[^"]+"/m, `version = "${targetVersion}"`);
  const cargoChanged = nextCargoToml !== cargoToml;

  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
  tauriConf.version = targetVersion;

  if (cargoChanged) {
    fs.writeFileSync(cargoTomlPath, nextCargoToml, "utf8");
  }
  fs.writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`, "utf8");
}

function assertVersionSync() {
  const pkg = readPackageVersion();
  const cargo = readCargoVersion();
  const tauri = readTauriVersion();

  if (!isSemver(pkg)) {
    throw new Error(`package.json version is not valid semver: ${pkg}`);
  }

  const mismatches = [];
  if (cargo !== pkg) mismatches.push(`Cargo.toml=${cargo}`);
  if (tauri !== pkg) mismatches.push(`tauri.conf.json=${tauri}`);

  if (mismatches.length > 0) {
    throw new Error(`version mismatch with package.json=${pkg}: ${mismatches.join(", ")}`);
  }
}

function ensureCleanWorktree() {
  const status = run("git", ["status", "--porcelain"]);
  if (status.length > 0) {
    throw new Error("working tree is not clean; commit/stash changes before cutting a release");
  }
}

function cmdCheck() {
  assertVersionSync();
  console.log(`version check passed: ${readPackageVersion()}`);
}

function cmdSync() {
  const version = readPackageVersion();
  syncVersions(version);
  assertVersionSync();
  console.log(`synced Cargo.toml and tauri.conf.json to ${version}`);
}

function cmdPrepare(bump) {
  if (!supportedBumps.has(bump)) {
    throw new Error(`unsupported bump "${bump}"; use one of: ${[...supportedBumps].join(", ")}`);
  }

  run("npm", ["version", bump, "--no-git-tag-version"]);
  const version = readPackageVersion();
  syncVersions(version);
  assertVersionSync();
  console.log(`prepared release version ${version}`);
}

function cmdTag() {
  assertVersionSync();
  const version = readPackageVersion();
  const tag = `v${version}`;
  run("git", ["tag", "-a", tag, "-m", `Release ${tag}`]);
  console.log(`created tag ${tag}`);
}

function cmdCut(bump) {
  ensureCleanWorktree();
  cmdPrepare(bump);

  const version = readPackageVersion();
  const tag = `v${version}`;

  run("git", ["add", "package.json", "package-lock.json", "src-tauri/Cargo.toml", "src-tauri/tauri.conf.json"]);
  run("git", ["commit", "-m", `chore(release): ${tag}`]);
  run("git", ["tag", "-a", tag, "-m", `Release ${tag}`]);

  console.log(`cut release commit and tag ${tag}`);
}

const [, , command, arg] = process.argv;

try {
  switch (command) {
    case "check":
      cmdCheck();
      break;
    case "sync":
      cmdSync();
      break;
    case "prepare":
      cmdPrepare(arg ?? "patch");
      break;
    case "tag":
      cmdTag();
      break;
    case "cut":
      cmdCut(arg ?? "patch");
      break;
    default:
      throw new Error("usage: node scripts/versioning.mjs <check|sync|prepare|tag|cut> [bump]");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
