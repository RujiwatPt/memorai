export class MemoryService {
    db;
    constructor(db) {
        this.db = db;
    }
    async saveMemory(agentId, topic, content, tags = []) {
        const tagsJson = JSON.stringify(tags);
        const result = await this.db.run(`INSERT INTO memories (agent_id, topic, content, tags) VALUES (?, ?, ?, ?)`, [agentId, topic, content, tagsJson]);
        const record = await this.db.get(`SELECT * FROM memories WHERE id = ?`, [result.lastID]);
        if (!record) {
            throw new Error('Failed to retrieve newly created memory record');
        }
        return {
            ...record,
            tags: JSON.parse(record.tags || '[]'),
        };
    }
    async searchMemory(query, agentId, tag, limit = 20) {
        let sql = `SELECT * FROM memories WHERE 1=1`;
        const params = [];
        if (query && query.trim() !== '') {
            sql += ` AND (topic LIKE ? OR content LIKE ?)`;
            const searchTerm = `%${query.trim()}%`;
            params.push(searchTerm, searchTerm);
        }
        if (agentId && agentId.trim() !== '') {
            sql += ` AND agent_id = ?`;
            params.push(agentId.trim());
        }
        if (tag && tag.trim() !== '') {
            sql += ` AND tags LIKE ?`;
            params.push(`%"${tag.trim()}"%`);
        }
        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);
        const rawRows = await this.db.all(sql, params);
        return rawRows.map((row) => ({
            ...row,
            tags: JSON.parse(row.tags || '[]'),
        }));
    }
    async getRecentMemories(limit = 10) {
        const rawRows = await this.db.all(`SELECT * FROM memories ORDER BY created_at DESC LIMIT ?`, [limit]);
        return rawRows.map((row) => ({
            ...row,
            tags: JSON.parse(row.tags || '[]'),
        }));
    }
}
