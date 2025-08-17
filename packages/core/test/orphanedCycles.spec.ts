import { expect } from 'chai'
import { NamedNode, Quad, Store } from 'n3'
import { foaf } from 'rdf-namespaces'
import { LdhopEngine } from '../src/LdhopEngine.js'
import { friendOfAFriendQuery, Var } from './queries.js'
import { fetchRdf } from './resources/index.js'
import { run } from './run.js'

describe.skip('Handling orphaned cycles in LdhopEngine', () => {
  it('should clear disconnected cycles', async () => {
    const resource = 'https://personx.example/profile/card'
    const personx = resource + '#me'
    const engine = new LdhopEngine(friendOfAFriendQuery, {
      [Var.person]: new Set([personx]),
    })

    await run(engine)

    const personsBefore = engine.getVariable(Var.person)
    expect(personsBefore).to.have.length(7)
    const moveSizeBefore = engine.moves.list.size

    const personWithoutConnection = new Store(fetchRdf(resource))

    personWithoutConnection.removeQuad(
      new Quad(
        new NamedNode(personx),
        new NamedNode(foaf.knows),
        new NamedNode('https://person2.example/profile/card#me'),
        new NamedNode(resource),
      ),
    )
    engine.addGraph(resource, [...personWithoutConnection] as Quad[])
    const personsAfter = engine.getVariable(Var.person)
    expect(engine.moves.list.size).to.be.lessThan(moveSizeBefore)
    expect(personsAfter).to.have.length(3)
  })
})
