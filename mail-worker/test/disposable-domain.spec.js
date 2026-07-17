import { describe, expect, it } from 'vitest';
import disposableDomainService from '../src/service/disposable-domain-service';

describe('disposable-domain service', () => {
	it('matches known disposable domains regardless of case', () => {
		expect(disposableDomainService.isDisposable('sender@10minutemail.com')).toBe(true);
		expect(disposableDomainService.isDisposable('SENDER@10MINUTEMAIL.COM')).toBe(true);
	});

	it('matches subdomains listed under a disposable parent domain', () => {
		expect(disposableDomainService.isDisposable('sender@mail.10minutemail.com')).toBe(true);
	});

	it('does not classify ordinary email domains as disposable', () => {
		expect(disposableDomainService.isDisposable('sender@example.com')).toBe(false);
	});
});
