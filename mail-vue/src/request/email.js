import http from '@/axios/index.js';

export function emailList(accountId, allReceive, emailId, timeSort, size, type) {
    return http.get('/email/list', {params: {accountId, allReceive, emailId, timeSort, size, type}})
}

export function emailSearch(params) {
    return http.get('/email/search', {params, noMsg: true})
}

export function emailDelete(emailIds) {
    return http.delete('/email/delete?emailIds=' + emailIds)
}

export function recycleList(emailId, size, timeSort = 0, query = '') {
    return http.get('/email/recycle', { params: { emailId, size, timeSort, query } })
}

export function emailRestore(emailIds) {
    return http.put('/email/restore', { emailIds: emailIds.join(',') })
}

export function emailPermanentDelete(emailIds) {
    return http.delete('/email/permanent', { params: { emailIds: emailIds.join(',') } })
}

export function recycleClear() {
    return http.delete('/email/recycle')
}

export function emailLatest(emailId, accountId, allReceive) {
    return http.get('/email/latest', {params: {emailId, accountId, allReceive}, noMsg: true, timeout: 35 * 1000})
}

export function emailRead(emailIds) {
    return http.put('/email/read', {emailIds})
}

export function emailSend(form,progress) {
    return http.post('/email/send', form,{
        onUploadProgress: (e) => {
            progress(e)
        },
        noMsg: true
    })
}
