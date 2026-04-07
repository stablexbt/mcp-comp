import { Router } from 'express';
import {
  validateKytScreeningRequest,
  performKytScreening,
  transformToResponse,
  getScreeningById,
  getScreeningAuditLog,
  validateTravelRuleRequest,
  processTravelRule,
  transformTravelRuleToResponse,
  getTravelRuleById,
  getTravelRuleRecords,
} from '../services/complianceService';

const router = Router();

/**
 * POST /compliance/kyt
 * Perform Know Your Transaction (KYT) screening
 * 
 * Accepts transaction details and performs comprehensive risk screening:
 * - Sanctions list checks (OFAC, EU, UN)
 * - Watchlist screening (PEP, adverse media)
 * - Geography risk assessment
 * - Amount-based risk scoring
 * 
 * Request body:
 * {
 *   transaction: {
 *     amount: number,
 *     currency: string,
 *     sender: { id: string, type: string, jurisdiction?: string },
 *     recipient: { id: string, type: string, jurisdiction?: string }
 *   },
 *   screeningOptions?: {
 *     checkSanctions?: boolean,
 *     checkWatchlists?: boolean,
 *     checkGeography?: boolean,
 *     checkAmount?: boolean
 *   }
 * }
 */
router.post('/kyt', async (req, res) => {
  try {
    // Validate request body
    if (!validateKytScreeningRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request must include valid transaction details with amount, currency, sender, and recipient',
      });
    }

    // Perform KYT screening
    const screeningResult = await performKytScreening(req.body);

    // Transform to response format
    const response = transformToResponse(screeningResult);

    // Return appropriate status code
    if (screeningResult.status === 'blocked') {
      return res.status(403).json({
        error: 'Transaction blocked',
        ...response,
      });
    }

    if (screeningResult.status === 'flagged') {
      return res.status(200).json({
        warning: 'Transaction flagged for review',
        ...response,
      });
    }

    // Return 200 OK for passed screening
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error performing KYT screening:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to perform KYT screening',
    });
  }
});

/**
 * GET /compliance/kyt/:id
 * Get screening details by ID
 * Useful for audit trail and compliance reporting
 */
router.get('/kyt/:id', (req, res) => {
  try {
    const screening = getScreeningById(req.params.id);

    if (!screening) {
      return res.status(404).json({
        error: 'Screening not found',
        message: `No screening found with ID: ${req.params.id}`,
      });
    }

    return res.status(200).json(transformToResponse(screening));
  } catch (error) {
    console.error('Error getting KYT screening:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve screening details',
    });
  }
});

/**
 * GET /compliance/kyt/audit/log
 * Get screening audit log for compliance reporting
 * Query params: startDate, endDate (ISO 8601 format)
 */
router.get('/kyt/audit/log', (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const logs = getScreeningAuditLog(
      typeof startDate === 'string' ? startDate : undefined,
      typeof endDate === 'string' ? endDate : undefined
    );

    return res.status(200).json({
      screenings: logs.map(transformToResponse),
      total: logs.length,
      query: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('Error getting KYT audit log:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve audit log',
    });
  }
});

/**
 * POST /compliance/travel-rule
 * Process Travel Rule compliance for cross-border crypto transfers (IVMS 101)
 * 
 * Implements FATF Travel Rule requirements:
 * - Collects originator and beneficiary information
 * - Exchanges data with counterparty VASP
 * - Validates required fields per FATF guidelines
 * - Stores travel rule record for compliance audit
 * 
 * Request body (IVMS 101 format):
 * {
 *   transaction: {
 *     txId: string,
 *     transactionType: string,
 *     dateTime: string (ISO 8601),
 *     amount: number,
 *     currency: string,
 *     originator: {
 *       originatorPersons: [...],
 *       accountNumber?: string[]
 *     },
 *     beneficiary: {
 *       beneficiaryPersons: [...],
 *       accountNumber?: string[]
 *     },
 *     originatingVasp: { legalPerson: {...} },
 *     beneficiaryVasp: { legalPerson: {...} }
 *   },
 *   callbackUrl?: string
 * }
 */
router.post('/travel-rule', async (req, res) => {
  try {
    // Validate request body
    if (!validateTravelRuleRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Request must include valid IVMS 101 transaction data with originator, beneficiary, and VASP information',
      });
    }

    // Process travel rule compliance
    const result = await processTravelRule(req.body);

    // Transform to response format
    const response = transformTravelRuleToResponse(result);

    // Return appropriate status code based on result
    if (result.status === 'rejected') {
      return res.status(422).json({
        error: 'Travel rule compliance rejected',
        ...response,
      });
    }

    if (result.status === 'error') {
      return res.status(502).json({
        error: 'Travel rule processing error',
        ...response,
      });
    }

    // Return 200 OK for accepted or pending
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error processing travel rule:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process travel rule compliance',
    });
  }
});

/**
 * GET /compliance/travel-rule/:id
 * Get travel rule record by ID
 * Useful for compliance verification and audit trail
 */
router.get('/travel-rule/:id', (req, res) => {
  try {
    const record = getTravelRuleById(req.params.id);

    if (!record) {
      return res.status(404).json({
        error: 'Travel rule record not found',
        message: `No travel rule record found with ID: ${req.params.id}`,
      });
    }

    return res.status(200).json(transformTravelRuleToResponse(record));
  } catch (error) {
    console.error('Error getting travel rule record:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve travel rule record',
    });
  }
});

/**
 * GET /compliance/travel-rule/audit/records
 * Get travel rule audit records for compliance reporting
 * Query params: status, startDate, endDate (ISO 8601 format)
 */
router.get('/travel-rule/audit/records', (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;

    const records = getTravelRuleRecords(
      typeof status === 'string' ? (status as 'pending' | 'accepted' | 'rejected' | 'error') : undefined,
      typeof startDate === 'string' ? startDate : undefined,
      typeof endDate === 'string' ? endDate : undefined
    );

    return res.status(200).json({
      travelRules: records.map(transformTravelRuleToResponse),
      total: records.length,
      query: {
        status: status || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('Error getting travel rule audit records:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve travel rule audit records',
    });
  }
});

export { router as complianceRoutes };
