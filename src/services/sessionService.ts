import { v4 as uuidv4 } from 'uuid';
import {
  PaymentSession,
  CreateSessionRequest,
  CreateSessionResponse,
  UpdateSessionRequest,
  SessionStatus,
  SessionPaymentRequest,
  PaymentResponse,
} from '../types/agent';
import { SessionStore } from '../store/sessionStore';
import { AgentStore } from '../store/agentStore';
import { processPayment, validatePaymentRequest } from './paymentService';

export function generateSessionId(): string {
  return `sess_${uuidv4().replace(/-/g, '')}`;
}

/**
 * Validate create session request body
 */
export function validateCreateSessionRequest(
  body: unknown
): body is CreateSessionRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as CreateSessionRequest;

  // Validate agentId
  if (typeof req.agentId !== 'string' || req.agentId.trim() === '') {
    return false;
  }

  // Validate budget
  if (!req.budget || typeof req.budget !== 'object') {
    return false;
  }
  if (
    typeof req.budget.amount !== 'number' ||
    req.budget.amount <= 0
  ) {
    return false;
  }
  if (
    typeof req.budget.currency !== 'string' ||
    req.budget.currency.trim() === ''
  ) {
    return false;
  }

  // Validate duration
  if (
    typeof req.durationMinutes !== 'number' ||
    req.durationMinutes <= 0 ||
    req.durationMinutes > 1440 // Max 24 hours
  ) {
    return false;
  }

  // Validate MPP config if provided
  if (req.mppConfig) {
    if (typeof req.mppConfig !== 'object') {
      return false;
    }
    if (
      typeof req.mppConfig.maxParties !== 'number' ||
      req.mppConfig.maxParties < 2
    ) {
      return false;
    }
    if (!Array.isArray(req.mppConfig.parties)) {
      return false;
    }
    if (
      typeof req.mppConfig.threshold !== 'number' ||
      req.mppConfig.threshold < 1
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Validate update session request body
 */
export function validateUpdateSessionRequest(
  body: unknown
): body is UpdateSessionRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as UpdateSessionRequest;

  // At least one field must be present
  if (
    !req.status &&
    !req.budget &&
    !req.mppConfig
  ) {
    return false;
  }

  // Validate status if provided
  if (req.status && !['active', 'paused', 'closed'].includes(req.status)) {
    return false;
  }

  // Validate budget if provided
  if (req.budget) {
    if (
      typeof req.budget.amount !== 'number' ||
      req.budget.amount <= 0
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Validate session payment request
 */
export function validateSessionPaymentRequest(
  body: unknown
): body is SessionPaymentRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as SessionPaymentRequest;

  // Validate sessionId
  if (
    typeof req.sessionId !== 'string' ||
    req.sessionId.trim() === ''
  ) {
    return false;
  }

  // Validate amount
  if (typeof req.amount !== 'number' || req.amount <= 0) {
    return false;
  }

  // Validate recipient
  if (!req.recipient || typeof req.recipient !== 'object') {
    return false;
  }
  if (
    typeof req.recipient.id !== 'string' ||
    req.recipient.id.trim() === ''
  ) {
    return false;
  }
  if (!['agent', 'wallet', 'address'].includes(req.recipient.type)) {
    return false;
  }

  return true;
}

/**
 * Check if session has expired and update status if needed
 */
export function checkSessionExpiry(session: PaymentSession): boolean {
  if (session.status === 'closed' || session.status === 'expired') {
    return true;
  }

  if (new Date() > session.duration.expiresAt) {
    SessionStore.updateStatus(session.id, 'expired');
    return true;
  }

  return false;
}

/**
 * Create a new payment session
 */
export function createSession(
  request: CreateSessionRequest
): CreateSessionResponse {
  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + request.durationMinutes * 60 * 1000
  );

  const session: PaymentSession = {
    id: sessionId,
    agentId: request.agentId,
    budget: {
      amount: request.budget.amount,
      currency: request.budget.currency,
      spent: 0,
    },
    duration: {
      createdAt: now,
      expiresAt,
    },
    status: 'active',
    payments: [],
    mppConfig: request.mppConfig,
    metadata: request.metadata,
    updatedAt: now,
  };

  SessionStore.create(session);

  return {
    sessionId,
    agentId: request.agentId,
    budget: {
      amount: request.budget.amount,
      currency: request.budget.currency,
      spent: 0,
      remaining: request.budget.amount,
    },
    status: 'active',
    expiresAt: expiresAt.toISOString(),
    mppConfig: request.mppConfig,
    createdAt: now.toISOString(),
  };
}

/**
 * Get session details
 */
export function getSession(
  sessionId: string
): CreateSessionResponse | null {
  const session = SessionStore.get(sessionId);
  if (!session) {
    return null;
  }

  // Check for expiry
  checkSessionExpiry(session);

  return {
    sessionId: session.id,
    agentId: session.agentId,
    budget: {
      amount: session.budget.amount,
      currency: session.budget.currency,
      spent: session.budget.spent,
      remaining: session.budget.amount - session.budget.spent,
    },
    status: session.status,
    expiresAt: session.duration.expiresAt.toISOString(),
    mppConfig: session.mppConfig,
    createdAt: session.duration.createdAt.toISOString(),
  };
}

/**
 * Update session
 */
export function updateSession(
  sessionId: string,
  request: UpdateSessionRequest
): CreateSessionResponse | null {
  const session = SessionStore.get(sessionId);
  if (!session) {
    return null;
  }

  // Check for expiry
  if (checkSessionExpiry(session)) {
    return null;
  }

  const updates: Partial<PaymentSession> = {};

  if (request.status) {
    updates.status = request.status;
  }

  if (request.budget) {
    updates.budget = {
      ...session.budget,
      amount: request.budget.amount,
    };
  }

  if (request.mppConfig) {
    updates.mppConfig = {
      ...session.mppConfig,
      maxParties: session.mppConfig?.maxParties || 2,
      parties: request.mppConfig.parties || session.mppConfig?.parties || [],
      threshold:
        request.mppConfig.threshold || session.mppConfig?.threshold || 1,
    };
  }

  const updated = SessionStore.update(sessionId, updates);
  if (!updated) {
    return null;
  }

  return getSession(sessionId);
}

/**
 * Process a payment within a session
 */
export async function processSessionPayment(
  request: SessionPaymentRequest
): Promise<PaymentResponse & { sessionStatus: SessionStatus }> {
  const session = SessionStore.get(request.sessionId);
  if (!session) {
    return {
      transactionId: '',
      status: 'rejected',
      amount: request.amount,
      currency: 'USD',
      recipient: request.recipient,
      kytPassed: false,
      policyPassed: false,
      rejectionReason: 'Session not found',
      createdAt: new Date().toISOString(),
      sessionStatus: 'closed',
    };
  }

  // Check for expiry
  if (checkSessionExpiry(session)) {
    return {
      transactionId: '',
      status: 'rejected',
      amount: request.amount,
      currency: session.budget.currency,
      recipient: request.recipient,
      kytPassed: false,
      policyPassed: false,
      rejectionReason: 'Session has expired',
      createdAt: new Date().toISOString(),
      sessionStatus: session.status,
    };
  }

  // Check session is active
  if (session.status !== 'active') {
    return {
      transactionId: '',
      status: 'rejected',
      amount: request.amount,
      currency: session.budget.currency,
      recipient: request.recipient,
      kytPassed: false,
      policyPassed: false,
      rejectionReason: `Session is ${session.status}`,
      createdAt: new Date().toISOString(),
      sessionStatus: session.status,
    };
  }

  // Check budget
  const remainingBudget = session.budget.amount - session.budget.spent;
  if (request.amount > remainingBudget) {
    return {
      transactionId: '',
      status: 'rejected',
      amount: request.amount,
      currency: session.budget.currency,
      recipient: request.recipient,
      kytPassed: false,
      policyPassed: false,
      rejectionReason: 'Amount exceeds session budget',
      createdAt: new Date().toISOString(),
      sessionStatus: session.status,
    };
  }

  // Process the payment using the standard payment flow
  const paymentRequest = {
    agentId: session.agentId,
    amount: request.amount,
    currency: session.budget.currency,
    recipient: request.recipient,
    memo: request.memo,
  };

  const paymentResult = await processPayment(paymentRequest);

  // If payment succeeded, update session spent amount
  if (paymentResult.status === 'completed') {
    SessionStore.update(session.id, {
      budget: {
        ...session.budget,
        spent: session.budget.spent + request.amount,
      },
    });
    SessionStore.addPayment(session.id, paymentResult.transactionId);
  }

  return {
    ...paymentResult,
    sessionStatus: session.status,
  };
}
