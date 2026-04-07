import { describe, it, expect, beforeEach } from 'vitest';
import { registerAgent, validateRegisterRequest, generateAgentId, generateApiCredentials } from '../src/services/agentService';
import { AgentStore } from '../src/store/agentStore';
import { RegisterAgentRequest } from '../src/types/agent';

describe('Agent Service', () => {
  beforeEach(() => {
    AgentStore.clear();
  });

  describe('generateAgentId', () => {
    it('should generate a valid agent ID', () => {
      const id = generateAgentId();
      expect(id).toMatch(/^agent_[a-f0-9]{32}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateAgentId();
      const id2 = generateAgentId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateApiCredentials', () => {
    it('should generate valid API credentials', () => {
      const creds = generateApiCredentials();
      expect(creds.apiKey).toMatch(/^rem_[a-f0-9]{32}$/);
      expect(creds.apiSecret).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique credentials', () => {
      const creds1 = generateApiCredentials();
      const creds2 = generateApiCredentials();
      expect(creds1.apiKey).not.toBe(creds2.apiKey);
      expect(creds1.apiSecret).not.toBe(creds2.apiSecret);
    });
  });

  describe('validateRegisterRequest', () => {
    it('should validate a correct request', () => {
      const request: RegisterAgentRequest = {
        metadata: {
          name: 'Test Agent',
          type: 'trading',
          owner: 'user@example.com',
        },
        compliance: {
          riskLevel: 'medium',
          geoRestrictions: ['US', 'EU'],
        },
      };
      expect(validateRegisterRequest(request)).toBe(true);
    });

    it('should reject null body', () => {
      expect(validateRegisterRequest(null)).toBe(false);
    });

    it('should reject missing metadata', () => {
      const request = {
        compliance: {
          riskLevel: 'low',
          geoRestrictions: [],
        },
      };
      expect(validateRegisterRequest(request)).toBe(false);
    });

    it('should reject invalid riskLevel', () => {
      const request = {
        metadata: {
          name: 'Test',
          type: 'bot',
          owner: 'user@test.com',
        },
        compliance: {
          riskLevel: 'invalid',
          geoRestrictions: [],
        },
      };
      expect(validateRegisterRequest(request)).toBe(false);
    });

    it('should reject empty name', () => {
      const request = {
        metadata: {
          name: '',
          type: 'bot',
          owner: 'user@test.com',
        },
        compliance: {
          riskLevel: 'low',
          geoRestrictions: [],
        },
      };
      expect(validateRegisterRequest(request)).toBe(false);
    });
  });

  describe('registerAgent', () => {
    it('should successfully register an agent', () => {
      const request: RegisterAgentRequest = {
        metadata: {
          name: 'Test Agent',
          type: 'trading',
          owner: 'user@example.com',
        },
        compliance: {
          riskLevel: 'high',
          geoRestrictions: ['US'],
          maxTransactionAmount: 1000,
        },
      };

      const response = registerAgent(request);

      expect(response.agentId).toMatch(/^agent_[a-f0-9]{32}$/);
      expect(response.metadata).toEqual(request.metadata);
      expect(response.compliance).toEqual(request.compliance);
      expect(response.apiCredentials.apiKey).toMatch(/^rem_[a-f0-9]{32}$/);
      expect(response.apiCredentials.apiSecret).toMatch(/^[a-f0-9]{64}$/);
      expect(response.createdAt).toBeDefined();
    });

    it('should store the agent in the store', () => {
      const request: RegisterAgentRequest = {
        metadata: {
          name: 'Test Agent',
          type: 'trading',
          owner: 'user@example.com',
        },
        compliance: {
          riskLevel: 'medium',
          geoRestrictions: [],
        },
      };

      const response = registerAgent(request);
      const storedAgent = AgentStore.get(response.agentId);

      expect(storedAgent).toBeDefined();
      expect(storedAgent?.id).toBe(response.agentId);
      expect(storedAgent?.metadata.name).toBe(request.metadata.name);
    });
  });
});
