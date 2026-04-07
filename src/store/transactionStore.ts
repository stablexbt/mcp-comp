import { Transaction, PaymentStatus } from '../types/agent';

// In-memory storage for transactions (replace with database in production)
const transactions = new Map<string, Transaction>();

export class TransactionStore {
  static create(transaction: Transaction): void {
    transactions.set(transaction.id, transaction);
  }

  static get(id: string): Transaction | undefined {
    return transactions.get(id);
  }

  static getByAgentId(agentId: string): Transaction[] {
    return Array.from(transactions.values()).filter(
      (tx) => tx.agentId === agentId
    );
  }

  static getAll(): Transaction[] {
    return Array.from(transactions.values());
  }

  static update(
    id: string,
    updates: Partial<Transaction>
  ): Transaction | undefined {
    const existing = transactions.get(id);
    if (!existing) return undefined;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    transactions.set(id, updated as Transaction);
    return updated as Transaction;
  }

  static updateStatus(
    id: string,
    status: PaymentStatus,
    additionalUpdates?: Partial<Transaction>
  ): Transaction | undefined {
    const updates: Partial<Transaction> = {
      status,
      ...additionalUpdates,
    };

    if (status === 'completed' || status === 'failed' || status === 'rejected') {
      updates.completedAt = new Date();
    }

    return TransactionStore.update(id, updates);
  }

  static delete(id: string): boolean {
    return transactions.delete(id);
  }

  // For testing/debugging
  static clear(): void {
    transactions.clear();
  }
}
