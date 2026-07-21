import http from '@/axios/index.js';

export function settingSet(setting) {
    return http.put('/setting/set', setting)
}

export function settingQuery() {
    return http.get('/setting/query')
}

export function websiteConfig() {
    return http.get('/setting/websiteConfig')
}

export function setBackground(background) {
    return http.put('/setting/setBackground',{background})
}

export function deleteBackground() {
    return http.delete('/setting/deleteBackground')
}

export function setBlackList(params) {
    return http.put('/setting/setBlacklist', params)
}

export function setPwaIcon(pwaIcon) {
    return http.put('/setting/setPwaIcon', {pwaIcon})
}

export function deletePwaIcon() {
    return http.delete('/setting/deletePwaIcon')
}

export function configureTelegramWebhook() {
    return http.post('/setting/configureTelegramWebhook')
}
