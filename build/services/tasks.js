export class TaskService {
    db;
    constructor(db) {
        this.db = db;
    }
    async createTask(title, description, assignedTo = 'unassigned', status = 'TODO') {
        const result = await this.db.run(`INSERT INTO tasks (title, description, assigned_to, status) VALUES (?, ?, ?, ?)`, [title, description, assignedTo, status]);
        const record = await this.db.get(`SELECT * FROM tasks WHERE id = ?`, [result.lastID]);
        if (!record) {
            throw new Error('Failed to retrieve newly created task record');
        }
        return record;
    }
    async updateTask(taskId, updates) {
        const current = await this.db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
        if (!current) {
            throw new Error(`Task with ID ${taskId} not found`);
        }
        const title = updates.title ?? current.title;
        const description = updates.description ?? current.description;
        const assignedTo = updates.assignedTo ?? current.assigned_to;
        const status = updates.status ?? current.status;
        await this.db.run(`UPDATE tasks SET title = ?, description = ?, assigned_to = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [title, description, assignedTo, status, taskId]);
        const updated = await this.db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
        if (!updated) {
            throw new Error(`Task with ID ${taskId} not found after update`);
        }
        return updated;
    }
    async getTaskBoard(status, assignedTo) {
        let sql = `SELECT * FROM tasks WHERE 1=1`;
        const params = [];
        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }
        if (assignedTo) {
            sql += ` AND assigned_to = ?`;
            params.push(assignedTo);
        }
        sql += ` ORDER BY updated_at DESC`;
        return this.db.all(sql, params);
    }
}
