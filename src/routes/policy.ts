import { Router } from 'express';
import {
  validateCreatePolicyRequest,
  validateEvaluateRequest,
  createPolicyRule,
  evaluatePolicies,
  transformEvaluateResultToResponse,
  getActivePolicies,
  getPolicyById,
  getAllPolicies,
  updatePolicyRule,
  deletePolicyRule,
  getPolicyVersionHistory,
} from '../services/policyService';

const router = Router();

/**
 * POST /policy/rules
 * Create a new policy rule for payment policies
 * 
 * Creates configurable policy rules including:
 * - Transaction limits (min/max amounts)
 * - Geography restrictions (allowed/blocked countries)
 * - Counterparty restrictions (blocked/allowed entities)
 * - Velocity limits (transactions/amount per time window)
 * - Time window restrictions (allowed days/hours)
 * 
 * Request body:
 * {
 *   name: string,
 *   description?: string,
 *   type: 'transaction_limit' | 'geo_restriction' | 'counterparty_restriction' | 'velocity_limit' | 'time_window',
 *   priority?: number (default: 10),
 *   action: 'allow' | 'block' | 'flag' | 'review',
 *   conditions: {
 *     // Transaction limits
 *     maxAmount?: number,
 *     minAmount?: number,
 *     currency?: string,
 *     
 *     // Geography
 *     allowedCountries?: string[], // ISO codes
 *     blockedCountries?: string[],
 *     
 *     // Counterparty
 *     allowedCounterparties?: string[],
 *     blockedCounterparties?: string[],
 *     allowedCounterpartyTypes?: string[],
 *     
 *     // Velocity
 *     maxTransactionsPerDay?: number,
 *     maxTransactionsPerHour?: number,
 *     maxAmountPerDay?: number,
 *     maxAmountPerHour?: number,
 *     
 *     // Time window
 *     allowedDaysOfWeek?: number[], // 0-6
 *     allowedHoursStart?: number, // 0-23
 *     allowedHoursEnd?: number,
 *     timezone?: string
 *   },
 *   effectiveFrom?: string (ISO 8601),
 *   effectiveUntil?: string (ISO 8601)
 * }
 * 
 * Response:
 * {
 *   policyId: string,
 *   version: number,
 *   name: string,
 *   type: PolicyRuleType,
 *   status: PolicyRuleStatus,
 *   action: PolicyAction,
 *   conditions: PolicyCondition,
 *   createdAt: string,
 *   effectiveFrom?: string,
 *   effectiveUntil?: string
 * }
 */
router.post('/rules', async (req, res) => {
  try {
    // Validate request body
    if (!validateCreatePolicyRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request must include valid policy rule details with name, type, action, and conditions',
      });
    }

    // Create the policy rule
    const response = createPolicyRule(req.body, 'api');

    return res.status(201).json(response);
  } catch (error) {
    console.error('Error creating policy rule:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create policy rule',
    });
  }
});

/**
 * GET /policy/rules
 * List all policy rules
 * 
 * Query params:
 * - status: 'active' | 'inactive' | 'draft' (optional filter)
 */
router.get('/rules', (req, res) => {
  try {
    const { status } = req.query;
    
    const validStatus = status && ['active', 'inactive', 'draft'].includes(status as string)
      ? (status as 'active' | 'inactive' | 'draft')
      : undefined;

    const policies = getAllPolicies(validStatus);

    return res.status(200).json({
      policies: policies.map(p => ({
        policyId: p.id,
        version: p.version,
        name: p.name,
        description: p.description,
        type: p.type,
        status: p.status,
        priority: p.priority,
        action: p.action,
        conditions: p.conditions,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        effectiveFrom: p.effectiveFrom,
        effectiveUntil: p.effectiveUntil,
      })),
      total: policies.length,
    });
  } catch (error) {
    console.error('Error listing policy rules:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list policy rules',
    });
  }
});

/**
 * GET /policy/rules/:id
 * Get a specific policy rule by ID
 */
router.get('/rules/:id', (req, res) => {
  try {
    const policy = getPolicyById(req.params.id);

    if (!policy) {
      return res.status(404).json({
        error: 'Policy not found',
        message: `No policy rule found with ID: ${req.params.id}`,
      });
    }

    return res.status(200).json({
      policyId: policy.id,
      version: policy.version,
      name: policy.name,
      description: policy.description,
      type: policy.type,
      status: policy.status,
      priority: policy.priority,
      action: policy.action,
      conditions: policy.conditions,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
      createdBy: policy.createdBy,
      effectiveFrom: policy.effectiveFrom,
      effectiveUntil: policy.effectiveUntil,
    });
  } catch (error) {
    console.error('Error getting policy rule:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve policy rule',
    });
  }
});

/**
 * PATCH /policy/rules/:id
 * Update a policy rule (creates new version)
 */
router.patch('/rules/:id', async (req, res) => {
  try {
    const policy = updatePolicyRule(req.params.id, req.body, 'api');

    if (!policy) {
      return res.status(404).json({
        error: 'Policy not found',
        message: `No policy rule found with ID: ${req.params.id}`,
      });
    }

    return res.status(200).json({
      policyId: policy.id,
      version: policy.version,
      name: policy.name,
      description: policy.description,
      type: policy.type,
      status: policy.status,
      priority: policy.priority,
      action: policy.action,
      conditions: policy.conditions,
      updatedAt: policy.updatedAt,
      effectiveUntil: policy.effectiveUntil,
    });
  } catch (error) {
    console.error('Error updating policy rule:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update policy rule',
    });
  }
});

/**
 * DELETE /policy/rules/:id
 * Deactivate a policy rule
 */
router.delete('/rules/:id', (req, res) => {
  try {
    const success = deletePolicyRule(req.params.id);

    if (!success) {
      return res.status(404).json({
        error: 'Policy not found',
        message: `No policy rule found with ID: ${req.params.id}`,
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting policy rule:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete policy rule',
    });
  }
});

/**
 * GET /policy/rules/:id/versions
 * Get version history for a policy rule
 */
router.get('/rules/:id/versions', (req, res) => {
  try {
    const history = getPolicyVersionHistory(req.params.id);

    if (history.length === 0) {
      return res.status(404).json({
        error: 'Policy not found',
        message: `No policy rule found with ID: ${req.params.id}`,
      });
    }

    return res.status(200).json({
      policyId: req.params.id,
      versions: history.map(v => ({
        version: v.version,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        changeDescription: v.changeDescription,
      })),
      totalVersions: history.length,
    });
  } catch (error) {
    console.error('Error getting policy version history:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve policy version history',
    });
  }
});

/**
 * GET /policy/evaluate
 * Evaluate a proposed transaction against all active policy rules
 * 
 * Real-time policy evaluation for pre-payment checks.
 * Fast response for payment flow integration.
 * 
 * Request body:
 * {
 *   transaction: {
 *     transactionId?: string,
 *     amount: number,
 *     currency: string,
 *     sender: {
 *       id: string,
 *       type: 'agent' | 'wallet' | 'address' | 'individual' | 'business',
 *       jurisdiction?: string,
 *       address?: string
 *     },
 *     recipient: {
 *       id: string,
 *       type: 'agent' | 'wallet' | 'address' | 'individual' | 'business',
 *       jurisdiction?: string,
 *       address?: string
 *     },
 *     timestamp?: string (ISO 8601),
 *     metadata?: Record<string, unknown>
 *   },
 *   context?: {
 *     senderTransactionCountDay?: number,
 *     senderTransactionCountHour?: number,
 *     senderAmountDay?: number,
 *     senderAmountHour?: number
 *   }
 * }
 * 
 * Response:
 * {
 *   evaluationId: string,
 *   decision: 'pass' | 'fail',
 *   action: 'allow' | 'block' | 'flag' | 'review',
 *   violations: PolicyViolation[],
 *   summary: {
 *     rulesEvaluated: number,
 *     rulesMatched: number,
 *     violationCount: number,
 *     criticalViolations: number
 *   },
 *   evaluatedAt: string,
 *   expiresAt: string
 * }
 */
router.get('/evaluate', async (req, res) => {
  try {
    // Validate request body
    if (!validateEvaluateRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request must include valid transaction details with amount, currency, sender, and recipient',
      });
    }

    // Perform policy evaluation
    const result = evaluatePolicies(req.body);
    const response = transformEvaluateResultToResponse(result);

    // Return appropriate status code based on decision
    if (result.finalAction === 'block') {
      return res.status(403).json({
        error: 'Transaction blocked by policy',
        ...response,
      });
    }

    if (result.finalAction === 'review' || result.finalAction === 'flag') {
      return res.status(200).json({
        warning: 'Transaction flagged for review',
        ...response,
      });
    }

    // Return 200 OK for passed evaluation
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error evaluating transaction against policies:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to evaluate transaction against policies',
    });
  }
});

/**
 * POST /policy/evaluate
 * Alternative POST method for policy evaluation
 * (Some clients prefer POST for complex request bodies)
 */
router.post('/evaluate', async (req, res) => {
  try {
    // Validate request body
    if (!validateEvaluateRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request must include valid transaction details with amount, currency, sender, and recipient',
      });
    }

    // Perform policy evaluation
    const result = evaluatePolicies(req.body);
    const response = transformEvaluateResultToResponse(result);

    // Return appropriate status code based on decision
    if (result.finalAction === 'block') {
      return res.status(403).json({
        error: 'Transaction blocked by policy',
        ...response,
      });
    }

    if (result.finalAction === 'review' || result.finalAction === 'flag') {
      return res.status(200).json({
        warning: 'Transaction flagged for review',
        ...response,
      });
    }

    // Return 200 OK for passed evaluation
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error evaluating transaction against policies:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to evaluate transaction against policies',
    });
  }
});

/**
 * GET /policy/active
 * Get all currently active policies (for quick reference)
 */
router.get('/active', (req, res) => {
  try {
    const activePolicies = getActivePolicies();

    return res.status(200).json({
      policies: activePolicies.map(p => ({
        policyId: p.id,
        name: p.name,
        type: p.type,
        priority: p.priority,
        action: p.action,
      })),
      total: activePolicies.length,
    });
  } catch (error) {
    console.error('Error getting active policies:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve active policies',
    });
  }
});

export { router as policyRoutes };
