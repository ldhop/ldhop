import { expect } from 'chai'
import { QueryAndStore } from '../../src/QueryAndStore.js'
import { inboxMessagesQuery } from '../queries.js'
import { run } from '../run.js'

describe('Removing resource from QueryAndStore', () => {
  it('[remove link] should correctly update the results', async () => {
    // first run the normal query
    const qas = new QueryAndStore(inboxMessagesQuery, {
      person: new Set(['https://person.example/profile/card#me']),
    })

    await run(qas)

    const notificationsBefore = qas.getVariable('longChatNotification')
    expect(notificationsBefore).to.have.length(2)

    // then delete the notification - replace resource with empty
    qas.addResource('https://person.example/inbox/notification1', [])

    await run(qas)

    const notificationsAfter = qas.getVariable('longChatNotification')
    expect(notificationsAfter).to.have.length(1)
  })
})
