import { Database } from '../db/database.js';
import { ClaimResult, MessageRecord, MessageStatus } from '../types/index.js';

export class MessagingService {
  constructor(private db: Database) {}

  public async sendMessage(
    fromAgent: string,
    toAgent: string,
    topic: string,
    content: string,
    status: MessageStatus = 'UNREAD'
  ): Promise<MessageRecord> {
    if (status === 'ACTION_REQUIRED' && toAgent === 'all') {
      throw new Error(
        'ACTION_REQUIRED messages must name a single agent in to_agent, not "all"'
      );
    }

    const result = await this.db.run(
      `INSERT INTO messages (from_agent, to_agent, topic, content, status) VALUES (?, ?, ?, ?, ?)`,
      [fromAgent, toAgent, topic, content, status]
    );

    const record = await this.db.get<MessageRecord>(
      `SELECT * FROM messages WHERE id = ?`,
      [result.lastID]
    );

    if (!record) {
      throw new Error('Failed to retrieve newly created message record');
    }

    return record;
  }

  public async fetchInbox(
    toAgent: string,
    statusFilter?: MessageStatus,
    limit: number = 20
  ): Promise<MessageRecord[]> {
    let sql = `SELECT * FROM messages WHERE (to_agent = ? OR to_agent = 'all')`;
    const params: unknown[] = [toAgent];

    if (statusFilter) {
      sql += ` AND status = ?`;
      params.push(statusFilter);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    return this.db.all<MessageRecord>(sql, params);
  }

  public async markStatus(messageId: number, status: MessageStatus): Promise<MessageRecord> {
    await this.db.run(`UPDATE messages SET status = ? WHERE id = ?`, [status, messageId]);

    const record = await this.db.get<MessageRecord>(
      `SELECT * FROM messages WHERE id = ?`,
      [messageId]
    );

    if (!record) {
      throw new Error(`Message with ID ${messageId} not found`);
    }

    return record;
  }

  /** Atomic compare-and-swap claim. Exactly one agent wins when called concurrently. */
  public async claimMessage(messageId: number, agentId: string): Promise<ClaimResult<MessageRecord>> {
    const res = await this.db.run(
      `UPDATE messages
       SET claimed_by = ?, claimed_at = CURRENT_TIMESTAMP, status = 'READ'
       WHERE id = ?
         AND claimed_by IS NULL
         AND to_agent = ?`,
      [agentId, messageId, agentId]
    );

    const record = await this.db.get<MessageRecord>(`SELECT * FROM messages WHERE id = ?`, [messageId]);

    if (!record) {
      throw new Error(`Message with ID ${messageId} not found`);
    }

    return { claimed: res.changes === 1, record };
  }
}
