#!/usr/bin/env tsx
/**
 * Copy skills.json from src/agents/prompt-engine/data to:
 * - dist/agents/prompt-engine/data (unbundled layout)
 * - dist/data (canonical for bundled gateway: node dist/index.js resolves here)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const srcSkillsJson = path.join(
  projectRoot,
  "src",
  "agents",
  "prompt-engine",
  "data",
  "skills.json",
);
const distPaths = [
  path.join(projectRoot, "dist", "agents", "prompt-engine", "data", "skills.json"),
  path.join(projectRoot, "dist", "data", "skills.json"),
];

function copySkillsData() {
  if (!fs.existsSync(srcSkillsJson)) {
    console.warn("[copy-skills-data] Source file not found:", srcSkillsJson);
    return;
  }

  for (const distSkillsJson of distPaths) {
    const distDir = path.dirname(distSkillsJson);
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    fs.copyFileSync(srcSkillsJson, distSkillsJson);
    console.log(`[copy-skills-data] Copied skills.json to ${distSkillsJson}`);
  }
}

copySkillsData();
