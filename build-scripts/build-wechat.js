#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function log(step, message) {
  const now = new Date().toISOString();
  console.log(`[${now}] [${step}] ${message}`);
}

function parseArgs(argv) {
  const options = {
    platform: "wechat",
    debug: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--platform") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --platform");
      }
      options.platform = value;
      i += 1;
      continue;
    }
    if (arg === "--debug") {
      options.debug = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log("Usage: node build-scripts/build-wechat.js [--platform wechat] [--debug]");
}

function normalizePlatform(platform) {
  if (platform === "wechat" || platform === "wechatgame") {
    return "wechatgame";
  }
  throw new Error(`Unsupported platform: ${platform}. Only wechat is supported.`);
}

function resolveCreatorBinary() {
  const fromEnv = process.env.COCOS_CREATOR_PATH || process.env.COCOS_CREATOR;
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  const whichResult = spawnSync("which", ["CocosCreator"], {
    encoding: "utf8",
  });
  if (whichResult.status === 0) {
    const candidate = whichResult.stdout.trim();
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const macPath = resolveCreatorFromMacApplications();
  if (macPath) {
    return macPath;
  }

  throw new Error(
    "Cocos Creator not found. Set COCOS_CREATOR_PATH or install Cocos Creator v3.x."
  );
}

function resolveCreatorFromMacApplications() {
  const baseDir = "/Applications/CocosCreator/Creator";
  if (!fs.existsSync(baseDir)) {
    return null;
  }

  const entries = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const version = entries[i];
    const binary = path.join(
      baseDir,
      version,
      "CocosCreator.app",
      "Contents",
      "MacOS",
      "CocosCreator"
    );
    if (fs.existsSync(binary)) {
      return binary;
    }
  }

  const legacyBinary = path.join(
    baseDir,
    "CocosCreator.app",
    "Contents",
    "MacOS",
    "CocosCreator"
  );
  if (fs.existsSync(legacyBinary)) {
    return legacyBinary;
  }

  return null;
}

function ensureOutputDir(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function hasBuildArtifacts(outputDir) {
  if (!fs.existsSync(outputDir)) {
    return false;
  }
  const files = fs.readdirSync(outputDir);
  return files.length > 0;
}

function runBuild(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(`[build] ${chunk.toString()}`);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(`[build] ${chunk.toString()}`);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Cocos build exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const platform = normalizePlatform(options.platform);

  const projectRoot = path.resolve(__dirname, "..");
  const outputDir = path.join(projectRoot, "build", "wechat");
  const creatorBinary = resolveCreatorBinary();

  log("check", `Using Cocos Creator: ${creatorBinary}`);
  log("check", `Project root: ${projectRoot}`);

  ensureOutputDir(outputDir);

  const buildConfig = [
    `platform=${platform}`,
    `debug=${options.debug}`,
    `buildPath=${outputDir}`,
  ].join(";");

  const args = ["--path", projectRoot, "--build", buildConfig];
  log("build", `Starting build with config: ${buildConfig}`);

  await runBuild(creatorBinary, args);

  if (!hasBuildArtifacts(outputDir)) {
    throw new Error(`Build finished but no artifacts found in ${outputDir}`);
  }

  log("done", `Build succeeded. Artifacts available at: ${outputDir}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  log("error", message);
  process.exit(1);
});
