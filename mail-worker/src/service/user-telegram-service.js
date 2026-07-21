import { and, eq, gt } from 'drizzle-orm';
import orm from '../entity/orm';
import { telegramBinding, userTelegram } from '../entity/user-telegram';
import user from '../entity/user';
import { isDel, userConst } from '../const/entity-const';
import userContext from '../security/user-context';
import accessControlService from '../security/access-control-service';
import BizError from '../error/biz-error';
import settingService from './setting-service';
import adminUtils from '../utils/admin-utils';

const BINDING_TTL_SECONDS = 10 * 60;

function randomCode() {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hashCode(value) {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function expiresAt() {
	return new Date(Date.now() + BINDING_TTL_SECONDS * 1000).toISOString();
}

const userTelegramService = {
	async get(c, userId = userContext.getUserId(c)) {
		const row = await orm(c).select().from(userTelegram).where(eq(userTelegram.userId, userId)).get();
		return row || {
			userId,
			authorized: adminUtils.isAdminUser(c.get?.('user'), c.env.admin) ? 1 : 0,
			pushEnabled: 0,
			chatId: '',
			chatUsername: '',
			boundAt: null
		};
	},

	async setAuthorization(c, params) {
		const { userId, authorized } = params;
		if (!Number.isInteger(Number(userId)) || ![0, 1].includes(Number(authorized))) {
			throw new BizError('Invalid Telegram authorization request');
		}
		if (!await accessControlService.isRootAdmin(c)) {
			throw new BizError('Only the root administrator can manage Telegram authorization', 403);
		}
		const target = await orm(c).select().from(user).where(eq(user.userId, Number(userId))).get();
		if (!target || target.isDel !== isDel.NORMAL) {
			throw new BizError('User does not exist');
		}
		await orm(c).insert(userTelegram).values({
			userId: Number(userId),
			authorized: Number(authorized),
			pushEnabled: 0,
			updatedAt: new Date().toISOString()
		}).onConflictDoUpdate({
			target: userTelegram.userId,
			set: {
				authorized: Number(authorized),
				pushEnabled: Number(authorized) ? userTelegram.pushEnabled : 0,
				updatedAt: new Date().toISOString()
			}
		});
		return this.get(c, Number(userId));
	},

	async createBinding(c) {
		const userId = userContext.getUserId(c);
		let config = await this.get(c, userId);
		if (!config.authorized && await accessControlService.isRootAdmin(c)) {
			await orm(c).insert(userTelegram).values({ userId, authorized: 1, updatedAt: new Date().toISOString() })
				.onConflictDoUpdate({ target: userTelegram.userId, set: { authorized: 1, updatedAt: new Date().toISOString() } }).run();
			config = await this.get(c, userId);
		}
		if (!config.authorized) {
			throw new BizError('Telegram push has not been authorized for this user', 403);
		}
		if (!(await settingService.query(c)).tgBotToken) {
			throw new BizError('The root administrator has not configured the Telegram bot');
		}
		const code = randomCode();
		const codeHash = await hashCode(code);
		await orm(c).delete(telegramBinding).where(eq(telegramBinding.userId, userId)).run();
		await orm(c).insert(telegramBinding).values({ codeHash, userId, expiresAt: expiresAt() }).run();
		return { code, expiresIn: BINDING_TTL_SECONDS };
	},

	async setPushEnabled(c, enabled) {
		const userId = userContext.getUserId(c);
		const config = await this.get(c, userId);
		if (!config.authorized || !config.chatId) {
			throw new BizError('Bind Telegram before enabling push', 403);
		}
		await orm(c).update(userTelegram).set({
			pushEnabled: enabled ? 1 : 0,
			updatedAt: new Date().toISOString()
		}).where(eq(userTelegram.userId, userId)).run();
		return this.get(c, userId);
	},

	async unbind(c) {
		const userId = userContext.getUserId(c);
		await orm(c).update(userTelegram).set({
			pushEnabled: 0,
			chatId: '',
			chatUsername: '',
			boundAt: null,
			updatedAt: new Date().toISOString()
		}).where(eq(userTelegram.userId, userId)).run();
		return this.get(c, userId);
	},

	async consumeBinding(c, code, chat) {
		const codeHash = await hashCode(code);
		const binding = await orm(c).select().from(telegramBinding).where(and(
			eq(telegramBinding.codeHash, codeHash),
			gt(telegramBinding.expiresAt, new Date().toISOString())
		)).get();
		if (!binding) return null;

		const owner = await orm(c).select().from(user).where(eq(user.userId, binding.userId)).get();
		const config = await this.get(c, binding.userId);
		if (!owner || owner.isDel !== isDel.NORMAL || owner.status !== userConst.status.NORMAL || !config.authorized) {
			return null;
		}
		await orm(c).insert(userTelegram).values({
				userId: binding.userId,
				authorized: 1,
				chatId: String(chat.id),
				chatUsername: chat.username || '',
				boundAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}).onConflictDoUpdate({
				target: userTelegram.userId,
				set: {
					chatId: String(chat.id),
					chatUsername: chat.username || '',
					boundAt: new Date().toISOString(),
					pushEnabled: 0,
					updatedAt: new Date().toISOString()
				}
			}).run();
		await orm(c).delete(telegramBinding).where(eq(telegramBinding.codeHash, codeHash)).run();
		return binding.userId;
	},

	async recipient(c, userId) {
		return orm(c).select({ chatId: userTelegram.chatId }).from(userTelegram)
			.where(and(eq(userTelegram.userId, userId), eq(userTelegram.authorized, 1), eq(userTelegram.pushEnabled, 1)))
			.get();
	}
};

export default userTelegramService;
