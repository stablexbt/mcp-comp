import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Agent, RegisterAgentRequest, RegisterAgentResponse } from '../types/agent';
import { AgentStore } from '../store/agentStore';

export function generateAgentId(): string {
  return `agent_${uuidv4().replace(/-/g, '')}`;
}

export function generateApiCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = `rem_${crypto.randomBytes(16).toString('hex')}`;
  const apiSecret = crypto.randomBytes(32).toString('hex');
  return { apiKey, apiSecret };
}

export function validateRegisterRequest(body: unknown): body is RegisterAgentRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const req = body as RegisterAgentRequest;

  // Validate metadata
  if (!req.metadata || typeof req.metadata !== 'object') {
    return false;
  }
  if (typeof req.metadata.name !== 'string' || req.metadata.name.trim() === '') {
    return false;
  }
  if (typeof req.metadata.type !== 'string' || req.metadata.type.trim() === '') {
    return false;
  }
  if (typeof req.metadata.owner !== 'string' || req.metadata.owner.trim() === '') {
    return false;
  }

  // Validate compliance profile
  if (!req.compliance || typeof req.compliance !== 'object') {
    return false;
  }
  if (!['low', 'medium', 'high'].includes(req.compliance.riskLevel)) {
    return false;
  }
  if (!Array.isArray(req.compliance.geoRestrictions)) {
    return false;
  }

  return true;
}

export function registerAgent(requestBody: RegisterAgentRequest): RegisterAgentResponse {
  const agentId = generateAgentId();
  const { apiKey, apiSecret } = generateApiCredentials();
  const now = new Date();

  const agent: Agent = {
    id: agentId,
    metadata: requestBody.metadata,
    compliance: requestBody.compliance,
    apiKey,
    apiSecret,
    createdAt: now,
    updatedAt: now,
  };

  AgentStore.create(agent);

  return {
    agentId,
    metadata: requestBody.metadata,
    compliance: requestBody.compliance,
    apiCredentials: {
      apiKey,
      apiSecret,
    },
    createdAt: now.toISOString(),
  };
}
