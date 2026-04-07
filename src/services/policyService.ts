import { v4 as uuidv4 } from 'uuid';
import {
  PolicyRule,
  PolicyRuleStatus,
  CreatePolicyRuleRequest,
  CreatePolicyRuleResponse,
  PolicyEvaluateRequest,
  PolicyEvaluateResult,
  PolicyEvaluateResponse,
  PolicyViolation,
  PolicyAction,
  PolicyVersion,
  UpdatePolicyRuleRequest,
} from '../types/policy';

// In-memory policy storage (in production, this would be a database)
const policyStore: Map<string, PolicyRule> = new Map();
const policyVersionHistory: Map<string, PolicyVersion[]> = new Map();

// Default system policies (loaded on startup)
const DEFAULT_POLICIES: CreatePolicyRuleRequest[] = [
  {
    name: 'Block Prohibited Countries',
    description: 'Block transactions to/from prohibited jurisdictions',
    type: 'geo_restriction',
    priority: 100,
    action: 'block',
    conditions: {
      blockedCountries: ['KP', 'IR', 'SY'], // North Korea, Iran, Syria
    },
  },
  {
    name: 'High Value Transaction Review',
    description: 'Flag transactions over $100,000 for manual review',
    type: 'transaction_limit',
    priority: 50,
    action: 'review',
    conditions: {
      minAmount: 100000,
    },
  },
  {
    name: 'Daily Velocity Limit',
    description: 'Block if sender exceeds 50 transactions per day',
    type: 'velocity_limit',
    priority: 40,
    action: 'block',
    conditions: {
      maxTransactionsPerDay: 50,
    },
  },
];

// Initialize default policies
let defaultsInitialized = false;

function initializeDefaultPolicies(): void {
  if (defaultsInitialized) return;
  
  for (const policy of DEFAULT_POLICIES) {
    // Check if a policy with this name already exists
    const existing = Array.from(policyStore.values()).find(p => p.name === policy.name);
    if (!existing) {
      createPolicyRule(policy, 'system');
    }
  }
  
  defaultsInitialized = true;
}

/**
 * Validate create policy rule request
 */
export function validateCreatePolicyRequest(body: unknown): body is CreatePolicyRuleRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as CreatePolicyRuleRequest;

  // Validate required fields
  if (typeof req.name !== 'string' || req.name.trim() === '') {
    return false;
  }

  const validTypes = ['transaction_limit', 'geo_restriction', 'counterparty_restriction', 'velocity_limit', 'time_window'];
  if (!validTypes.includes(req.type)) {
    return false;
  }

  const validActions = ['allow', 'block', 'flag', 'review'];
  if (!validActions.includes(req.action)) {
    return false;
  }

  // Validate conditions exist
  if (!req.conditions || typeof req.conditions !== 'object') {
    return false;
  }

  // Validate priority if provided
  if (req.priority !== undefined && (typeof req.priority !== 'number' || req.priority < 0)) {
    return false;
  }

  // Validate dates if provided
  if (req.effectiveFrom && isNaN(Date.parse(req.effectiveFrom))) {
    return false;
  }

  if (req.effectiveUntil && isNaN(Date.parse(req.effectiveUntil))) {
    return false;
  }

  return true;
}

/**
 * Validate evaluate request
 */
export function validateEvaluateRequest(body: unknown): body is PolicyEvaluateRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as PolicyEvaluateRequest;

  // Validate transaction exists
  if (!req.transaction || typeof req.transaction !== 'object') {
    return false;
  }

  const tx = req.transaction;

  // Validate amount
  if (typeof tx.amount !== 'number' || tx.amount <= 0) {
    return false;
  }

  // Validate currency
  if (typeof tx.currency !== 'string' || tx.currency.trim() === '') {
    return false;
  }

  // Validate sender
  if (!tx.sender || typeof tx.sender !== 'object') {
    return false;
  }
  if (typeof tx.sender.id !== 'string' || tx.sender.id.trim() === '') {
    return false;
  }
  if (!['agent', 'wallet', 'address', 'individual', 'business'].includes(tx.sender.type)) {
    return false;
  }

  // Validate recipient
  if (!tx.recipient || typeof tx.recipient !== 'object') {
    return false;
  }
  if (typeof tx.recipient.id !== 'string' || tx.recipient.id.trim() === '') {
    return false;
  }
  if (!['agent', 'wallet', 'address', 'individual', 'business'].includes(tx.recipient.type)) {
    return false;
  }

  return true;
}

/**
 * Create a new policy rule
 */
export function createPolicyRule(
  request: CreatePolicyRuleRequest,
  createdBy: string = 'system'
): CreatePolicyRuleResponse {
  initializeDefaultPolicies();

  const policyId = `pol_${uuidv4().replace(/-/g, '')}`;
  const now = new Date().toISOString();

  const rule: PolicyRule = {
    id: policyId,
    version: 1,
    name: request.name,
    description: request.description,
    type: request.type,
    status: 'active',
    priority: request.priority ?? 10,
    action: request.action,
    conditions: request.conditions,
    createdAt: now,
    updatedAt: now,
    createdBy,
    effectiveFrom: request.effectiveFrom,
    effectiveUntil: request.effectiveUntil,
  };

  // Store the rule
  policyStore.set(policyId, rule);

  // Store version history
  const versionHistory: PolicyVersion = {
    version: 1,
    rule: { ...rule },
    createdAt: now,
    createdBy,
    changeDescription: 'Initial policy creation',
  };
  policyVersionHistory.set(policyId, [versionHistory]);

  return {
    policyId: rule.id,
    version: rule.version,
    name: rule.name,
    type: rule.type,
    status: rule.status,
    action: rule.action,
    conditions: rule.conditions,
    createdAt: rule.createdAt,
    effectiveFrom: rule.effectiveFrom,
    effectiveUntil: rule.effectiveUntil,
  };
}

/**
 * Get all active policies sorted by priority (highest first)
 */
export function getActivePolicies(): PolicyRule[] {
  initializeDefaultPolicies();

  const now = new Date().toISOString();
  
  return Array.from(policyStore.values())
    .filter(policy => {
      // Must be active
      if (policy.status !== 'active') return false;
      
      // Check effective date range
      if (policy.effectiveFrom && policy.effectiveFrom > now) return false;
      if (policy.effectiveUntil && policy.effectiveUntil < now) return false;
      
      return true;
    })
    .sort((a, b) => b.priority - a.priority); // Higher priority first
}

/**
 * Get a policy by ID
 */
export function getPolicyById(policyId: string): PolicyRule | undefined {
  initializeDefaultPolicies();
  return policyStore.get(policyId);
}

/**
 * Get all policies (with optional filtering)
 */
export function getAllPolicies(
  status?: PolicyRuleStatus
): PolicyRule[] {
  initializeDefaultPolicies();

  let policies = Array.from(policyStore.values());
  
  if (status) {
    policies = policies.filter(p => p.status === status);
  }
  
  return policies.sort((a, b) => b.priority - a.priority);
}

/**
 * Update a policy rule (creates new version)
 */
export function updatePolicyRule(
  policyId: string,
  request: UpdatePolicyRuleRequest,
  updatedBy: string = 'system'
): PolicyRule | undefined {
  initializeDefaultPolicies();

  const existingRule = policyStore.get(policyId);
  if (!existingRule) {
    return undefined;
  }

  const now = new Date().toISOString();
  const newVersion = existingRule.version + 1;

  // Create updated rule
  const updatedRule: PolicyRule = {
    ...existingRule,
    version: newVersion,
    name: request.name ?? existingRule.name,
    description: request.description ?? existingRule.description,
    status: request.status ?? existingRule.status,
    priority: request.priority ?? existingRule.priority,
    action: request.action ?? existingRule.action,
    conditions: request.conditions 
      ? { ...existingRule.conditions, ...request.conditions }
      : existingRule.conditions,
    updatedAt: now,
    effectiveUntil: request.effectiveUntil ?? existingRule.effectiveUntil,
  };

  // Store updated rule
  policyStore.set(policyId, updatedRule);

  // Add to version history
  const history = policyVersionHistory.get(policyId) || [];
  history.push({
    version: newVersion,
    rule: { ...updatedRule },
    createdAt: now,
    createdBy: updatedBy,
    changeDescription: 'Policy update',
  });
  policyVersionHistory.set(policyId, history);

  return updatedRule;
}

/**
 * Delete (deactivate) a policy rule
 */
export function deletePolicyRule(policyId: string): boolean {
  initializeDefaultPolicies();

  const rule = policyStore.get(policyId);
  if (!rule) {
    return false;
  }

  rule.status = 'inactive';
  rule.updatedAt = new Date().toISOString();
  policyStore.set(policyId, rule);

  return true;
}

/**
 * Get version history for a policy
 */
export function getPolicyVersionHistory(policyId: string): PolicyVersion[] {
  initializeDefaultPolicies();
  return policyVersionHistory.get(policyId) || [];
}

/**
 * Check if a transaction violates a specific policy rule
 */
function checkPolicyViolation(
  request: PolicyEvaluateRequest,
  policy: PolicyRule
): PolicyViolation | null {
  const { transaction, context } = request;
  const conditions = policy.conditions;

  // Check transaction limits
  if (conditions.maxAmount !== undefined && transaction.amount > conditions.maxAmount) {
    return {
      ruleId: policy.id,
      ruleName: policy.name,
      ruleType: policy.type,
      severity: policy.action === 'block' ? 'critical' : 'high',
      code: 'TRANSACTION_LIMIT_EXCEEDED',
      message: `Transaction amount ${transaction.amount} exceeds maximum ${conditions.maxAmount}`,
      details: { maxAmount: conditions.maxAmount, actualAmount: transaction.amount },
    };
  }

  if (conditions.minAmount !== undefined && transaction.amount < conditions.minAmount) {
    return {
      ruleId: policy.id,
      ruleName: policy.name,
      ruleType: policy.type,
      severity: policy.action === 'block' ? 'critical' : 'high',
      code: 'TRANSACTION_MINIMUM_NOT_MET',
      message: `Transaction amount ${transaction.amount} is below minimum ${conditions.minAmount}`,
      details: { minAmount: conditions.minAmount, actualAmount: transaction.amount },
    };
  }

  if (conditions.currency && transaction.currency !== conditions.currency) {
    return {
      ruleId: policy.id,
      ruleName: policy.name,
      ruleType: policy.type,
      severity: 'medium',
      code: 'CURRENCY_RESTRICTION',
      message: `Currency ${transaction.currency} is not allowed`,
      details: { allowedCurrency: conditions.currency, actualCurrency: transaction.currency },
    };
  }

  // Check geography restrictions
  const senderCountry = transaction.sender.jurisdiction?.toUpperCase();
  const recipientCountry = transaction.recipient.jurisdiction?.toUpperCase();

  if (conditions.blockedCountries && senderCountry) {
    if (conditions.blockedCountries.includes(senderCountry)) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'critical',
        code: 'BLOCKED_SENDER_JURISDICTION',
        message: `Sender jurisdiction ${senderCountry} is blocked`,
        details: { jurisdiction: senderCountry },
      };
    }
  }

  if (conditions.blockedCountries && recipientCountry) {
    if (conditions.blockedCountries.includes(recipientCountry)) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'critical',
        code: 'BLOCKED_RECIPIENT_JURISDICTION',
        message: `Recipient jurisdiction ${recipientCountry} is blocked`,
        details: { jurisdiction: recipientCountry },
      };
    }
  }

  if (conditions.allowedCountries && senderCountry) {
    if (!conditions.allowedCountries.includes(senderCountry)) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'high',
        code: 'SENDER_JURISDICTION_NOT_ALLOWED',
        message: `Sender jurisdiction ${senderCountry} is not in allowed list`,
        details: { jurisdiction: senderCountry, allowedCountries: conditions.allowedCountries },
      };
    }
  }

  if (conditions.allowedCountries && recipientCountry) {
    if (!conditions.allowedCountries.includes(recipientCountry)) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'high',
        code: 'RECIPIENT_JURISDICTION_NOT_ALLOWED',
        message: `Recipient jurisdiction ${recipientCountry} is not in allowed list`,
        details: { jurisdiction: recipientCountry, allowedCountries: conditions.allowedCountries },
      };
    }
  }

  // Check counterparty restrictions
  if (conditions.blockedCounterparties) {
    if (conditions.blockedCounterparties.includes(transaction.sender.id)) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'critical',
        code: 'BLOCKED_SENDER',
        message: `Sender ${transaction.sender.id} is blocked`,
        details: { senderId: transaction.sender.id },
      };
    }
    if (conditions.blockedCounterparties.includes(transaction.recipient.id)) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'critical',
        code: 'BLOCKED_RECIPIENT',
        message: `Recipient ${transaction.recipient.id} is blocked`,
        details: { recipientId: transaction.recipient.id },
      };
    }
  }

  if (conditions.allowedCounterpartyTypes) {
    if (!conditions.allowedCounterpartyTypes.includes(transaction.sender.type)) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'high',
        code: 'SENDER_TYPE_NOT_ALLOWED',
        message: `Sender type ${transaction.sender.type} is not allowed`,
        details: { senderType: transaction.sender.type, allowedTypes: conditions.allowedCounterpartyTypes },
      };
    }
    if (!conditions.allowedCounterpartyTypes.includes(transaction.recipient.type)) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'high',
        code: 'RECIPIENT_TYPE_NOT_ALLOWED',
        message: `Recipient type ${transaction.recipient.type} is not allowed`,
        details: { recipientType: transaction.recipient.type, allowedTypes: conditions.allowedCounterpartyTypes },
      };
    }
  }

  // Check velocity limits
  if (context) {
    if (conditions.maxTransactionsPerDay !== undefined && 
        context.senderTransactionCountDay !== undefined &&
        context.senderTransactionCountDay >= conditions.maxTransactionsPerDay) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'high',
        code: 'DAILY_TRANSACTION_LIMIT_EXCEEDED',
        message: `Daily transaction limit of ${conditions.maxTransactionsPerDay} exceeded`,
        details: { limit: conditions.maxTransactionsPerDay, current: context.senderTransactionCountDay },
      };
    }

    if (conditions.maxTransactionsPerHour !== undefined && 
        context.senderTransactionCountHour !== undefined &&
        context.senderTransactionCountHour >= conditions.maxTransactionsPerHour) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'high',
        code: 'HOURLY_TRANSACTION_LIMIT_EXCEEDED',
        message: `Hourly transaction limit of ${conditions.maxTransactionsPerHour} exceeded`,
        details: { limit: conditions.maxTransactionsPerHour, current: context.senderTransactionCountHour },
      };
    }

    if (conditions.maxAmountPerDay !== undefined && 
        context.senderAmountDay !== undefined &&
        context.senderAmountDay + transaction.amount > conditions.maxAmountPerDay) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'high',
        code: 'DAILY_AMOUNT_LIMIT_EXCEEDED',
        message: `Daily amount limit of ${conditions.maxAmountPerDay} would be exceeded`,
        details: { limit: conditions.maxAmountPerDay, current: context.senderAmountDay, proposed: transaction.amount },
      };
    }

    if (conditions.maxAmountPerHour !== undefined && 
        context.senderAmountHour !== undefined &&
        context.senderAmountHour + transaction.amount > conditions.maxAmountPerHour) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'high',
        code: 'HOURLY_AMOUNT_LIMIT_EXCEEDED',
        message: `Hourly amount limit of ${conditions.maxAmountPerHour} would be exceeded`,
        details: { limit: conditions.maxAmountPerHour, current: context.senderAmountHour, proposed: transaction.amount },
      };
    }
  }

  // Check time window restrictions
  if (conditions.allowedDaysOfWeek || conditions.allowedHoursStart !== undefined || conditions.allowedHoursEnd !== undefined) {
    const txTimestamp = transaction.timestamp ? new Date(transaction.timestamp) : new Date();
    const timezone = conditions.timezone || 'UTC';
    
    // Get day of week and hour in the specified timezone
    // For simplicity, using local time - in production use proper timezone handling
    const dayOfWeek = txTimestamp.getDay();
    const hour = txTimestamp.getHours();

    if (conditions.allowedDaysOfWeek && !conditions.allowedDaysOfWeek.includes(dayOfWeek)) {
      return {
        ruleId: policy.id,
        ruleName: policy.name,
        ruleType: policy.type,
        severity: 'medium',
        code: 'TRANSACTION_DAY_NOT_ALLOWED',
        message: `Transactions not allowed on day ${dayOfWeek}`,
        details: { dayOfWeek, allowedDays: conditions.allowedDaysOfWeek },
      };
    }

    if (conditions.allowedHoursStart !== undefined && conditions.allowedHoursEnd !== undefined) {
      if (hour < conditions.allowedHoursStart || hour > conditions.allowedHoursEnd) {
        return {
          ruleId: policy.id,
          ruleName: policy.name,
          ruleType: policy.type,
          severity: 'medium',
          code: 'TRANSACTION_TIME_NOT_ALLOWED',
          message: `Transactions not allowed at hour ${hour}`,
          details: { hour, allowedHoursStart: conditions.allowedHoursStart, allowedHoursEnd: conditions.allowedHoursEnd },
        };
      }
    }
  }

  // No violation found
  return null;
}

/**
 * Evaluate a transaction against all active policies
 */
export function evaluatePolicies(request: PolicyEvaluateRequest): PolicyEvaluateResult {
  initializeDefaultPolicies();

  const evaluationId = `eval_${uuidv4().replace(/-/g, '')}`;
  const activePolicies = getActivePolicies();
  const violations: PolicyViolation[] = [];
  let rulesMatched = 0;

  // Evaluate each policy in priority order
  for (const policy of activePolicies) {
    const violation = checkPolicyViolation(request, policy);
    
    if (violation) {
      violations.push(violation);
      rulesMatched++;

      // If this is a block action, we can stop early for efficiency
      // but continue evaluating to collect all violations for reporting
      if (policy.action === 'block' && policy.priority >= 100) {
        // High-priority block rules stop evaluation
        break;
      }
    }
  }

  // Determine overall decision and final action
  const hasCriticalViolation = violations.some(v => v.severity === 'critical');
  const hasBlockAction = activePolicies.some(p => 
    violations.some(v => v.ruleId === p.id) && p.action === 'block'
  );

  let overallDecision: 'pass' | 'fail' = 'pass';
  let finalAction: PolicyAction = 'allow';

  if (hasBlockAction || hasCriticalViolation) {
    overallDecision = 'fail';
    finalAction = 'block';
  } else if (violations.length > 0) {
    // Check the highest priority matched rule's action
    const matchedPolicyIds = violations.map(v => v.ruleId);
    const matchedPolicies = activePolicies.filter(p => matchedPolicyIds.includes(p.id));
    
    if (matchedPolicies.length > 0) {
      // Sort by priority and take the highest
      matchedPolicies.sort((a, b) => b.priority - a.priority);
      finalAction = matchedPolicies[0].action;
      if (finalAction !== 'allow') {
        overallDecision = 'fail';
      }
    }
  }

  return {
    evaluationId,
    transactionId: request.transaction.transactionId,
    overallDecision,
    finalAction,
    violations,
    rulesEvaluated: activePolicies.length,
    rulesMatched,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Transform evaluation result to API response format
 */
export function transformEvaluateResultToResponse(result: PolicyEvaluateResult): PolicyEvaluateResponse {
  const criticalViolations = result.violations.filter(v => v.severity === 'critical').length;

  return {
    evaluationId: result.evaluationId,
    decision: result.overallDecision,
    action: result.finalAction,
    violations: result.violations,
    summary: {
      rulesEvaluated: result.rulesEvaluated,
      rulesMatched: result.rulesMatched,
      violationCount: result.violations.length,
      criticalViolations,
    },
    evaluatedAt: result.evaluatedAt,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };
}
