#!/usr/bin/env tsx
/**
 * Copy prompt-engine data (skills.json, domain-map.json) from src/agents/prompt-engine/data to:
 * - dist/agents/prompt-engine/data (unbundled layout)
 * - dist/data (canonical for bundled gateway: node dist/index.js resolves here)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const dataDir = path.join(projectRoot, "src", "agents", "prompt-engine", "data");
const dataFiles = ["skills.json", "domain-map.json"] as const;

const distDirs = [
  path.join(projectRoot, "dist", "agents", "prompt-engine", "data"),
  path.join(projectRoot, "dist", "data"),
];

function copySkillsData() {
  for (const filename of dataFiles) {
    const srcPath = path.join(dataDir, filename);
    if (!fs.existsSync(srcPath)) {
      console.warn("[copy-skills-data] Source file not found:", srcPath);
      continue;
    }
    for (const distDir of distDirs) {
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      const destPath = path.join(distDir, filename);
      fs.copyFileSync(srcPath, destPath);
      console.log(`[copy-skills-data] Copied ${filename} to ${destPath}`);
    }
  }
}

copySkillsData();
