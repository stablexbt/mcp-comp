import { Agent } from '../types/agent';

// In-memory storage for agents (replace with database in production)
const agents = new Map<string, Agent>();

export class AgentStore {
  static create(agent: Agent): void {
    agents.set(agent.id, agent);
  }

  static get(id: string): Agent | undefined {
    return agents.get(id);
  }

  static getAll(): Agent[] {
    return Array.from(agents.values());
  }

  static update(id: string, agent: Partial<Agent>): Agent | undefined {
    const existing = agents.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...agent, updatedAt: new Date() };
    agents.set(id, updated as Agent);
    return updated as Agent;
  }

  static delete(id: string): boolean {
    return agents.delete(id);
  }

  // For testing/debugging
  static clear(): void {
    agents.clear();
  }
}
