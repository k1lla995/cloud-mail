import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const userTelegram = sqliteTable('user_telegram', {
	userId: integer('user_id').primaryKey(),
	authorized: integer('authorized').notNull().default(0),
	pushEnabled: integer('push_enabled').notNull().default(0),
	chatId: text('chat_id').notNull().default(''),
	chatUsername: text('chat_username').notNull().default(''),
	boundAt: text('bound_at'),
	updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const telegramBinding = sqliteTable('telegram_binding', {
	codeHash: text('code_hash').primaryKey(),
	userId: integer('user_id').notNull(),
	expiresAt: text('expires_at').notNull(),
	createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export default userTelegram;
