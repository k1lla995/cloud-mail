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
			const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chat_id: chatId,
					parse_mode: 'HTML',
					text: emailMsgTemplate(emailRow, tgMsgTo, tgMsgFrom, tgMsgText),
					reply_markup: { inline_keyboard: inlineKeyboard }
				})
			});
			if (!response.ok) console.error(`Telegram forwarding failed: ${response.status} ${await response.text()}`);
		} catch (error) {
			console.error('Telegram forwarding failed:', error.message);
		}
	},

	async configureWebhook(c) {
		const settings = await settingService.query(c);
		if (!settings.tgBotToken) throw new BizError('Configure a Telegram bot token first');
		const secret = settings.tgWebhookSecret || crypto.randomUUID().replace(/-/g, '');
		const webhookUrl = `${new URL(c.req.url).origin}/api/telegram/webhook`;
		const response = await fetch(`https://api.telegram.org/bot${settings.tgBotToken}/setWebhook`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ['message'] })
		});
		if (!response.ok) throw new BizError(`Telegram webhook setup failed: ${await response.text()}`);
		if (secret !== settings.tgWebhookSecret) {
			await orm(c).update(setting).set({ tgWebhookSecret: secret }).run();
			await settingService.refresh(c);
		}
		return { webhookUrl };
	},

	async handleWebhook(c, update) {
		const settings = await settingService.query(c);
		if (!settings.tgWebhookSecret || c.req.header('X-Telegram-Bot-Api-Secret-Token') !== settings.tgWebhookSecret) {
			throw new BizError('Invalid Telegram webhook', 401);
		}
		const message = update?.message;
		if (message?.chat?.type !== 'private' || typeof message.text !== 'string') return;
		const match = message.text.match(/^\/start(?:\s+bind_?([a-f0-9]{36}))?$/i);
		if (!match?.[1]) return;
		const userId = await userTelegramService.consumeBinding(c, match[1], message.chat);
		if (!userId || !settings.tgBotToken) return;
		const confirmation = fetch(`https://api.telegram.org/bot${settings.tgBotToken}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ chat_id: message.chat.id, text: 'Telegram binding completed. Enable push in Personal Settings.' })
			}).catch(error => console.error('Telegram binding confirmation failed:', error.message));
		c.executionCtx?.waitUntil(confirmation);
	}
};

export default telegramService;
