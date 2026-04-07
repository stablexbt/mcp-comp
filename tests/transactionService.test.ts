import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateQueryParams,
  parseQueryParams,
  queryTransactions,
  transformTransactionToResponse,
  convertToCSV,
  TransactionQueryParams,
} from '../src/services/transactionService';
import { TransactionStore } from '../src/store/transactionStore';
import { Transaction, PaymentStatus } from '../src/types/agent';

describe('Transaction Service', () => {
  beforeEach(() => {
    TransactionStore.clear();
  });

  describe('validateQueryParams', () => {
    it('should validate empty params', () => {
      const result = validateQueryParams({});
      expect(result.valid).toBe(true);
    });

    it('should validate valid limit', () => {
      const result = validateQueryParams({ limit: 50 });
      expect(result.valid).toBe(true);
    });

    it('should reject limit too high', () => {
      const result = validateQueryParams({ limit: 2000 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Limit must be between 1 and 1000');
    });

    it('should reject negative offset', () => {
      const result = validateQueryParams({ offset: -1 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Offset must be a non-negative number');
    });

    it('should validate valid status', () => {
      const result = validateQueryParams({ status: 'completed' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = validateQueryParams({ status: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid status value');
    });

    it('should validate valid dates', () => {
      const result = validateQueryParams({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid date', () => {
      const result = validateQueryParams({ startDate: 'invalid-date' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid startDate format');
    });

    it('should validate csv format', () => {
      const result = validateQueryParams({ format: 'csv' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid format', () => {
      const result = validateQueryParams({ format: 'xml' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Format must be json or csv');
    });
  });

  describe('parseQueryParams', () => {
    it('should parse string values', () => {
      const result = parseQueryParams({
        limit: '50',
        offset: '10',
        status: 'completed',
        startDate: '2024-01-01',
        format: 'csv',
      });

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(10);
      expect(result.status).toBe('completed');
      expect(result.startDate).toBe('2024-01-01');
      expect(result.format).toBe('csv');
    });

    it('should parse number values', () => {
      const result = parseQueryParams({
        limit: 25,
        offset: 5,
      });

      expect(result.limit).toBe(25);
      expect(result.offset).toBe(5);
    });

    it('should handle empty params', () => {
      const result = parseQueryParams({});
      expect(result).toEqual({});
    });
  });

  describe('queryTransactions', () => {
    const mockTransaction = (id: string, agentId: string, status: PaymentStatus, date: string): Transaction => ({
      id,
      agentId,
      amount: 100,
      currency: 'USD',
      recipient: { id: 'recipient1', type: 'wallet' },
      status,
      createdAt: new Date(date),
      updatedAt: new Date(date),
    });

    beforeEach(() => {
      // Create test transactions
      TransactionStore.create(mockTransaction('tx1', 'agent1', 'completed', '2024-06-15'));
      TransactionStore.create(mockTransaction('tx2', 'agent1', 'pending', '2024-06-14'));
      TransactionStore.create(mockTransaction('tx3', 'agent1', 'completed', '2024-06-13'));
      TransactionStore.create(mockTransaction('tx4', 'agent2', 'completed', '2024-06-15'));
    });

    it('should return transactions for specific agent', () => {
      const result = queryTransactions('agent1', {});
      expect(result.transactions).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by status', () => {
      const result = queryTransactions('agent1', { status: 'completed' });
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions.every((tx) => tx.status === 'completed')).toBe(true);
    });

    it('should filter by date range', () => {
      const result = queryTransactions('agent1', {
        startDate: '2024-06-14',
        endDate: '2024-06-15',
      });
      expect(result.transactions).toHaveLength(2);
    });

    it('should apply pagination', () => {
      const result = queryTransactions('agent1', { limit: 2, offset: 0 });
      expect(result.transactions).toHaveLength(2);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });

    it('should sort by createdAt descending', () => {
      const result = queryTransactions('agent1', {});
      const dates = result.transactions.map((tx) => tx.createdAt.getTime());
      expect(dates[0]).toBeGreaterThan(dates[1]);
      expect(dates[1]).toBeGreaterThan(dates[2]);
    });
  });

  describe('transformTransactionToResponse', () => {
    it('should transform transaction with KYT and policy results', () => {
      const transaction: Transaction = {
        id: 'tx123',
        agentId: 'agent1',
        amount: 100,
        currency: 'USD',
        recipient: { id: 'recipient1', type: 'wallet' },
        status: 'completed',
        kytResult: {
          passed: true,
          riskLevel: 'low',
          riskScore: 5,
          flags: [],
          checkedAt: new Date('2024-06-15'),
        },
        policyResult: {
          passed: true,
          violations: [],
          checkedAt: new Date('2024-06-15'),
        },
        createdAt: new Date('2024-06-15'),
        updatedAt: new Date('2024-06-15'),
        completedAt: new Date('2024-06-15'),
      };

      const result = transformTransactionToResponse(transaction);

      expect(result.id).toBe('tx123');
      expect(result.complianceStatus.kyt?.passed).toBe(true);
      expect(result.complianceStatus.kyt?.riskLevel).toBe('low');
      expect(result.complianceStatus.policy?.passed).toBe(true);
      expect(result.completedAt).toBeDefined();
    });

    it('should handle transaction without KYT or policy results', () => {
      const transaction: Transaction = {
        id: 'tx123',
        agentId: 'agent1',
        amount: 100,
        currency: 'USD',
        recipient: { id: 'recipient1', type: 'wallet' },
        status: 'pending',
        createdAt: new Date('2024-06-15'),
        updatedAt: new Date('2024-06-15'),
      };

      const result = transformTransactionToResponse(transaction);

      expect(result.complianceStatus.kyt).toBeNull();
      expect(result.complianceStatus.policy).toBeNull();
      expect(result.completedAt).toBeUndefined();
    });
  });

  describe('convertToCSV', () => {
    it('should convert transactions to CSV format', () => {
      const transactions = [
        {
          id: 'tx123',
          agentId: 'agent1',
          amount: 100,
          currency: 'USD',
          recipient: { id: 'recipient1', type: 'wallet' as const },
          status: 'completed' as const,
          complianceStatus: {
            kyt: {
              passed: true,
              riskLevel: 'low',
              riskScore: 5,
              flags: [],
              checkedAt: '2024-06-15T00:00:00.000Z',
            },
            policy: {
              passed: true,
              violations: [],
              checkedAt: '2024-06-15T00:00:00.000Z',
            },
          },
          createdAt: '2024-06-15T00:00:00.000Z',
          updatedAt: '2024-06-15T00:00:00.000Z',
          completedAt: '2024-06-15T00:00:00.000Z',
        },
      ];

      const csv = convertToCSV(transactions);

      expect(csv).toContain('id,agentId,amount,currency');
      expect(csv).toContain('tx123');
      expect(csv).toContain('agent1');
      expect(csv).toContain('100');
      expect(csv).toContain('USD');
    });

    it('should escape values with commas', () => {
      const transactions = [
        {
          id: 'tx123',
          agentId: 'agent1',
          amount: 100,
          currency: 'USD',
          recipient: { id: 'recipient,1', type: 'wallet' as const },
          status: 'completed' as const,
          complianceStatus: {
            kyt: null,
            policy: null,
          },
          createdAt: '2024-06-15T00:00:00.000Z',
          updatedAt: '2024-06-15T00:00:00.000Z',
        },
      ];

      const csv = convertToCSV(transactions);

      expect(csv).toContain('"recipient,1"');
    });
  });
});
