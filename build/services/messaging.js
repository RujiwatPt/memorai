export class MessagingService {
    db;
    constructor(db) {
        this.db = db;
    }
    async sendMessage(fromAgent, toAgent, topic, content, status = 'UNREAD') {
        const result = await this.db.run(`INSERT INTO messages (from_agent, to_agent, topic, content, status) VALUES (?, ?, ?, ?, ?)`, [fromAgent, toAgent, topic, content, status]);
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
}
