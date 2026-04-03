import type { RuleResult } from "../../evaluator.js";

export interface WidgetState {
  isHighlightsEnabled(): boolean;
  toggleHighlights(): boolean;
  getActiveRule(): RuleResult | null;
  setActiveRule(rule: RuleResult | null): void;
  clearPinnedRules(): void;
  togglePinnedRule(rule: RuleResult): void;
  hasPinnedRules(): boolean;
  isPinned(rule: RuleResult): boolean;
  getPinnedRuleCount(): number;
  getPinnedRules(results: RuleResult[]): RuleResult[];
  applyResults(results: RuleResult[]): void;
  getRuleKey(rule: RuleResult): string;
}

export function createWidgetState(): WidgetState {
  let highlightsEnabled = true;
  let activeRule: RuleResult | null = null;
  let latestResults: RuleResult[] = [];
  const pinnedRuleKeys = new Set<string>();

  const getRuleKey = (rule: RuleResult) => {
    if (rule.target2) {
      return `${rule.element}::${rule.relation}::${rule.target ?? ""}::${rule.target2}`;
    }
    return `${rule.element}::${rule.relation}::${rule.target ?? ""}`;
  };

  const syncActiveRule = () => {
    if (!activeRule) return;
    const activeKey = getRuleKey(activeRule);
    activeRule = latestResults.find((candidate) => getRuleKey(candidate) === activeKey) ?? null;
  };

  return {
    isHighlightsEnabled: () => highlightsEnabled,
    toggleHighlights: () => {
      highlightsEnabled = !highlightsEnabled;
      return highlightsEnabled;
    },
    getActiveRule: () => activeRule,
    setActiveRule: (rule) => {
      activeRule = rule;
    },
    clearPinnedRules: () => {
      pinnedRuleKeys.clear();
      if (activeRule) syncActiveRule();
    },
    togglePinnedRule: (rule) => {
      const key = getRuleKey(rule);
      if (pinnedRuleKeys.has(key)) {
        pinnedRuleKeys.delete(key);
        activeRule = pinnedRuleKeys.size === 0 ? rule : activeRule;
        return;
      }

      pinnedRuleKeys.add(key);
      activeRule = rule;
    },
    hasPinnedRules: () => pinnedRuleKeys.size > 0,
    isPinned: (rule) => pinnedRuleKeys.has(getRuleKey(rule)),
    getPinnedRuleCount: () => pinnedRuleKeys.size,
    getPinnedRules: (results) => results.filter((rule) => pinnedRuleKeys.has(getRuleKey(rule))),
    applyResults: (results) => {
      latestResults = results;
      const availableKeys = new Set(results.map((candidate) => getRuleKey(candidate)));
      for (const key of Array.from(pinnedRuleKeys)) {
        if (!availableKeys.has(key)) pinnedRuleKeys.delete(key);
      }
      syncActiveRule();
    },
    getRuleKey,
  };
}
