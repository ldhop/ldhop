import { expect } from 'chai'
import { QueryAndStore } from '../src/QueryAndStore'
import { inboxMessagesQuery } from './queries'
import { run } from './run'

describe('Removing resource', () => {
  it('[remove link] should correctly update the results', () => {
    // first run the normal query
    const qas = new QueryAndStore(inboxMessagesQuery, {
      person: new Set(['https://person.example/profile/card#me']),
    })

    run(qas)

    const notificationsBefore = qas.getVariable('longChatNotification')
    expect(notificationsBefore).to.have.length(2)

    // then delete the notification - replace resource with empty
    qas.addResource('https://person.example/inbox/notification1', [])

    run(qas)

    const notificationsAfter = qas.getVariable('longChatNotification')
    expect(notificationsAfter).to.have.length(1)
  })
})
