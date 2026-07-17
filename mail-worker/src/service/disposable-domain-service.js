import { disposableDomains } from '../const/disposable-domains';

const disposableDomainService = {
	isDisposable(email) {
		const domain = String(email || '').trim().split('@').pop().toLowerCase().replace(/\.+$/, '');
		const labels = domain.split('.');

		for (let index = 0; index < labels.length - 1; index += 1) {
			if (disposableDomains.has(labels.slice(index).join('.'))) {
				return true;
			}
		}

		return false;
	},
};

export default disposableDomainService;
