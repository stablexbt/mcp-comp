export interface AgentMetadata {
  name: string;
  type: string;
  owner: string;
}

export interface ComplianceProfile {
  riskLevel: 'low' | 'medium' | 'high';
  geoRestrictions: string[];
  allowedPaymentMethods?: string[];
  maxTransactionAmount?: number;
  dailyTransactionLimit?: number;
}

export interface Agent {
  id: string;
  metadata: AgentMetadata;
  compliance: ComplianceProfile;
  apiKey: string;
  apiSecret: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterAgentRequest {
  metadata: AgentMetadata;
  compliance: ComplianceProfile;
}

export interface RegisterAgentResponse {
  agentId: string;
  metadata: AgentMetadata;
  compliance: ComplianceProfile;
  apiCredentials: {
    apiKey: string;
    apiSecret: string;
  };
  createdAt: string;
}

// Payment types
export interface PaymentRequest {
  agentId: string;
  amount: number;
  currency: string;
  recipient: {
    id: string;
    type: 'agent' | 'wallet' | 'address';
    address?: string;
  };
  memo?: string;
}

export type PaymentStatus = 'pending' | 'screening' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
export type KytRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface KytScreeningResult {
  passed: boolean;
  riskLevel: KytRiskLevel;
  riskScore: number;
  flags: string[];
  checkedAt: Date;
}

export interface PolicyCheckResult {
  passed: boolean;
  violations: string[];
  checkedAt: Date;
}

export interface Transaction {
  id: string;
  agentId: string;
  amount: number;
  currency: string;
  recipient: PaymentRequest['recipient'];
  memo?: string;
  status: PaymentStatus;
  kytResult?: KytScreeningResult;
  policyResult?: PolicyCheckResult;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface PaymentResponse {
  transactionId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  recipient: PaymentRequest['recipient'];
  kytPassed: boolean;
  policyPassed: boolean;
  rejectionReason?: string;
  createdAt: string;
}

// Payment Session types for MPP (Multi-Party Payment) protocol
export type SessionStatus = 'active' | 'paused' | 'closed' | 'expired';

export interface PaymentSession {
  id: string;
  agentId: string;
  budget: {
    amount: number;
    currency: string;
    spent: number;
  };
  duration: {
    createdAt: Date;
    expiresAt: Date;
  };
  status: SessionStatus;
  payments: string[]; // Transaction IDs
  mppConfig?: {
    maxParties: number;
    parties: string[];
    threshold: number;
  };
  metadata?: Record<string, unknown>;
  updatedAt: Date;
}

export interface CreateSessionRequest {
  agentId: string;
  budget: {
    amount: number;
    currency: string;
  };
  durationMinutes: number;
  mppConfig?: {
    maxParties: number;
    parties: string[];
    threshold: number;
  };
  metadata?: Record<string, unknown>;
}

export interface CreateSessionResponse {
  sessionId: string;
  agentId: string;
  budget: {
    amount: number;
    currency: string;
    spent: number;
    remaining: number;
  };
  status: SessionStatus;
  expiresAt: string;
  mppConfig?: {
    maxParties: number;
    parties: string[];
    threshold: number;
  };
  createdAt: string;
}

export interface UpdateSessionRequest {
  status?: SessionStatus;
  budget?: {
    amount: number;
  };
  mppConfig?: {
    parties?: string[];
    threshold?: number;
  };
}

export interface SessionPaymentRequest {
  sessionId: string;
  amount: number;
  recipient: PaymentRequest['recipient'];
  memo?: string;
}
