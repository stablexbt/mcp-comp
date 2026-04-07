// Policy Rule types for payment policy management and evaluation

export type PolicyRuleType = 'transaction_limit' | 'geo_restriction' | 'counterparty_restriction' | 'velocity_limit' | 'time_window';
export type PolicyRuleStatus = 'active' | 'inactive' | 'draft';
export type PolicyAction = 'allow' | 'block' | 'flag' | 'review';

// Base policy rule interface
export interface PolicyRule {
  id: string;
  version: number;
  name: string;
  description?: string;
  type: PolicyRuleType;
  status: PolicyRuleStatus;
  priority: number; // Higher number = higher priority
  action: PolicyAction;
  conditions: PolicyCondition;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

// Policy condition types
export interface PolicyCondition {
  // Transaction limits
  maxAmount?: number;
  minAmount?: number;
  currency?: string;
  
  // Geography restrictions
  allowedCountries?: string[]; // ISO country codes
  blockedCountries?: string[]; // ISO country codes
  
  // Counterparty restrictions
  allowedCounterparties?: string[];
  blockedCounterparties?: string[];
  allowedCounterpartyTypes?: Array<'agent' | 'wallet' | 'address' | 'individual' | 'business'>;
  
  // Velocity limits
  maxTransactionsPerDay?: number;
  maxTransactionsPerHour?: number;
  maxAmountPerDay?: number;
  maxAmountPerHour?: number;
  
  // Time window restrictions
  allowedDaysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  allowedHoursStart?: number; // 0-23
  allowedHoursEnd?: number; // 0-23
  timezone?: string;
  
  // Custom conditions (extensible)
  metadata?: Record<string, unknown>;
}

// Request to create a policy rule
export interface CreatePolicyRuleRequest {
  name: string;
  description?: string;
  type: PolicyRuleType;
  priority?: number;
  action: PolicyAction;
  conditions: PolicyCondition;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

// Response after creating a policy rule
export interface CreatePolicyRuleResponse {
  policyId: string;
  version: number;
  name: string;
  type: PolicyRuleType;
  status: PolicyRuleStatus;
  action: PolicyAction;
  conditions: PolicyCondition;
  createdAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

// Transaction to evaluate against policies
export interface PolicyEvaluationTransaction {
  transactionId?: string;
  amount: number;
  currency: string;
  sender: {
    id: string;
    type: 'agent' | 'wallet' | 'address' | 'individual' | 'business';
    jurisdiction?: string;
    address?: string;
  };
  recipient: {
    id: string;
    type: 'agent' | 'wallet' | 'address' | 'individual' | 'business';
    jurisdiction?: string;
    address?: string;
  };
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

// Request to evaluate a transaction against policies
export interface PolicyEvaluateRequest {
  transaction: PolicyEvaluationTransaction;
  context?: {
    // Velocity tracking context
    senderTransactionCountDay?: number;
    senderTransactionCountHour?: number;
    senderAmountDay?: number;
    senderAmountHour?: number;
  };
}

// Individual policy violation
export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  ruleType: PolicyRuleType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Result of policy evaluation
export interface PolicyEvaluateResult {
  evaluationId: string;
  transactionId?: string;
  overallDecision: 'pass' | 'fail';
  finalAction: PolicyAction;
  violations: PolicyViolation[];
  rulesEvaluated: number;
  rulesMatched: number;
  evaluatedAt: string;
}

// Response from policy evaluation endpoint
export interface PolicyEvaluateResponse {
  evaluationId: string;
  decision: 'pass' | 'fail';
  action: PolicyAction;
  violations: PolicyViolation[];
  summary: {
    rulesEvaluated: number;
    rulesMatched: number;
    violationCount: number;
    criticalViolations: number;
  };
  evaluatedAt: string;
  expiresAt: string;
}

// Policy list filter options
export interface PolicyListFilters {
  type?: PolicyRuleType;
  status?: PolicyRuleStatus;
  action?: PolicyAction;
}

// Update policy rule request
export interface UpdatePolicyRuleRequest {
  name?: string;
  description?: string;
  status?: PolicyRuleStatus;
  priority?: number;
  action?: PolicyAction;
  conditions?: Partial<PolicyCondition>;
  effectiveUntil?: string;
}

// Policy version history entry
export interface PolicyVersion {
  version: number;
  rule: PolicyRule;
  createdAt: string;
  createdBy: string;
  changeDescription?: string;
}
