import type { RuleResult } from "../../core/types.js";
import type { LayoutLintWidgetSettings, WidgetCategory } from "./types.js";
import { clampConstraintsPerPage } from "../settings/index.js";

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
  getSettings(): LayoutLintWidgetSettings;
  updateSettings(patch: Partial<LayoutLintWidgetSettings>): LayoutLintWidgetSettings;
  resetSettings(): LayoutLintWidgetSettings;
  getActiveCategory(): WidgetCategory;
  setActiveCategory(category: WidgetCategory): void;
  getActivePage(category?: WidgetCategory): number;
  setActivePage(page: number, category?: WidgetCategory): void;
  getViewModel(results?: RuleResult[]): WidgetViewModel;
}

export interface WidgetViewModel {
  category: WidgetCategory;
  page: number;
  totalPages: number;
  totalInCategory: number;
  visibleResults: RuleResult[];
  counts: {
    all: number;
    failing: number;
    passing: number;
  };
  settings: LayoutLintWidgetSettings;
}

interface CreateWidgetStateOptions {
  initialSettings: LayoutLintWidgetSettings;
  defaults: LayoutLintWidgetSettings;
}

const CATEGORY_ORDER: WidgetCategory[] = ["all", "failing", "passing"];

export function createWidgetState(options: CreateWidgetStateOptions): WidgetState {
  let activeRule: RuleResult | null = null;
  let latestResults: RuleResult[] = [];
  let settings: LayoutLintWidgetSettings = {
    ...options.defaults,
    ...options.initialSettings,
  };
  let activeCategory: WidgetCategory = "all";
  const activePageByCategory: Record<WidgetCategory, number> = {
    all: 1,
    failing: 1,
    passing: 1,
  };
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

  const getResultsForCategory = (results: RuleResult[], category: WidgetCategory): RuleResult[] => {
    if (category === "failing") return results.filter((rule) => !rule.pass);
    if (category === "passing") return results.filter((rule) => rule.pass);
    return results;
  };

  const getCategoryCount = (results: RuleResult[], category: WidgetCategory): number => {
    return getResultsForCategory(results, category).length;
  };

  const getTotalPages = (results: RuleResult[], category: WidgetCategory): number => {
    const count = getCategoryCount(results, category);
    if (!settings.tabsEnabled) return 1;
    return Math.max(1, Math.ceil(count / settings.constraintsPerPage));
  };

  const clampPage = (value: number, category: WidgetCategory, results: RuleResult[]): number => {
    const totalPages = getTotalPages(results, category);
    return Math.min(Math.max(Math.floor(value || 1), 1), totalPages);
  };

  const syncPages = () => {
    for (const category of CATEGORY_ORDER) {
      activePageByCategory[category] = clampPage(activePageByCategory[category], category, latestResults);
    }
  };

  const getViewModel = (results: RuleResult[] = latestResults): WidgetViewModel => {
    const currentCategory = activeCategory;
    const categoryResults = getResultsForCategory(results, currentCategory);
    const totalPages = getTotalPages(results, currentCategory);
    const page = clampPage(activePageByCategory[currentCategory], currentCategory, results);
    const start = settings.tabsEnabled ? (page - 1) * settings.constraintsPerPage : 0;
    const end = settings.tabsEnabled ? start + settings.constraintsPerPage : categoryResults.length;
    const visibleResults = categoryResults.slice(start, end);

    return {
      category: currentCategory,
      page,
      totalPages,
      totalInCategory: categoryResults.length,
      visibleResults,
      counts: {
        all: results.length,
        failing: getCategoryCount(results, "failing"),
        passing: getCategoryCount(results, "passing"),
      },
      settings,
    };
  };

  const syncActiveRuleVisibility = () => {
    if (!activeRule) return;
    if (pinnedRuleKeys.has(getRuleKey(activeRule))) return;
    const visibleKeys = new Set(getViewModel(latestResults).visibleResults.map((rule) => getRuleKey(rule)));
    if (!visibleKeys.has(getRuleKey(activeRule))) {
      activeRule = null;
    }
  };

  return {
    isHighlightsEnabled: () => settings.highlightsEnabled,
    toggleHighlights: () => {
      settings = {
        ...settings,
        highlightsEnabled: !settings.highlightsEnabled,
      };
      return settings.highlightsEnabled;
    },
    getActiveRule: () => activeRule,
    setActiveRule: (rule) => {
      activeRule = rule;
    },
    clearPinnedRules: () => {
      pinnedRuleKeys.clear();
      activeRule = null;
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
      syncPages();
      syncActiveRule();
      syncActiveRuleVisibility();
    },
    getRuleKey,
    getSettings: () => settings,
    updateSettings: (patch) => {
      settings = {
        highlightsEnabled:
          typeof patch.highlightsEnabled === "boolean" ? patch.highlightsEnabled : settings.highlightsEnabled,
        tabsEnabled: typeof patch.tabsEnabled === "boolean" ? patch.tabsEnabled : settings.tabsEnabled,
        minimized: typeof patch.minimized === "boolean" ? patch.minimized : settings.minimized,
        statusTransitionDelayEnabled:
          typeof patch.statusTransitionDelayEnabled === "boolean"
            ? patch.statusTransitionDelayEnabled
            : settings.statusTransitionDelayEnabled,
        constraintsPerPage:
          typeof patch.constraintsPerPage === "number" && Number.isFinite(patch.constraintsPerPage)
            ? clampConstraintsPerPage(patch.constraintsPerPage)
            : settings.constraintsPerPage,
      };
      syncPages();
      syncActiveRuleVisibility();
      return settings;
    },
    resetSettings: () => {
      settings = { ...options.defaults };
      activePageByCategory.all = 1;
      activePageByCategory.failing = 1;
      activePageByCategory.passing = 1;
      syncPages();
      syncActiveRuleVisibility();
      return settings;
    },
    getActiveCategory: () => activeCategory,
    setActiveCategory: (category) => {
      activeCategory = category;
      syncPages();
      syncActiveRuleVisibility();
    },
    getActivePage: (category = activeCategory) => activePageByCategory[category],
    setActivePage: (page, category = activeCategory) => {
      activePageByCategory[category] = clampPage(page, category, latestResults);
      syncActiveRuleVisibility();
    },
    getViewModel,
  };
}
