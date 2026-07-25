import { Database } from '../db/database.js';
import { TaskRecord, TaskStatus } from '../types/index.js';

export class TaskService {
  constructor(private db: Database) {}

  public async createTask(
    title: string,
    description: string,
    assignedTo: string = 'unassigned',
    status: TaskStatus = 'TODO'
  ): Promise<TaskRecord> {
    const result = await this.db.run(
      `INSERT INTO tasks (title, description, assigned_to, status) VALUES (?, ?, ?, ?)`,
      [title, description, assignedTo, status]
    );

    const record = await this.db.get<TaskRecord>(
      `SELECT * FROM tasks WHERE id = ?`,
      [result.lastID]
    );

    if (!record) {
      throw new Error('Failed to retrieve newly created task record');
    }

    return record;
  }

  public async updateTask(
    taskId: number,
    updates: Partial<{ title: string; description: string; assignedTo: string; status: TaskStatus }>
  ): Promise<TaskRecord> {
    const current = await this.db.get<TaskRecord>(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
    if (!current) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    const title = updates.title ?? current.title;
    const description = updates.description ?? current.description;
    const assignedTo = updates.assignedTo ?? current.assigned_to;
    const status = updates.status ?? current.status;

    await this.db.run(
      `UPDATE tasks SET title = ?, description = ?, assigned_to = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title, description, assignedTo, status, taskId]
    );

    const updated = await this.db.get<TaskRecord>(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
    if (!updated) {
      throw new Error(`Task with ID ${taskId} not found after update`);
    }

    return updated;
  }

  public async getTaskBoard(status?: TaskStatus, assignedTo?: string): Promise<TaskRecord[]> {
    let sql = `SELECT * FROM tasks WHERE 1=1`;
    const params: unknown[] = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (assignedTo) {
      sql += ` AND assigned_to = ?`;
      params.push(assignedTo);
    }

    sql += ` ORDER BY updated_at DESC`;

    return this.db.all<TaskRecord>(sql, params);
  }
}
