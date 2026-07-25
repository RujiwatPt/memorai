import { Database } from '../db/database.js';
import { MemoryRecord } from '../types/index.js';
export declare class MemoryService {
    private db;
    constructor(db: Database);
    saveMemory(agentId: string, topic: string, content: string, tags?: string[]): Promise<MemoryRecord>;
    searchMemory(query: string, agentId?: string, tag?: string, limit?: number): Promise<MemoryRecord[]>;
    getRecentMemories(limit?: number): Promise<MemoryRecord[]>;
}
