import type { FeatureDef, FeatureValue, RequirementState } from "./types";

/**
 * Does a plan value satisfy what the user needs?
 *  - `need === null`  -> the user said "I'm not sure"  -> unknown
 *  - `planValue === null` -> we could not verify the plan -> unknown
 */
export function compareValue(feature: FeatureDef, planValue: FeatureValue, need: FeatureValue): RequirementState {
  if (need === null || need === undefined) return "unknown";
  if (planValue === null || planValue === undefined) return "unknown";

  switch (feature.type) {
    case "boolean": {
      if (need === false) return planValue ? "unused" : "met";
      return planValue ? "met" : "not_met";
    }
    case "number": {
      const have = Number(planValue);
      const want = Number(need);
      if (Number.isNaN(have) || Number.isNaN(want)) return "unknown";
      return have >= want ? "met" : "not_met";
    }
    case "ordinal": {
      const levels = feature.levels ?? [];
      const have = levels.indexOf(String(planValue));
      const want = levels.indexOf(String(need));
      if (have < 0 || want < 0) return "unknown";
      return have >= want ? "met" : "not_met";
    }
    default:
      return "unknown";
  }
}

/** Is value A strictly "more" than value B for this feature? (used for gained/lost lists) */
export function isMore(feature: FeatureDef, a: FeatureValue, b: FeatureValue): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  switch (feature.type) {
    case "boolean":
      return a === true && b === false;
    case "number":
      return Number(a) > Number(b);
    case "ordinal": {
      const levels = feature.levels ?? [];
      return levels.indexOf(String(a)) > levels.indexOf(String(b));
    }
    default:
      return false;
  }
}
