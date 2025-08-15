import { expect } from 'chai'
import { LdhopEngine, QueryAndStore } from '../src/index.js'
import { inboxMessagesQuery, Var } from './queries.js'
import { run } from './run.js'

for (const Engine of [QueryAndStore, LdhopEngine]) {
  describe(`Removing resource from ${Engine.name}`, () => {
    it('[remove link] should correctly update the results', async () => {
      // first run the normal query
      const qas = new Engine(inboxMessagesQuery, {
        [Var.person]: new Set(['https://person.example/profile/card#me']),
      })

      await run(qas)

      const notificationsBefore = qas.getVariable(Var.longChatNotification)
      expect(notificationsBefore).to.have.length(2)

      // then delete the notification - replace resource with empty
      qas.addResource('https://person.example/inbox/notification1', [])

      await run(qas)

      const notificationsAfter = qas.getVariable(Var.longChatNotification)
      expect(notificationsAfter).to.have.length(1)
    })
  })
}
