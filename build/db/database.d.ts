export declare class Database {
    private db;
    constructor(dbPath?: string);
    private migrate;
    init(): Promise<void>;
    run(sql: string, params?: unknown[]): Promise<{
        lastID: number;
        changes: number;
    }>;
    get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
    all<T>(sql: string, params?: unknown[]): Promise<T[]>;
    exec(sql: string): Promise<void>;
    close(): Promise<void>;
}
