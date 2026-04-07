import { describe, it, expect } from 'vitest';
import {
  validateKytScreeningRequest,
  performKytScreening,
  transformToResponse,
  getScreeningById,
  getScreeningAuditLog,
} from '../src/services/complianceService';
import { KytScreeningRequest } from '../src/types/compliance';

describe('Compliance Service', () => {
  describe('validateKytScreeningRequest', () => {
    it('should validate a correct request', () => {
      const request = {
        transaction: {
          amount: 1000,
          currency: 'USD',
          sender: { id: 'sender_123', type: 'agent' as const },
          recipient: { id: 'recipient_456', type: 'wallet' as const },
        },
      };

      expect(validateKytScreeningRequest(request)).toBe(true);
    });

    it('should reject request without transaction', () => {
      const request = {};
      expect(validateKytScreeningRequest(request)).toBe(false);
    });

    it('should reject request with invalid amount', () => {
      const request = {
        transaction: {
          amount: -100,
          currency: 'USD',
          sender: { id: 'sender_123', type: 'agent' },
          recipient: { id: 'recipient_456', type: 'wallet' },
        },
      };
      expect(validateKytScreeningRequest(request)).toBe(false);
    });

    it('should reject request with missing sender', () => {
      const request = {
        transaction: {
          amount: 1000,
          currency: 'USD',
          recipient: { id: 'recipient_456', type: 'wallet' },
        },
      };
      expect(validateKytScreeningRequest(request)).toBe(false);
    });

    it('should reject request with invalid sender type', () => {
      const request = {
        transaction: {
          amount: 1000,
          currency: 'USD',
          sender: { id: 'sender_123', type: 'invalid' },
          recipient: { id: 'recipient_456', type: 'wallet' },
        },
      };
      expect(validateKytScreeningRequest(request)).toBe(false);
    });
  });

  describe('performKytScreening', () => {
    it('should screen a low-risk transaction', async () => {
      const request: KytScreeningRequest = {
        transaction: {
          amount: 100,
          currency: 'USD',
          sender: { id: 'sender_123', type: 'agent', jurisdiction: 'US' },
          recipient: { id: 'recipient_456', type: 'wallet', jurisdiction: 'GB' },
        },
      };

      const result = await performKytScreening(request);

      expect(result.screeningId).toMatch(/^kyt_/);
      expect(result.status).toBe('passed');
      expect(result.riskScore).toBeLessThan(15);
      expect(result.riskLevel).toBe('low');
      expect(result.flags).toHaveLength(0);
      expect(result.screenedAt).toBeDefined();
    });

    it('should flag high-value transaction', async () => {
      const request: KytScreeningRequest = {
        transaction: {
          amount: 15000,
          currency: 'USD',
          sender: { id: 'sender_123', type: 'agent' },
          recipient: { id: 'recipient_456', type: 'wallet' },
        },
      };

      const result = await performKytScreening(request);

      expect(result.riskScore).toBeGreaterThanOrEqual(20);
      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.flags[0].type).toBe('amount');
    });

    it('should flag prohibited jurisdiction', async () => {
      const request: KytScreeningRequest = {
        transaction: {
          amount: 100,
          currency: 'USD',
          sender: { id: 'sender_123', type: 'agent', jurisdiction: 'KP' },
          recipient: { id: 'recipient_456', type: 'wallet', jurisdiction: 'US' },
        },
      };

      const result = await performKytScreening(request);

      expect(result.status).toBe('flagged');
      expect(result.riskLevel).toBe('high');
      expect(result.riskScore).toBeGreaterThanOrEqual(50);
      expect(result.flags.some(f => f.code === 'PROHIBITED_JURISDICTION_SENDER')).toBe(true);
    });

    it('should detect sanctions match', async () => {
      const request: KytScreeningRequest = {
        transaction: {
          amount: 100,
          currency: 'USD',
          sender: { id: 'Blocked Entity Alpha', type: 'business' },
          recipient: { id: 'recipient_456', type: 'wallet' },
        },
      };

      const result = await performKytScreening(request);

      expect(result.flags.some(f => f.type === 'sanctions')).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(50);
    });

    it('should respect screening options', async () => {
      const request: KytScreeningRequest = {
        transaction: {
          amount: 15000,
          currency: 'USD',
          sender: { id: 'sender_123', type: 'agent', jurisdiction: 'KP' },
          recipient: { id: 'recipient_456', type: 'wallet' },
        },
        screeningOptions: {
          checkSanctions: false,
          checkGeography: false,
          checkAmount: false,
          checkWatchlists: false,
        },
      };

      const result = await performKytScreening(request);

      expect(result.riskScore).toBe(0);
      expect(result.flags).toHaveLength(0);
      expect(result.status).toBe('passed');
    });
  });

  describe('transformToResponse', () => {
    it('should transform screening result to response format', () => {
      const result = {
        screeningId: 'kyt_test123',
        status: 'flagged' as const,
        riskScore: 35,
        riskLevel: 'high' as const,
        flags: [
          {
            type: 'amount' as const,
            severity: 'medium' as const,
            code: 'AMOUNT_RISK',
            message: 'High amount',
          },
          {
            type: 'geography' as const,
            severity: 'critical' as const,
            code: 'HIGH_RISK_JURISDICTION',
            message: 'High risk jurisdiction',
          },
        ],
        screenedAt: '2024-01-01T00:00:00Z',
      };

      const response = transformToResponse(result);

      expect(response.screeningId).toBe('kyt_test123');
      expect(response.status).toBe('flagged');
      expect(response.riskScore).toBe(35);
      expect(response.riskLevel).toBe('high');
      expect(response.summary.totalFlags).toBe(2);
      expect(response.summary.criticalFlags).toBe(1);
      expect(response.expiresAt).toBeDefined();
    });
  });

  describe('audit logging', () => {
    it('should log screening for audit', async () => {
      const request: KytScreeningRequest = {
        transaction: {
          amount: 100,
          currency: 'USD',
          sender: { id: 'audit_test_sender', type: 'agent' },
          recipient: { id: 'audit_test_recipient', type: 'wallet' },
        },
      };

      const result = await performKytScreening(request);

      // Should be able to retrieve by ID
      const retrieved = getScreeningById(result.screeningId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.screeningId).toBe(result.screeningId);
    });

    it('should return undefined for non-existent screening', () => {
      const retrieved = getScreeningById('kyt_nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('should filter audit log by date range', async () => {
      const logs = getScreeningAuditLog('2024-01-01', '2024-12-31');
      expect(Array.isArray(logs)).toBe(true);
    });
  });
});
