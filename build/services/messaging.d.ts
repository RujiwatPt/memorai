import { Database } from '../db/database.js';
import { MessageRecord, MessageStatus } from '../types/index.js';
export declare class MessagingService {
    private db;
    constructor(db: Database);
    sendMessage(fromAgent: string, toAgent: string, topic: string, content: string, status?: MessageStatus): Promise<MessageRecord>;
    fetchInbox(toAgent: string, statusFilter?: MessageStatus, limit?: number): Promise<MessageRecord[]>;
    markStatus(messageId: number, status: MessageStatus): Promise<MessageRecord>;
}
