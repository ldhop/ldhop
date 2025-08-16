import { expect } from 'chai'
import { NamedNode, Quad, Store } from 'n3'
import { foaf } from 'rdf-namespaces'
import { QueryAndStore } from '../../src/QueryAndStore.js'
import { friendOfAFriendQuery } from '../queries.js'
import { fetchRdf } from '../resources/index.js'
import { run } from '../run.js'

describe.skip('Handling orphaned cycles in QueryAndStore', () => {
  it('should clear disconnected cycles', async () => {
    const resource = 'https://personx.example/profile/card'
    const personx = resource + '#me'
    const qas = new QueryAndStore(friendOfAFriendQuery, {
      person: new Set([personx]),
    })

    await run(qas)

    const personsBefore = qas.getVariable('person')
    expect(personsBefore).to.have.length(7)
    const moveSizeBefore = qas.moves.list.size

    const personWithoutConnection = new Store(fetchRdf(resource))

    personWithoutConnection.removeQuad(
      new Quad(
        new NamedNode(personx),
        new NamedNode(foaf.knows),
        new NamedNode('https://person2.example/profile/card#me'),
        new NamedNode(resource),
      ),
    )
    qas.addResource(resource, [...personWithoutConnection] as Quad[])
    const personsAfter = qas.getVariable('person')
    expect(qas.moves.list.size).to.be.lessThan(moveSizeBefore)
    expect(personsAfter).to.have.length(3)
  })
})
