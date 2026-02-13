import { SkillsLoader } from "./skills-loader.js";
import { IntentContext } from "./types.js";

/**
 * Interface for a lightweight LLM used for classification.
 * This decouples the engine from the specific LLM implementation.
 */
export interface IDomainClassifier {
  classify(input: string): Promise<Partial<IntentContext>>;
}

/** Cached rule-based patterns built from domain-map.json triggers. */
let cachedRules: Array<{ domain: string; regex: RegExp }> | null = null;

async function getRules(): Promise<Array<{ domain: string; regex: RegExp }>> {
  if (cachedRules) {
    return cachedRules;
  }
  const domainTriggers = await SkillsLoader.getDomainTriggers();
  cachedRules = domainTriggers
    .filter((dt) => dt.patterns.length > 0)
    .map((dt) => {
      const patternString = dt.patterns
        .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      return {
        domain: dt.domain,
        regex: new RegExp(`\\b(${patternString})\\b`, "i"),
      };
    });
  cachedRules.push({
    domain: "General",
    regex: /^(hi|hello|hey|hola|greetings|help|start)$/i,
  });
  return cachedRules;
}

export class Triangulator {
  /**
   * Phase 1: Input Analysis & Requirement Triangulation
   * Executes the Hybrid Routing Architecture (rule-based from domain-map, then optional LLM).
   */
  static async analyze(input: string, classifier?: IDomainClassifier): Promise<IntentContext> {
    const rules = await getRules();
    for (const rule of rules) {
      if (rule.regex.test(input)) {
        return this.createContext(rule.domain, "COMPLETE", "RULE_BASED");
      }
    }

    // 2. Layer 2: LLM Inference (Semantic)
    // Only engaged if no rules matched and a classifier is provided.
    if (classifier) {
      try {
        const llmResult = await classifier.classify(input);

        // Merge LLM result with defaults
        const domain = llmResult.domain || "General";
        const status = this.evaluateCompleteness(llmResult) ? "COMPLETE" : "MISSING";

        return {
          domain,
          userLevel: llmResult.userLevel || null,
          tone: llmResult.tone || null,
          status,
          missingFields: status === "MISSING" ? this.findMissingFields(llmResult) : [],
          source: "LLM_INFERENCE",
        };
      } catch (error) {
        console.warn("[Triangulator] LLM classification failed, falling back.", error);
        // Fallthrough to defaults
      }
    }

    return this.createContext("General", "COMPLETE", "FALLBACK");
  }

  private static createContext(
    domain: string,
    status: "COMPLETE" | "MISSING",
    source: "RULE_BASED" | "LLM_INFERENCE" | "FALLBACK",
  ): IntentContext {
    return {
      domain,
      status,
      source,
      userLevel: null,
      tone: null,
      missingFields: [],
    };
  }

  private static evaluateCompleteness(result: Partial<IntentContext>): boolean {
    // Placeholder logic: assume missing if no domain
    // In real implementation, this checks strict requirements
    return !!result.domain;
  }

  private static findMissingFields(
    result: Partial<IntentContext>,
  ): ("domain" | "userLevel" | "tone")[] {
    const missing: ("domain" | "userLevel" | "tone")[] = [];
    if (!result.domain) {
      missing.push("domain");
    }
    return missing;
  }

  static generateClarification(missingFields: ("domain" | "userLevel" | "tone")[]): string {
    return `Could you please provide more details about ${missingFields.join(", ")}?`;
  }
}
