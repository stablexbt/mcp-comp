import { PaymentSession, SessionStatus } from '../types/agent';

// In-memory storage for payment sessions (replace with database in production)
const sessions = new Map<string, PaymentSession>();

export class SessionStore {
  static create(session: PaymentSession): void {
    sessions.set(session.id, session);
  }

  static get(id: string): PaymentSession | undefined {
    return sessions.get(id);
  }

  static getByAgentId(agentId: string): PaymentSession[] {
    return Array.from(sessions.values()).filter(
      (session) => session.agentId === agentId
    );
  }

  static getActiveByAgentId(agentId: string): PaymentSession | undefined {
    return Array.from(sessions.values()).find(
      (session) => session.agentId === agentId && session.status === 'active'
    );
  }

  static update(
    id: string,
    updates: Partial<PaymentSession>
  ): PaymentSession | undefined {
    const existing = sessions.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    sessions.set(id, updated);
    return updated;
  }

  static updateStatus(
    id: string,
    status: SessionStatus
  ): PaymentSession | undefined {
    return SessionStore.update(id, { status });
  }

  static addPayment(sessionId: string, transactionId: string): boolean {
    const session = sessions.get(sessionId);
    if (!session) return false;

    session.payments.push(transactionId);
    sessions.set(sessionId, session);
    return true;
  }

  static delete(id: string): boolean {
    return sessions.delete(id);
  }

  // For testing/debugging
  static clear(): void {
    sessions.clear();
  }
}
