import { Database } from '../db/database.js';
import { MemoryRecord } from '../types/index.js';

export class MemoryService {
  constructor(private db: Database) {}

  public async saveMemory(
    agentId: string,
    topic: string,
    content: string,
    tags: string[] = []
  ): Promise<MemoryRecord> {
    const tagsJson = JSON.stringify(tags);
    const result = await this.db.run(
      `INSERT INTO memories (agent_id, topic, content, tags) VALUES (?, ?, ?, ?)`,
      [agentId, topic, content, tagsJson]
    );

    const record = await this.db.get<Omit<MemoryRecord, 'tags'> & { tags: string }>(
      `SELECT * FROM memories WHERE id = ?`,
      [result.lastID]
    );

    if (!record) {
      throw new Error('Failed to retrieve newly created memory record');
    }

    return {
      ...record,
      tags: JSON.parse(record.tags || '[]'),
    };
  }

  public async searchMemory(
    query: string,
    agentId?: string,
    tag?: string,
    limit: number = 20
  ): Promise<MemoryRecord[]> {
    let sql = `SELECT * FROM memories WHERE 1=1`;
    const params: unknown[] = [];

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

    const rawRows = await this.db.all<Omit<MemoryRecord, 'tags'> & { tags: string }>(sql, params);

    return rawRows.map((row) => ({
      ...row,
      tags: JSON.parse(row.tags || '[]'),
    }));
  }

  public async getRecentMemories(limit: number = 10): Promise<MemoryRecord[]> {
    const rawRows = await this.db.all<Omit<MemoryRecord, 'tags'> & { tags: string }>(
      `SELECT * FROM memories ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );

    return rawRows.map((row) => ({
      ...row,
      tags: JSON.parse(row.tags || '[]'),
    }));
  }
}
