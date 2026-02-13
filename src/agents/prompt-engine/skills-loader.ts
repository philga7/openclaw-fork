// [NEW FILE] src/agents/prompt-engine/skills-loader.ts

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { SkillCategory, SkillDefinition, SkillLibrary } from "./types.js";

/** Domain-map entry: triggers (keywords) and skill names for that domain. */
interface DomainConfig {
  triggers: string[];
  skills: string[];
}

/** Top-level structure for domain-map.json. */
interface DomainMap {
  domains: Record<string, DomainConfig>;
  global_defaults?: string[];
}

// Path when this file lives at dist/agents/prompt-engine/ (unbundled) or dist/ (bundled chunk)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_PATH = path.join(__dirname, "data", "skills.json");
const MAP_PATH = path.join(__dirname, "data", "domain-map.json");

/** Dist-root path: when process is started as `node dist/index.js`, skills.json lives at dist/data/skills.json. */
function getDistRootSkillsPath(): string | null {
  const entry = typeof process !== "undefined" && process.argv[1];
  if (!entry || typeof entry !== "string") {
    return null;
  }
  const distDir = path.dirname(entry);
  if (path.basename(distDir) !== "dist") {
    return null;
  }
  return path.join(distDir, "data", "skills.json");
}

/** Source path when dist was wiped (e.g. git clean, failed build). repoRoot defaults from __dirname. */
function getSourceSkillsPath(repoRoot?: string): string {
  const root =
    repoRoot ??
    (path.basename(__dirname) === "dist"
      ? path.resolve(__dirname, "..")
      : path.resolve(__dirname, "..", "..", ".."));
  return path.join(root, "src", "agents", "prompt-engine", "data", "skills.json");
}

/** Ordered paths to try: dist/data (bundled), __dirname/data, then source. */
function getSkillsPathsToTry(): string[] {
  const paths: string[] = [];
  const distRootPath = getDistRootSkillsPath();
  if (distRootPath) {
    paths.push(distRootPath);
  }
  paths.push(SKILLS_PATH);
  const entry = typeof process !== "undefined" && process.argv[1];
  const repoRoot =
    entry && typeof entry === "string"
      ? path.resolve(path.dirname(entry), "..")
      : path.resolve(__dirname, "..", "..", "..");
  paths.push(getSourceSkillsPath(repoRoot));
  return [...new Set(paths)];
}

/** Dist-root path for a file under data/ (e.g. domain-map.json). */
function getDistRootDataPath(filename: string): string | null {
  const entry = typeof process !== "undefined" && process.argv[1];
  if (!entry || typeof entry !== "string") {
    return null;
  }
  const distDir = path.dirname(entry);
  if (path.basename(distDir) !== "dist") {
    return null;
  }
  return path.join(distDir, "data", filename);
}

/** Source path for a file under prompt-engine/data. */
function getSourceDataPath(filename: string, repoRoot?: string): string {
  const root =
    repoRoot ??
    (path.basename(__dirname) === "dist"
      ? path.resolve(__dirname, "..")
      : path.resolve(__dirname, "..", "..", ".."));
  return path.join(root, "src", "agents", "prompt-engine", "data", filename);
}

/** Ordered paths to try for domain-map.json (same resolution order as skills). */
function getDomainMapPathsToTry(): string[] {
  const paths: string[] = [];
  const distRoot = getDistRootDataPath("domain-map.json");
  if (distRoot) {
    paths.push(distRoot);
  }
  paths.push(MAP_PATH);
  const entry = typeof process !== "undefined" && process.argv[1];
  const repoRoot =
    entry && typeof entry === "string"
      ? path.resolve(path.dirname(entry), "..")
      : path.resolve(__dirname, "..", "..", "..");
  paths.push(getSourceDataPath("domain-map.json", repoRoot));
  return [...new Set(paths)];
}

export class SkillsLoader {
  private static cache: SkillLibrary | null = null;
  private static mapCache: DomainMap | null = null;

  private static async retryLoadAfterEnoent(
    paths: string[],
    primaryPath: string,
    options?: { retries?: number; delayMs?: number },
  ): Promise<SkillLibrary | null> {
    const retries = options?.retries ?? 20;
    const delayMs = options?.delayMs ?? 1000;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      // Simple delay between attempts
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      for (const p of paths) {
        try {
          const rawData = await fs.readFile(p, "utf-8");
          const library = JSON.parse(rawData) as SkillLibrary;
          if (p !== primaryPath) {
            console.warn(
              "[PromptEngine] Loaded skills from source path after wait (dist copy missing):",
              p,
            );
          }
          return library;
        } catch (err) {
          const code =
            err && typeof err === "object" && "code" in err
              ? (err as NodeJS.ErrnoException).code
              : undefined;
          if (code === "ENOENT") {
            // Still rebuilding; try next path / attempt.
            continue;
          }
          console.error("[PromptEngine] Failed to load skills library during wait:", err);
          return {};
        }
      }
    }

    return null;
  }

  /**
   * Loads the skills.json file and caches it in memory.
   * Tries dist/data (when run as node dist/index.js), then __dirname/data, then source path.
   */
  static async loadLibrary(): Promise<SkillLibrary> {
    if (this.cache) {
      return this.cache;
    }

    const paths = getSkillsPathsToTry();
    const primaryPath = paths[0];
    let sawEnoentOnly = true;
    for (const p of paths) {
      try {
        const rawData = await fs.readFile(p, "utf-8");
        this.cache = JSON.parse(rawData) as SkillLibrary;
        if (p !== primaryPath) {
          console.warn("[PromptEngine] Loaded skills from source path (dist copy missing):", p);
        }
        return this.cache;
      } catch (err) {
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as NodeJS.ErrnoException).code
            : undefined;
        if (code === "ENOENT") {
          // Track that we only saw ENOENT so far; we may be in a build window.
          continue;
        }
        sawEnoentOnly = false;
        console.error("[PromptEngine] Failed to load skills library:", err);
        return {};
      }
    }
    if (sawEnoentOnly) {
      // All attempts failed with ENOENT – likely a build-phase race where dist/ is being rebuilt.
      const retried = await this.retryLoadAfterEnoent(paths, primaryPath);
      if (retried) {
        this.cache = retried;
        return this.cache;
      }
      console.error(
        "[PromptEngine] skills.json not found in dist or source path after build wait window",
      );
      return {};
    }

    console.error("[PromptEngine] skills.json not found in dist or source path");
    return {};
  }

  /**
   * Loads domain-map.json and caches it. Uses same path resolution as skills (dist/data, then source).
   * Returns { domains: {} } if file is missing or invalid.
   */
  static async loadDomainMap(): Promise<DomainMap> {
    if (this.mapCache) {
      return this.mapCache;
    }
    const paths = getDomainMapPathsToTry();
    for (const p of paths) {
      try {
        const rawData = await fs.readFile(p, "utf-8");
        this.mapCache = JSON.parse(rawData) as DomainMap;
        if (!this.mapCache.domains || typeof this.mapCache.domains !== "object") {
          this.mapCache = { domains: {} };
        }
        return this.mapCache;
      } catch (err) {
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as NodeJS.ErrnoException).code
            : undefined;
        if (code === "ENOENT") {
          continue;
        }
        console.warn("[PromptEngine] Domain map not found or invalid.", err);
        this.mapCache = { domains: {} };
        return this.mapCache;
      }
    }
    console.warn("[PromptEngine] domain-map.json not found; using empty domain map.");
    this.mapCache = { domains: {} };
    return this.mapCache;
  }

  /**
   * Returns all domain trigger patterns for the Triangulator (rule-based routing).
   */
  static async getDomainTriggers(): Promise<Array<{ domain: string; patterns: string[] }>> {
    const map = await this.loadDomainMap();
    return Object.entries(map.domains).map(([domain, config]) => ({
      domain,
      patterns: config.triggers ?? [],
    }));
  }

  /**
   * Loads skills for a given domain from domain-map.json (domain + global_defaults), then resolves
   * names to SkillDefinition via the library. Case-insensitive domain lookup. Fallback: General_Reasoning.
   */
  static async getSkillsForDomain(domain: string): Promise<SkillDefinition[]> {
    const library = await this.loadLibrary();
    const map = await this.loadDomainMap();
    const loadedSkills: SkillDefinition[] = [];

    const targetKey = Object.keys(map.domains).find(
      (k) => k.toLowerCase() === domain.toLowerCase(),
    );
    const skillNames = targetKey ? [...(map.domains[targetKey].skills ?? [])] : [];

    if (map.global_defaults?.length) {
      skillNames.push(...map.global_defaults);
    }

    for (const name of new Set(skillNames)) {
      const skill = this.findSkill(library, name);
      if (skill) {
        loadedSkills.push(skill);
      }
    }

    if (loadedSkills.length === 0) {
      const generalSkill = this.findSkill(library, "General_Reasoning");
      if (generalSkill) {
        loadedSkills.push(generalSkill);
      }
    }

    return loadedSkills;
  }

  /**
   * Deep search for a skill by its name across all categories and sub-categories.
   */
  static findSkill(library: SkillLibrary, skillName: string): SkillDefinition | null {
    for (const key in library) {
      const section = library[key];

      // Check top-level skills in section
      if (section.skills) {
        const found = section.skills.find((s) => s.skill_name === skillName);
        if (found) {
          return found;
        }
      }

      // Check nested categories
      if (section.categories) {
        const foundInNested = this.findInCategories(section.categories, skillName);
        if (foundInNested) {
          return foundInNested;
        }
      }
    }
    return null;
  }

  private static findInCategories(
    categories: SkillCategory[],
    skillName: string,
  ): SkillDefinition | null {
    for (const category of categories) {
      const found = category.skills.find((s) => s.skill_name === skillName);
      if (found) {
        return found;
      }
    }
    return null;
  }
}
