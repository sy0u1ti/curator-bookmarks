import type { IgnoreRuleKind } from './IgnoreRulesIsland.js'

export const IGNORE_RULE_ACTION_EVENT = 'options:ignore-rule-action'

export type IgnoreRuleAction =
  | 'clear'
  | 'remove'

export interface IgnoreRuleActionDetail {
  action: IgnoreRuleAction
  kind: IgnoreRuleKind
  ruleId?: string
}

export function dispatchIgnoreRuleAction(detail: IgnoreRuleActionDetail): void {
  window.dispatchEvent(new CustomEvent<IgnoreRuleActionDetail>(IGNORE_RULE_ACTION_EVENT, {
    detail
  }))
}
