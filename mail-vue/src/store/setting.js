import { defineStore } from 'pinia'

export const useSettingStore = defineStore('setting', {
    state: () => ({
        domainList: [],
        settings: {
            r2Domain: '',
            loginOpacity: 1.00,
            loginGlass: 1,
            loginGame: 1,
        },
        lang: '',
    }),
    actions: {

    },
    persist: {
        pick: ['lang'],
    },
})
