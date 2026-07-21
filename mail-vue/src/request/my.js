import http from '@/axios/index.js';

export function loginUserInfo() {
    return http.get('/my/loginUserInfo')
}

export function resetPassword(password) {
    return http.put('/my/resetPassword', {password})
}

export function userDelete() {
    return http.delete('/my/delete')
}

export function telegramConfig() {
    return http.get('/my/telegram')
}

export function createTelegramBinding() {
    return http.post('/my/telegram/binding')
}

export function setTelegramPush(enabled) {
    return http.put('/my/telegram/push', { enabled })
}

export function unbindTelegram() {
    return http.delete('/my/telegram')
}

