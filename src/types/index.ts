export type KnownAgent = 'cursor' | 'antigravity' | 'claude' | 'codex' | 'all' | string;

export type MessageStatus = 'UNREAD' | 'READ' | 'ACTION_REQUIRED' | 'COMPLETED';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export interface MemoryRecord {
  id: number;
  agent_id: string;
  topic: string;
  content: string;
  tags: string[];
  created_at: string;
}

export interface MessageRecord {
  id: number;
  from_agent: string;
  to_agent: string;
  topic: string;
  content: string;
  status: MessageStatus;
  created_at: string;
}

export interface TaskRecord {
  id: number;
  title: string;
  description: string;
  assigned_to: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}
