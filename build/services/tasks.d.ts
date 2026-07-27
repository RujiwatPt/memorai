import { Database } from '../db/database.js';
import { ClaimResult, TaskRecord, TaskStatus } from '../types/index.js';
export declare class TaskService {
    private db;
    constructor(db: Database);
    createTask(title: string, description: string, assignedTo?: string, status?: TaskStatus): Promise<TaskRecord>;
    updateTask(taskId: number, updates: Partial<{
        title: string;
        description: string;
        assignedTo: string;
        status: TaskStatus;
    }>): Promise<TaskRecord>;
    /** Atomic compare-and-swap claim. Moves TODO → IN_PROGRESS for one agent only. */
    claimTask(taskId: number, agentId: string): Promise<ClaimResult<TaskRecord>>;
    getTaskBoard(status?: TaskStatus, assignedTo?: string): Promise<TaskRecord[]>;
}
