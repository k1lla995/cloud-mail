import http from '@/axios/index.js'

export function contactList(params) {
    return http.get('/contact/list', {params})
}

export function recentRecipientList(params) {
    return http.get('/contact/recent-recipients', {params})
}

export function contactAdd(contact) {
    return http.post('/contact/add', contact)
}

export function contactDelete(contactIds) {
    return http.delete('/contact/delete', {params: {contactIds: contactIds.join(',')}})
}

export function contactHistory(contactId) {
    return http.get('/contact/history', {params: {contactId}})
}
