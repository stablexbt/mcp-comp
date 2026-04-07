import { Router } from 'express';
import { registerAgent, validateRegisterRequest } from '../services/agentService';
import { processPayment, validatePaymentRequest } from '../services/paymentService';
import {
  createSession,
  getSession,
  updateSession,
  processSessionPayment,
  validateCreateSessionRequest,
  validateUpdateSessionRequest,
  validateSessionPaymentRequest,
} from '../services/sessionService';
import {
  validateQueryParams,
  parseQueryParams,
  queryTransactions,
  transformTransactionToResponse,
  convertToCSV,
} from '../services/transactionService';
import { AgentStore } from '../store/agentStore';

const router = Router();

/**
 * POST /agent/register
 * Register a new AI agent with compliance profile
 */
router.post('/register', (req, res) => {
  try {
    // Validate request body
    if (!validateRegisterRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request must include valid metadata (name, type, owner) and compliance profile (riskLevel, geoRestrictions)',
      });
    }

    // Register the agent
    const response = registerAgent(req.body);

    // Return 201 Created with the registration response
    return res.status(201).json(response);
  } catch (error) {
    console.error('Error registering agent:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to register agent',
    });
  }
});

/**
 * GET /agent/:id
 * Get agent details by ID
 */
router.get('/:id', (req, res) => {
  // TODO: Implement in future task
  return res.status(501).json({ error: 'Not implemented' });
});

/**
 * GET /agent/:id/transactions
 * Get agent transactions with filtering, pagination, and compliance status
 */
router.get('/:id/transactions', (req, res) => {
  try {
    const agentId = req.params.id;

    // Verify agent exists
    const agent = AgentStore.get(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `No agent found with ID: ${agentId}`,
      });
    }

    // Validate query parameters
    const validation = validateQueryParams(req.query);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        message: validation.error,
      });
    }

    // Parse query parameters
    const params = parseQueryParams(req.query as Record<string, unknown>);

    // Query transactions
    const result = queryTransactions(agentId, params);

    // Transform to response format
    const transactions = result.transactions.map(transformTransactionToResponse);

    // Handle CSV export
    const format = params.format || 'json';
    if (format === 'csv') {
      const csv = convertToCSV(transactions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions-${agentId}.csv"`);
      return res.status(200).send(csv);
    }

    // Return JSON response
    return res.status(200).json({
      transactions,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.limit < result.total,
      },
    });
  } catch (error) {
    console.error('Error getting agent transactions:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve transactions',
    });
  }
});

/**
 * POST /agent/pay
 * Process a payment with KYT screening and policy checks
 */
router.post('/pay', async (req, res) => {
  try {
    // Validate request body
    if (!validatePaymentRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request must include valid agentId, amount (> 0), currency, and recipient (with id and type)',
      });
    }

    // Process the payment
    const response = await processPayment(req.body);

    // Return appropriate status code based on payment result
    if (response.status === 'rejected') {
      return res.status(422).json({
        error: 'Payment rejected',
        ...response,
      });
    }

    if (response.status === 'failed') {
      return res.status(502).json({
        error: 'Payment processing failed',
        ...response,
      });
    }

    // Return 201 Created for successful payment
    return res.status(201).json(response);
  } catch (error) {
    console.error('Error processing payment:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process payment',
    });
  }
});

/**
 * POST /agent/pay/session
 * Create a payment session for MPP-compatible recurring or batched payments
 */
router.post('/pay/session', (req, res) => {
  try {
    // Validate request body
    if (!validateCreateSessionRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message:
          'Request must include valid agentId, budget (amount > 0, currency), and durationMinutes (1-1440)',
      });
    }

    // Verify agent exists
    const agent = AgentStore.get(req.body.agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `No agent found with ID: ${req.body.agentId}`,
      });
    }

    // Create the session
    const response = createSession(req.body);

    // Return 201 Created with the session response
    return res.status(201).json(response);
  } catch (error) {
    console.error('Error creating payment session:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create payment session',
    });
  }
});

/**
 * GET /agent/pay/session/:id
 * Get payment session details
 */
router.get('/pay/session/:id', (req, res) => {
  try {
    const session = getSession(req.params.id);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `No session found with ID: ${req.params.id}`,
      });
    }

    return res.status(200).json(session);
  } catch (error) {
    console.error('Error getting payment session:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get payment session',
    });
  }
});

/**
 * PATCH /agent/pay/session/:id
 * Update payment session (status, budget, MPP config)
 */
router.patch('/pay/session/:id', (req, res) => {
  try {
    // Validate request body
    if (!validateUpdateSessionRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message:
          'Request must include at least one of: status (active, paused, closed), budget, or mppConfig',
      });
    }

    // Update the session
    const response = updateSession(req.params.id, req.body);

    if (!response) {
      return res.status(404).json({
        error: 'Session not found',
        message: `No session found with ID: ${req.params.id}`,
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error updating payment session:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update payment session',
    });
  }
});

/**
 * POST /agent/pay/session/:id/payment
 * Process a payment within a session
 */
router.post('/pay/session/:id/payment', async (req, res) => {
  try {
    // Build payment request
    const paymentRequest = {
      sessionId: req.params.id,
      amount: req.body.amount,
      recipient: req.body.recipient,
      memo: req.body.memo,
    };

    // Validate request body
    if (!validateSessionPaymentRequest(paymentRequest)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message:
          'Request must include valid amount (> 0) and recipient (with id and type)',
      });
    }

    // Process the payment within the session
    const response = await processSessionPayment(paymentRequest);

    // Return appropriate status code based on payment result
    if (response.status === 'rejected') {
      return res.status(422).json({
        error: 'Payment rejected',
        ...response,
      });
    }

    if (response.status === 'failed') {
      return res.status(502).json({
        error: 'Payment processing failed',
        ...response,
      });
    }

    // Return 201 Created for successful payment
    return res.status(201).json(response);
  } catch (error) {
    console.error('Error processing session payment:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process session payment',
    });
  }
});

export { router as agentRoutes };
