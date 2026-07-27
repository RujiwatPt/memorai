export class MessagingService {
    db;
    constructor(db) {
        this.db = db;
    }
    async sendMessage(fromAgent, toAgent, topic, content, status = 'UNREAD', relayParentId) {
        if (status === 'ACTION_REQUIRED' && toAgent === 'all') {
            throw new Error('ACTION_REQUIRED messages must name a single agent in to_agent, not "all"');
        }
        let relayOrigin = fromAgent;
        let relayHop = 1;
        let parentId = null;
        if (relayParentId !== undefined) {
            if (!Number.isInteger(relayParentId) || relayParentId <= 0) {
                throw new Error('relay_parent_id must be a positive message ID');
            }
            const parent = await this.db.get(`SELECT * FROM messages WHERE id = ?`, [relayParentId]);
            if (!parent) {
                throw new Error(`Relay parent message with ID ${relayParentId} not found`);
            }
            if (parent.to_agent !== fromAgent || parent.claimed_by !== fromAgent) {
                throw new Error(`Only ${parent.to_agent}, after claiming message ${relayParentId}, can relay it`);
            }
            if (parent.relay_origin === fromAgent || parent.relay_hop >= 4) {
                throw new Error(`Message ${relayParentId} has completed a full lap and cannot be relayed again`);
            }
            const existingRelay = await this.db.get(`SELECT id FROM messages WHERE relay_parent_id = ?`, [relayParentId]);
            if (existingRelay) {
                throw new Error(`Message ${relayParentId} was already relayed as message ${existingRelay.id}`);
            }
            relayOrigin = parent.relay_origin;
            relayHop = parent.relay_hop + 1;
            parentId = parent.id;
        }
        const result = await this.db.run(`INSERT INTO messages (
        from_agent, to_agent, topic, content, status,
        relay_origin, relay_hop, relay_parent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [fromAgent, toAgent, topic, content, status, relayOrigin, relayHop, parentId]);
        const record = await this.db.get(`SELECT * FROM messages WHERE id = ?`, [result.lastID]);
        if (!record) {
            throw new Error('Failed to retrieve newly created message record');
        }
        return record;
    }
    async fetchInbox(toAgent, statusFilter, limit = 20) {
        let sql = `SELECT * FROM messages WHERE (to_agent = ? OR to_agent = 'all')`;
        const params = [toAgent];
        if (statusFilter) {
            sql += ` AND status = ?`;
            params.push(statusFilter);
        }
        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);
        return this.db.all(sql, params);
    }
    async markStatus(messageId, status) {
        await this.db.run(`UPDATE messages SET status = ? WHERE id = ?`, [status, messageId]);
        const record = await this.db.get(`SELECT * FROM messages WHERE id = ?`, [messageId]);
        if (!record) {
            throw new Error(`Message with ID ${messageId} not found`);
        }
        return record;
    }
    /** Atomic compare-and-swap claim. Exactly one agent wins when called concurrently. */
    async claimMessage(messageId, agentId) {
        const res = await this.db.run(`UPDATE messages
       SET claimed_by = ?, claimed_at = CURRENT_TIMESTAMP, status = 'READ'
       WHERE id = ?
         AND claimed_by IS NULL
         AND to_agent = ?`, [agentId, messageId, agentId]);
        const record = await this.db.get(`SELECT * FROM messages WHERE id = ?`, [messageId]);
        if (!record) {
            throw new Error(`Message with ID ${messageId} not found`);
        }
        return { claimed: res.changes === 1, record };
    }
}
