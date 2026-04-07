import { Transaction, PaymentStatus, KytScreeningResult, PolicyCheckResult } from '../types/agent';
import { TransactionStore } from '../store/transactionStore';

export interface TransactionQueryParams {
  startDate?: string;
  endDate?: string;
  status?: PaymentStatus;
  limit?: number;
  offset?: number;
  format?: 'json' | 'csv';
}

export interface TransactionQueryResult {
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface TransactionResponseItem {
  id: string;
  agentId: string;
  amount: number;
  currency: string;
  recipient: {
    id: string;
    type: 'agent' | 'wallet' | 'address';
    address?: string;
  };
  memo?: string;
  status: PaymentStatus;
  complianceStatus: {
    kyt: {
      passed: boolean;
      riskLevel: string;
      riskScore: number;
      flags: string[];
      checkedAt: string;
    } | null;
    policy: {
      passed: boolean;
      violations: string[];
      checkedAt: string;
    } | null;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Validate transaction query parameters
 */
export function validateQueryParams(params: unknown): { valid: boolean; error?: string } {
  if (typeof params !== 'object' || params === null) {
    return { valid: true }; // No params is valid
  }

  const p = params as Record<string, unknown>;

  // Validate limit
  if (p.limit !== undefined) {
    const limit = typeof p.limit === 'string' ? parseInt(p.limit, 10) : p.limit;
    if (typeof limit !== 'number' || isNaN(limit) || limit < 1 || limit > 1000) {
      return { valid: false, error: 'Limit must be between 1 and 1000' };
    }
  }

  // Validate offset
  if (p.offset !== undefined) {
    const offset = typeof p.offset === 'string' ? parseInt(p.offset, 10) : p.offset;
    if (typeof offset !== 'number' || isNaN(offset) || offset < 0) {
      return { valid: false, error: 'Offset must be a non-negative number' };
    }
  }

  // Validate dates
  if (p.startDate !== undefined) {
    const date = new Date(p.startDate as string);
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Invalid startDate format' };
    }
  }

  if (p.endDate !== undefined) {
    const date = new Date(p.endDate as string);
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Invalid endDate format' };
    }
  }

  // Validate status
  if (p.status !== undefined) {
    const validStatuses: PaymentStatus[] = ['pending', 'screening', 'approved', 'rejected', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(p.status as PaymentStatus)) {
      return { valid: false, error: 'Invalid status value' };
    }
  }

  // Validate format
  if (p.format !== undefined) {
    if (!['json', 'csv'].includes(p.format as string)) {
      return { valid: false, error: 'Format must be json or csv' };
    }
  }

  return { valid: true };
}

/**
 * Parse query parameters from request
 */
export function parseQueryParams(query: Record<string, unknown>): TransactionQueryParams {
  const params: TransactionQueryParams = {};

  if (query.startDate) {
    params.startDate = query.startDate as string;
  }

  if (query.endDate) {
    params.endDate = query.endDate as string;
  }

  if (query.status) {
    params.status = query.status as PaymentStatus;
  }

  if (query.limit) {
    params.limit = typeof query.limit === 'string' ? parseInt(query.limit, 10) : query.limit as number;
  }

  if (query.offset) {
    params.offset = typeof query.offset === 'string' ? parseInt(query.offset, 10) : query.offset as number;
  }

  if (query.format) {
    params.format = query.format as 'json' | 'csv';
  }

  return params;
}

/**
 * Query transactions for an agent with filtering and pagination
 */
export function queryTransactions(
  agentId: string,
  params: TransactionQueryParams
): TransactionQueryResult {
  // Get all transactions for the agent
  let transactions = TransactionStore.getByAgentId(agentId);

  // Apply date filtering
  if (params.startDate) {
    const startDate = new Date(params.startDate);
    transactions = transactions.filter((tx) => new Date(tx.createdAt) >= startDate);
  }

  if (params.endDate) {
    const endDate = new Date(params.endDate);
    transactions = transactions.filter((tx) => new Date(tx.createdAt) <= endDate);
  }

  // Apply status filtering
  if (params.status) {
    transactions = transactions.filter((tx) => tx.status === params.status);
  }

  // Sort by createdAt descending (newest first)
  transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = transactions.length;

  // Apply pagination
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const paginatedTransactions = transactions.slice(offset, offset + limit);

  return {
    transactions: paginatedTransactions,
    total,
    limit,
    offset,
  };
}

/**
 * Transform transaction to response format with compliance status
 */
export function transformTransactionToResponse(tx: Transaction): TransactionResponseItem {
  return {
    id: tx.id,
    agentId: tx.agentId,
    amount: tx.amount,
    currency: tx.currency,
    recipient: tx.recipient,
    memo: tx.memo,
    status: tx.status,
    complianceStatus: {
      kyt: tx.kytResult
        ? {
            passed: tx.kytResult.passed,
            riskLevel: tx.kytResult.riskLevel,
            riskScore: tx.kytResult.riskScore,
            flags: tx.kytResult.flags,
            checkedAt: tx.kytResult.checkedAt.toISOString(),
          }
        : null,
      policy: tx.policyResult
        ? {
            passed: tx.policyResult.passed,
            violations: tx.policyResult.violations,
            checkedAt: tx.policyResult.checkedAt.toISOString(),
          }
        : null,
    },
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    completedAt: tx.completedAt?.toISOString(),
  };
}

/**
 * Convert transactions to CSV format
 */
export function convertToCSV(transactions: TransactionResponseItem[]): string {
  const headers = [
    'id',
    'agentId',
    'amount',
    'currency',
    'recipientId',
    'recipientType',
    'recipientAddress',
    'memo',
    'status',
    'kytPassed',
    'kytRiskLevel',
    'kytRiskScore',
    'kytFlags',
    'policyPassed',
    'policyViolations',
    'createdAt',
    'completedAt',
  ];

  const rows = transactions.map((tx) => [
    tx.id,
    tx.agentId,
    tx.amount,
    tx.currency,
    tx.recipient.id,
    tx.recipient.type,
    tx.recipient.address || '',
    tx.memo || '',
    tx.status,
    tx.complianceStatus.kyt?.passed ?? '',
    tx.complianceStatus.kyt?.riskLevel ?? '',
    tx.complianceStatus.kyt?.riskScore ?? '',
    tx.complianceStatus.kyt?.flags.join(';') ?? '',
    tx.complianceStatus.policy?.passed ?? '',
    tx.complianceStatus.policy?.violations.join(';') ?? '',
    tx.createdAt,
    tx.completedAt || '',
  ]);

  // Escape values and create CSV
  const escapeValue = (value: string | number | boolean): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return [headers.join(','), ...rows.map((row) => row.map(escapeValue).join(','))].join('\n');
}
