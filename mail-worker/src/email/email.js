import PostalMime from 'postal-mime';
import emailService from '../service/email-service';
import accountService from '../service/account-service';
import settingService from '../service/setting-service';
import attService from '../service/att-service';
import constant from '../const/constant';
import fileUtils from '../utils/file-utils';
import { emailConst, isDel, recycleReasonConst, settingConst } from '../const/entity-const';
import emailUtils from '../utils/email-utils';
import roleService from '../service/role-service';
import userService from '../service/user-service';
import telegramService from '../service/telegram-service';
import aiService from '../service/ai-service';
import adminUtils from '../utils/admin-utils';
import disposableDomainService from '../service/disposable-domain-service';
import { resolveRecycleReason } from '../utils/recycle-reason-utils';

export async function email(message, env, ctx) {

	try {

		const {
			receive,
			forwardStatus,
			forwardEmail,
			ruleEmail,
			ruleType,
			r2Domain,
			noRecipient,
			blackSubject,
			blackContent,
			blackFrom,
			aiCode,
			aiCodeFilter
		} = await settingService.query({ env });

		if (receive === settingConst.receive.CLOSE) {
			message.setReject('Service suspended');
			return;
		}

		const reader = message.raw.getReader();
		let content = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			content += new TextDecoder().decode(value);
		}

		const email = await PostalMime.parse(content);


		const ruleReason = checkBlock(blackSubject, blackContent, blackFrom, email);
		const spamFlag = checkSpam(email);
		const disposableDomainFlag = disposableDomainService.isDisposable(email.from?.address);

		const account = await accountService.selectByEmailIncludeDel({ env: env }, message.to);

		if (!account && noRecipient === settingConst.noRecipient.CLOSE) {
			message.setReject('Recipient not found');
			return;
		}

		let userRow = {}

		if (account) {
			 userRow = await userService.selectByIdIncludeDel({ env: env }, account.userId);
		}

		let recipientBlocked = false;
		if (account && !adminUtils.isAdminUser(userRow, env.admin)) {

			let { banEmail, availDomain } = await roleService.selectByUserId({ env: env }, account.userId);

			if (!roleService.hasAvailDomainPerm(availDomain, message.to)) {
				message.setReject('The recipient is not authorized to use this domain.');
				return;
			}

			if(roleService.isBanEmail(banEmail, email.from.address)) {
				recipientBlocked = true;
			}

		}


		if (!email.to) {
			email.to = [{ address: message.to, name: emailUtils.getName(message.to)}]
		}

		const toName = email.to.find(item => item.address === message.to)?.name || '';
		const code = await aiService.extractCode({ env }, email, { aiCode, aiCodeFilter });

		const recycleReason = resolveRecycleReason({
			automaticSpam: spamFlag || disposableDomainFlag,
			manualRule: ruleReason === recycleReasonConst.MANUAL_RULE,
			blacklisted: ruleReason === recycleReasonConst.BLACKLIST || recipientBlocked
		});
		const moveToRecycle = recycleReason != null;
		const params = {
			toEmail: message.to,
			toName: toName,
			sendEmail: email.from.address,
			name: email.from.name || emailUtils.getName(email.from.address),
			subject: email.subject,
			code,
			content: email.html,
			text: email.text,
			cc: email.cc ? JSON.stringify(email.cc) : '[]',
			bcc: email.bcc ? JSON.stringify(email.bcc) : '[]',
			recipient: JSON.stringify(email.to),
			inReplyTo: email.inReplyTo,
			relation: email.references,
			messageId: email.messageId,
			userId: account ? account.userId : 0,
			accountId: account ? account.accountId : 0,
			isDel: isDel.DELETE,
			deleteTime: moveToRecycle ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
			recycleReason,
			status: emailConst.status.SAVING
		};

		const attachments = [];
		const cidAttachments = [];

		for (let item of email.attachments) {
			let attachment = { ...item };
			attachment.key = constant.ATTACHMENT_PREFIX + await fileUtils.getBuffHash(attachment.content) + fileUtils.getExtFileName(item.filename);
			attachment.size = item.content.length ?? item.content.byteLength;
			attachments.push(attachment);
			if (attachment.contentId) {
				cidAttachments.push(attachment);
			}
		}

		let emailRow = await emailService.receive({ env }, params, cidAttachments, r2Domain);

		attachments.forEach(attachment => {
			attachment.emailId = emailRow.emailId;
			attachment.userId = emailRow.userId;
			attachment.accountId = emailRow.accountId;
		});

		try {
			if (attachments.length > 0) {
				await attService.addAtt({ env }, attachments);
			}
		} catch (e) {
			console.error(e);
		}

		emailRow = await emailService.completeReceive({ env }, account ? emailConst.status.RECEIVE : emailConst.status.NOONE, emailRow.emailId, moveToRecycle, recycleReason);

		if (moveToRecycle) {
			return;
		}


		if (ruleType === settingConst.ruleType.RULE) {

			const emails = ruleEmail.split(',');

			if (!emails.includes(message.to)) {
				return;
			}

		}

		//转发到TG
		await telegramService.sendEmailToUser({ env }, emailRow)

		//转发到其他邮箱
		if (forwardStatus === settingConst.forwardStatus.OPEN && forwardEmail) {

			const emails = forwardEmail.split(',');

			await Promise.all(emails.map(async email => {

				try {
					await message.forward(email);
				} catch (e) {
					console.error(`转发邮箱 ${email} 失败：`, e);
				}

			}));

		}

	} catch (e) {
		console.error('邮件接收异常: ', e);
		throw e
	}
}

function checkBlock(blackSubjectStr, blackContentStr, blackFromStr, email) {

	const blackFromList = blackFromStr ? blackFromStr.split(',') : []
	const blackContentList = blackContentStr ? blackContentStr.split(',') : []
	const blackSubjectList = blackSubjectStr ? blackSubjectStr.split(',') : []

	for (const blackSubject of blackSubjectList) {
		if (email.subject?.includes(blackSubject)) {
			return recycleReasonConst.MANUAL_RULE
		}
	}

	for (const blackContent of blackContentList) {
		if (email.html?.includes(blackContent) || email.text?.includes(blackContent)) {
			return recycleReasonConst.MANUAL_RULE
		}
	}

	for (const blackFrom of blackFromList) {
		if (email.from.address === blackFrom || emailUtils.getDomain(email.from.address) === blackFrom) {
			return recycleReasonConst.BLACKLIST
		}
	}

	return null

}

function checkSpam(email) {
	const spamFlag = getHeader(email.headers, 'x-spam-flag');
	if (/^(?:yes|true|1)$/i.test(spamFlag.trim())) return true;

	const spamStatus = getHeader(email.headers, 'x-spam-status');
	if (/\b(?:yes|spam)\b/i.test(spamStatus)) return true;
	const score = spamStatus.match(/score\s*=\s*(-?\d+(?:\.\d+)?)/i);
	const required = spamStatus.match(/required\s*=\s*(-?\d+(?:\.\d+)?)/i);
	return !!(score && required && Number(score[1]) >= Number(required[1]));
}

function getHeader(headers, name) {
	if (!headers) return '';
	if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase()) || '';
	if (Array.isArray(headers)) {
		const item = headers.find(header => String(header?.key || header?.[0] || '').toLowerCase() === name);
		return item?.value || item?.[1] || '';
	}
	return headers[name] || headers[name.toLowerCase()] || '';
}
