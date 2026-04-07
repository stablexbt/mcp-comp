import { v4 as uuidv4 } from 'uuid';
import {
  PaymentRequest,
  PaymentResponse,
  Transaction,
  PaymentStatus,
  KytScreeningResult,
  PolicyCheckResult,
  KytRiskLevel,
  Agent,
} from '../types/agent';
import { TransactionStore } from '../store/transactionStore';
import { AgentStore } from '../store/agentStore';

export function generateTransactionId(): string {
  return `tx_${uuidv4().replace(/-/g, '')}`;
}

/**
 * Validate payment request body
 */
export function validatePaymentRequest(body: unknown): body is PaymentRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as PaymentRequest;

  // Validate agentId
  if (typeof req.agentId !== 'string' || req.agentId.trim() === '') {
    return false;
  }

  // Validate amount
  if (typeof req.amount !== 'number' || req.amount <= 0) {
    return false;
  }

  // Validate currency
  if (typeof req.currency !== 'string' || req.currency.trim() === '') {
    return false;
  }

  // Validate recipient
  if (!req.recipient || typeof req.recipient !== 'object') {
    return false;
  }
  if (typeof req.recipient.id !== 'string' || req.recipient.id.trim() === '') {
    return false;
  }
  if (!['agent', 'wallet', 'address'].includes(req.recipient.type)) {
    return false;
  }

  return true;
}

/**
 * Perform KYT (Know Your Transaction) screening
 * Analyzes transaction for risk factors
 */
export async function performKytScreening(
  request: PaymentRequest,
  agent: Agent
): Promise<KytScreeningResult> {
  const flags: string[] = [];
  let riskScore = 0;

  // Check transaction amount against agent's max transaction limit
  if (agent.compliance.maxTransactionAmount) {
    if (request.amount > agent.compliance.maxTransactionAmount) {
      flags.push('Amount exceeds max transaction limit');
      riskScore += 30;
    }
  }

  // Check daily transaction volume (simplified - in production, sum today's transactions)
  if (agent.compliance.dailyTransactionLimit) {
    const todayTransactions = TransactionStore.getByAgentId(agent.id).filter(
      (tx) => {
        const txDate = new Date(tx.createdAt);
        const today = new Date();
        return (
          txDate.getDate() === today.getDate() &&
          txDate.getMonth() === today.getMonth() &&
          txDate.getFullYear() === today.getFullYear()
        );
      }
    );
    const dailyTotal = todayTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    if (dailyTotal + request.amount > agent.compliance.dailyTransactionLimit) {
      flags.push('Amount would exceed daily transaction limit');
      riskScore += 25;
    }
  }

  // Check for high-risk currencies (simplified)
  const highRiskCurrencies = ['XYZ', 'UNKNOWN'];
  if (highRiskCurrencies.includes(request.currency.toUpperCase())) {
    flags.push('High-risk currency detected');
    riskScore += 20;
  }

  // Check for suspicious recipient patterns
  if (request.recipient.type === 'address' && !request.recipient.address) {
    flags.push('Missing recipient address');
    riskScore += 15;
  }

  // Calculate risk level based on score
  let riskLevel: KytRiskLevel = 'low';
  if (riskScore >= 50) {
    riskLevel = 'critical';
  } else if (riskScore >= 30) {
    riskLevel = 'high';
  } else if (riskScore >= 15) {
    riskLevel = 'medium';
  }

  return {
    passed: riskLevel !== 'critical' && riskLevel !== 'high',
    riskLevel,
    riskScore,
    flags,
    checkedAt: new Date(),
  };
}

/**
 * Check payment against agent policy rules
 */
export async function checkPolicyRules(
  request: PaymentRequest,
  agent: Agent
): Promise<PolicyCheckResult> {
  const violations: string[] = [];

  // Check allowed payment methods
  if (
    agent.compliance.allowedPaymentMethods &&
    agent.compliance.allowedPaymentMethods.length > 0
  ) {
    // In a real implementation, we'd check if the payment method is allowed
    // For now, we'll assume the currency represents the payment method
    const normalizedCurrency = request.currency.toUpperCase();
    const isAllowed = agent.compliance.allowedPaymentMethods.some(
      (method) => method.toUpperCase() === normalizedCurrency
    );

    if (!isAllowed) {
      violations.push(`Currency ${request.currency} not in allowed payment methods`);
    }
  }

  // Check geo-restrictions (simplified - would check recipient location)
  if (
    agent.compliance.geoRestrictions &&
    agent.compliance.geoRestrictions.length > 0
  ) {
    // In production, this would check the recipient's jurisdiction
    // For now, we'll pass unless explicitly flagged
  }

  return {
    passed: violations.length === 0,
    violations,
    checkedAt: new Date(),
  };
}

/**
 * Execute x402 payment flow
 * This is a simplified mock implementation
 */
export async function executeX402Payment(
  transaction: Transaction,
  agent: Agent
): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, this would:
    // 1. Generate x402 payment requirements
    // 2. Create payment payload
    // 3. Submit to blockchain/payment network
    // 4. Wait for confirmation
    // 5. Return result

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Mock success (95% success rate for simulation)
    const success = Math.random() > 0.05;

    if (!success) {
      return {
        success: false,
        error: 'Payment network timeout - please retry',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown payment error',
    };
  }
}

/**
 * Process a payment request
 * Main entry point for payment execution
 */
export async function processPayment(
  request: PaymentRequest
): Promise<PaymentResponse> {
  const transactionId = generateTransactionId();
  const now = new Date();

  // Create initial transaction record
  const transaction: Transaction = {
    id: transactionId,
    agentId: request.agentId,
    amount: request.amount,
    currency: request.currency,
    recipient: request.recipient,
    memo: request.memo,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  TransactionStore.create(transaction);

  // Get agent
  const agent = AgentStore.get(request.agentId);
  if (!agent) {
    TransactionStore.updateStatus(transactionId, 'rejected', {
      errorMessage: 'Agent not found',
    });

    return {
      transactionId,
      status: 'rejected',
      amount: request.amount,
      currency: request.currency,
      recipient: request.recipient,
      kytPassed: false,
      policyPassed: false,
      rejectionReason: 'Agent not found',
      createdAt: now.toISOString(),
    };
  }

  // Step 1: KYT Screening
  TransactionStore.updateStatus(transactionId, 'screening');
  const kytResult = await performKytScreening(request, agent);

  TransactionStore.update(transactionId, { kytResult });

  if (!kytResult.passed) {
    TransactionStore.updateStatus(transactionId, 'rejected', {
      errorMessage: `KYT screening failed: ${kytResult.flags.join(', ')}`,
    });

    return {
      transactionId,
      status: 'rejected',
      amount: request.amount,
      currency: request.currency,
      recipient: request.recipient,
      kytPassed: false,
      policyPassed: false,
      rejectionReason: `KYT screening failed: ${kytResult.flags.join(', ')}`,
      createdAt: now.toISOString(),
    };
  }

  // Step 2: Policy Check
  const policyResult = await checkPolicyRules(request, agent);
  TransactionStore.update(transactionId, { policyResult });

  if (!policyResult.passed) {
    TransactionStore.updateStatus(transactionId, 'rejected', {
      errorMessage: `Policy check failed: ${policyResult.violations.join(', ')}`,
    });

    return {
      transactionId,
      status: 'rejected',
      amount: request.amount,
      currency: request.currency,
      recipient: request.recipient,
      kytPassed: true,
      policyPassed: false,
      rejectionReason: `Policy check failed: ${policyResult.violations.join(', ')}`,
      createdAt: now.toISOString(),
    };
  }

  // Step 3: Execute Payment
  TransactionStore.updateStatus(transactionId, 'processing');
  const paymentResult = await executeX402Payment(transaction, agent);

  if (!paymentResult.success) {
    TransactionStore.updateStatus(transactionId, 'failed', {
      errorMessage: paymentResult.error,
    });

    return {
      transactionId,
      status: 'failed',
      amount: request.amount,
      currency: request.currency,
      recipient: request.recipient,
      kytPassed: true,
      policyPassed: true,
      rejectionReason: paymentResult.error,
      createdAt: now.toISOString(),
    };
  }

  // Payment successful
  TransactionStore.updateStatus(transactionId, 'completed');

  return {
    transactionId,
    status: 'completed',
    amount: request.amount,
    currency: request.currency,
    recipient: request.recipient,
    kytPassed: true,
    policyPassed: true,
    createdAt: now.toISOString(),
  };
}
