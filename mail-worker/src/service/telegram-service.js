import orm from '../entity/orm';
import email from '../entity/email';
import setting from '../entity/setting';
import settingService from './setting-service';
import jwtUtils from '../utils/jwt-utils';
import emailMsgTemplate from '../template/email-msg';
import emailTextTemplate from '../template/email-text';
import emailHtmlTemplate from '../template/email-html';
import domainUtils from '../utils/domain-uitls';
import userTelegramService from './user-telegram-service';
import BizError from '../error/biz-error';
import { eq } from 'drizzle-orm';

const BIND_CODE_RE = /^\/start(?:@\w+)?(?:\s+bind_?([a-f0-9]{36}))?\s*$/i;

async function telegramApi(token, method, body = {}) {
	const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body ?? {})
	});
	const raw = await response.text();
	let payload = null;
	try {
		payload = raw ? JSON.parse(raw) : null;
	} catch {
		payload = null;
	}
	if (!response.ok || !payload?.ok) {
		const detail = payload?.description || raw || `HTTP ${response.status}`;
		throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
	}
	return payload.result;
}

async function schedule(c, promise) {
	if (c.executionCtx?.waitUntil) {
		c.executionCtx.waitUntil(promise);
		return;
	}
	await promise;
}

async function replyTelegram(token, chatId, text) {
	if (!token || chatId == null) return;
	await telegramApi(token, 'sendMessage', { chat_id: chatId, text });
}

const telegramService = {
	async getEmailContent(c, params) {
		const result = await jwtUtils.verifyToken(c, params.token);
		if (!result) return emailTextTemplate('Access denied');
		const emailRow = await orm(c).select().from(email).where(eq(email.emailId, result.emailId)).get();
		if (!emailRow) return emailTextTemplate('The email does not exist');
		if (emailRow.content) {
			const { r2Domain } = await settingService.query(c);
			return emailHtmlTemplate(emailRow.content, r2Domain);
		}
		return emailTextTemplate(emailRow.text || '');
	},

	async sendEmailToUser(c, emailRow) {
		const recipient = await userTelegramService.recipient(c, emailRow.userId);
		if (!recipient?.chatId) return;
		await this.sendEmailToBot(c, emailRow, recipient.chatId);
	},

	async sendEmailToBot(c, emailRow, chatId) {
		const { tgBotToken, customDomain, tgMsgTo, tgMsgFrom, tgMsgText } = await settingService.query(c);
		if (!tgBotToken) return;
		const jwtToken = await jwtUtils.generateToken(c, { emailId: emailRow.emailId }, 60 * 60 * 24);
		const webAppUrl = customDomain
			? `${domainUtils.toOssDomain(customDomain)}/api/telegram/getEmail/${jwtToken}`
			: 'https://www.cloudflare.com/404';
		const inlineKeyboard = [[{ text: 'View', web_app: { url: webAppUrl } }]];
		if (emailRow.code) inlineKeyboard.push([{ text: emailRow.code, copy_text: { text: emailRow.code } }]);

		try {
			await telegramApi(tgBotToken, 'sendMessage', {
				chat_id: chatId,
				parse_mode: 'HTML',
				text: emailMsgTemplate(emailRow, tgMsgTo, tgMsgFrom, tgMsgText),
				reply_markup: { inline_keyboard: inlineKeyboard }
			});
		} catch (error) {
			console.error('Telegram forwarding failed:', error.message);
		}
	},

	async configureWebhook(c) {
		// Always read a fresh copy from DB/KV after potential earlier mutations in the request.
		await settingService.refresh(c);
		const settings = await settingService.query(c);
		if (!settings.tgBotToken) throw new BizError('Configure a Telegram bot token first');

		// Rotate secret every time so Telegram and DB never drift after accidental empty overwrites.
		const secret = crypto.randomUUID().replace(/-/g, '');
		const webhookUrl = `${new URL(c.req.url).origin}/api/telegram/webhook`;

		try {
			await telegramApi(settings.tgBotToken, 'setWebhook', {
				url: webhookUrl,
				secret_token: secret,
				allowed_updates: ['message'],
				drop_pending_updates: false
			});
		} catch (error) {
			throw new BizError(`Telegram webhook setup failed: ${error.message}`);
		}

		await orm(c).update(setting).set({ tgWebhookSecret: secret }).run();
		await settingService.refresh(c);

		let webhookInfo = null;
		try {
			webhookInfo = await telegramApi(settings.tgBotToken, 'getWebhookInfo', {});
		} catch (error) {
			console.warn('getWebhookInfo failed:', error.message);
		}

		return {
			webhookUrl,
			hasSecret: true,
			webhookInfo: webhookInfo ? {
				url: webhookInfo.url,
				pendingUpdateCount: webhookInfo.pending_update_count,
				lastErrorMessage: webhookInfo.last_error_message || '',
				lastErrorDate: webhookInfo.last_error_date || null
			} : null
		};
	},

	async handleWebhook(c, update) {
		const settings = await settingService.query(c);
		const headerSecret = c.req.header('X-Telegram-Bot-Api-Secret-Token') || c.req.header('x-telegram-bot-api-secret-token') || '';
		if (!settings.tgWebhookSecret || headerSecret !== settings.tgWebhookSecret) {
			console.error('Invalid Telegram webhook secret', {
				hasConfiguredSecret: Boolean(settings.tgWebhookSecret),
				hasHeaderSecret: Boolean(headerSecret)
			});
			throw new BizError('Invalid Telegram webhook', 401);
		}

		const message = update?.message;
		if (!message?.chat || message.chat.type !== 'private') return;
		if (typeof message.text !== 'string') return;

		const match = message.text.trim().match(BIND_CODE_RE);
		if (!match) return;

		const bindCode = match[1];
		if (!bindCode) {
			await schedule(c, replyTelegram(
				settings.tgBotToken,
				message.chat.id,
				'Please generate a binding command in Personal Settings, then send it here.\n请先在网站「个人设置」生成绑定命令后再发送。'
			).catch(error => console.error('Telegram help reply failed:', error.message)));
			return;
		}

		const result = await userTelegramService.consumeBinding(c, bindCode, message.chat);
		if (result?.ok) {
			await schedule(c, replyTelegram(
				settings.tgBotToken,
				message.chat.id,
				'Telegram binding completed. Enable the push switch in Personal Settings to receive emails.\n绑定成功。请回到网站「个人设置」打开推送开关后才会转发邮件。'
			).catch(error => console.error('Telegram binding confirmation failed:', error.message)));
			return;
		}

		const reason = result?.reason || 'invalid';
		const tips = {
			expired: 'Binding code expired or already used. Generate a new one in Personal Settings (valid 10 minutes).\n绑定码已过期或已使用，请在个人设置重新生成（10分钟内有效）。',
			unauthorized: 'This account is not authorized for Telegram push. Ask the root admin to authorize it first.\n该账号未授权 Telegram 推送，请联系站长授权。',
			invalid: 'Invalid binding code. Copy the full command from Personal Settings and try again.\n绑定码无效，请从个人设置复制完整命令后重试。'
		};

		await schedule(c, replyTelegram(
			settings.tgBotToken,
			message.chat.id,
			tips[reason] || tips.invalid
		).catch(error => console.error('Telegram bind failure reply failed:', error.message)));
	}
};

export default telegramService;
