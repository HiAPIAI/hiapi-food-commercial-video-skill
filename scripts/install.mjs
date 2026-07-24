#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { argv, env, exit, stdin, stdout } from "node:process";
import readline from "node:readline/promises";

const SKILL_FOLDER = "hiapi-food-commercial-video";
const REPO_URL = "https://github.com/HiAPIAI/hiapi-food-commercial-video-skill.git";
const DISPLAY_NAME = "HiAPI Food Commercial Video Skill";
const API_KEY_PAGE = "https://www.hiapi.ai/en/dashboard/api-keys";

const args = argv.slice(2);
const yes = args.includes("-y") || args.includes("--yes") || !stdin.isTTY;

function flagValue(name) {
  const prefix = `--${name}=`;
  const match = args.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length).replace(/^~(?=$|[\\/])/, homedir()) : null;
}

const explicitTarget = flagValue("target") ?? flagValue("skills-dir");
const forceCodex = args.includes("--codex");
const forceClaude = args.includes("--claude");

function detectCandidates() {
  const candidates = [];
  const codexHome = env.CODEX_HOME || join(homedir(), ".codex");
  if (existsSync(codexHome)) candidates.push({ label: "Codex", dir: join(codexHome, "skills") });

  const claudeHome = join(homedir(), ".claude");
  if (existsSync(claudeHome)) candidates.push({ label: "Claude Code", dir: join(claudeHome, "skills") });
  return candidates;
}

async function resolveTargets() {
  if (forceCodex && forceClaude) {
    throw new Error("Choose either --codex or --claude, not both.");
  }
  if (explicitTarget) return [{ label: "explicit", dir: explicitTarget }];
  if (env.AGENT_SKILLS_DIR) return [{ label: "$AGENT_SKILLS_DIR", dir: env.AGENT_SKILLS_DIR }];

  const detected = detectCandidates();
  if (forceCodex) {
    return [detected.find((candidate) => candidate.label === "Codex")
      ?? { label: "Codex", dir: join(env.CODEX_HOME || join(homedir(), ".codex"), "skills") }];
  }
  if (forceClaude) {
    return [detected.find((candidate) => candidate.label === "Claude Code")
      ?? { label: "Claude Code", dir: join(homedir(), ".claude", "skills") }];
  }
  if (detected.length === 0) {
    throw new Error("No agent skills directory detected. Pass --codex, --claude, --target=/path, or AGENT_SKILLS_DIR=/path.");
  }
  if (detected.length === 1) return detected;
  if (yes) return detected;

  console.log("Detected agent skill directories:");
  detected.forEach((candidate, index) => console.log(`  ${index + 1}) ${candidate.label}: ${candidate.dir}`));
  console.log("  a) all");
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  const answer = (await prompt.question("Choose [1-N / a]: ")).trim().toLowerCase();
  prompt.close();
  if (answer === "a" || answer === "all") return detected;

  const index = Number.parseInt(answer, 10);
  if (Number.isInteger(index) && index >= 1 && index <= detected.length) return [detected[index - 1]];
  throw new Error("Invalid installation target selection.");
}

function ensureGit() {
  execFileSync("git", ["--version"], { stdio: "ignore" });
}

function installTo(target) {
  mkdirSync(target.dir, { recursive: true });
  const destination = join(target.dir, SKILL_FOLDER);
  if (existsSync(destination)) {
    console.log(`[${DISPLAY_NAME}] Replacing ${destination}.`);
    rmSync(destination, { recursive: true, force: true });
  }
  console.log(`[${DISPLAY_NAME}] Installing to ${destination}.`);
  execFileSync("git", ["clone", "--depth", "1", REPO_URL, destination], { stdio: "inherit" });
}

function reportApiKey() {
  if (env.HIAPI_API_KEY) {
    console.log(`[${DISPLAY_NAME}] HIAPI_API_KEY is set.`);
    return;
  }
  console.log(`[${DISPLAY_NAME}] HIAPI_API_KEY is not set.`);
  console.log(`Create one at ${API_KEY_PAGE}`);
}

try {
  ensureGit();
  for (const target of await resolveTargets()) installTo(target);
  reportApiKey();
  console.log(`[${DISPLAY_NAME}] Done. Restart the agent if it caches skills.`);
} catch (error) {
  console.error(`[${DISPLAY_NAME}] ${error?.message ?? error}`);
  exit(1);
}
