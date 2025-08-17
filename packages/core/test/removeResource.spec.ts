import { expect } from 'chai'
import { LdhopEngine } from '../src/index.js'
import { inboxMessagesQuery, Var } from './queries.js'
import { run } from './run.js'

describe('Removing resource from LdhopEngine', () => {
  it('[remove link] should correctly update the results', async () => {
    // first run the normal query
    const engine = new LdhopEngine(inboxMessagesQuery, {
      [Var.person]: new Set(['https://person.example/profile/card#me']),
    })

    await run(engine)

    const notificationsBefore = engine.getVariable(Var.longChatNotification)
    expect(notificationsBefore).to.have.length(2)

    // then delete the notification - replace resource with empty
    engine.addGraph('https://person.example/inbox/notification1', [])

    await run(engine)

    const notificationsAfter = engine.getVariable(Var.longChatNotification)
    expect(notificationsAfter).to.have.length(1)
  })
})
