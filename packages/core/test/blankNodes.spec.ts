import { expect } from 'chai'
import { foaf } from 'rdf-namespaces'
import { LdhopEngine } from '../src/index.js'
import { friendOfAFriendQuery, Var } from './queries.js'
import { fetchRdf } from './resources/index.js'
import { run } from './run.js'

describe('Blank nodes in LdhopEngine', () => {
  it('should handle blank nodes correctly', async () => {
    const base = 'https://blank.example/profile/card'
    const engine = new LdhopEngine(friendOfAFriendQuery, {
      [Var.person]: new Set([`${base}#me`]),
    })

    await run(engine)

    const persons = engine.getVariable(Var.person)
    expect(persons).to.have.length(6)

    const testPerson = fetchRdf(base)

    const testPersonWithoutLinks = testPerson.filter(
      ({ predicate }) => predicate.value !== foaf.knows,
    )

    engine.addResource(base, testPerson)
    await run(engine)
    expect(engine.getVariable(Var.person)).to.have.length(6)
    expect(engine.moves.list.size).to.equal(7)

    engine.addResource(base, testPersonWithoutLinks)
    await run(engine)
    expect(engine.getVariable(Var.person)).to.have.length(1)
    expect(engine.moves.list.size).to.equal(1)

    engine.addResource(base, testPerson)
    await run(engine)
    expect(engine.getVariable(Var.person)).to.have.length(6)
    expect(engine.moves.list.size).to.equal(7)
  })
})
