import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function resolveSigningIdentity(options) {
  if (!options.signed) return "-";

  const { stdout } = await exec("/usr/bin/security", ["find-identity", "-v", "-p", "codesigning"]);
  const identities = [...stdout.matchAll(/\b([A-Fa-f0-9]{40}) "(Developer ID Application: .+)"/g)];
  const matches = identities.filter(([, hash, name]) =>
    !options.signingIdentity || options.signingIdentity === hash || options.signingIdentity === name
  );
  const hashes = [...new Set(matches.map(([, hash]) => hash))];
  if (hashes.length !== 1) {
    throw new Error(hashes.length > 1
      ? "Multiple Developer ID Application certificates found. Select one with --signing-identity=<name or SHA-1>."
      : "No matching Developer ID Application signing identity found. Install the certificate and its private key in Keychain Access. See packages/codex-launcher/README.md for setup.");
  }
  return hashes[0];
}

export async function verifyApp(appPath) {
  await exec("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath]);
}

export async function signApp(appPath, identity) {
  const args = ["--force", "--sign", identity, "--options", "runtime"];
  if (identity !== "-") args.push("--timestamp");
  await exec("/usr/bin/codesign", [...args, appPath]);
  await verifyApp(appPath);
}

export async function checkNotaryProfile(profile) {
  try {
    await notarytool(["history"], profile);
  } catch (error) {
    throw new Error(`Cannot use notarization profile "${profile}". Run xcrun notarytool store-credentials "${profile}" first.\n${error.message}`);
  }
}

export async function notarizeApp(appPath, archivePath, profile) {
  const { stdout } = await notarytool(["submit", archivePath], profile);
  const { id } = JSON.parse(stdout);
  console.log(`Notarization submitted: ${id}. Waiting for Apple…`);
  await waitForNotarization(id, profile);
  await exec("/usr/bin/xcrun", ["stapler", "staple", appPath]);
  await exec("/usr/bin/xcrun", ["stapler", "validate", appPath]);
  await verifyApp(appPath);
  await exec("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=2", appPath]);
  console.log("Notarized, stapled, and accepted by Gatekeeper.");
}

async function waitForNotarization(id, profile) {
  try {
    const { stdout } = await notarytool(["wait", id, "--timeout", "30m"], profile);
    const { status } = JSON.parse(stdout);
    if (status !== "Accepted") throw new Error(`Apple returned ${status}.`);
  } catch (error) {
    const log = await notarytool(["log", id], profile).catch(() => null);
    throw new Error(`Notarization ${id} did not succeed.\n${error.message}\n${log?.stdout ?? "The submission log is not available yet; check this ID with xcrun notarytool info."}`);
  }
}

function notarytool(args, profile) {
  return exec("/usr/bin/xcrun", ["notarytool", ...args, "--keychain-profile", profile, "--output-format", "json"]);
}
