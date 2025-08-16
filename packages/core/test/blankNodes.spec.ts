import { expect } from 'chai'
import { foaf } from 'rdf-namespaces'
import { LdhopEngine } from '../src/index.js'
import { friendOfAFriendQuery, Var } from './queries.js'
import { fetchRdf } from './resources/index.js'
import { run } from './run.js'

describe(`blank nodes in ${LdhopEngine.name}`, () => {
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

    console.log(engine.getVariable(Var.person), '---')
    engine.addResource(base, testPerson)
    console.log(engine.getVariable(Var.person), '---')
    await run(engine)
    console.log(engine.getVariable(Var.person), '---')
    // console.log(engine.moves.list, '****')
    expect(engine.getVariable(Var.person)).to.have.length(6)
    // console.log(engine.moves.list, '****')
    expect(engine.moves.list.size).to.equal(7)

    engine.addResource(base, testPersonWithoutLinks)
    await run(engine)
    expect(engine.getVariable(Var.person)).to.have.length(1)
    expect(engine.moves.list.size).to.equal(1)

    engine.addResource(base, testPerson)
    await run(engine)
    console.log(engine.getVariable(Var.person))
    expect(engine.getVariable(Var.person)).to.have.length(6)
    expect(engine.moves.list.size).to.equal(7)
  })
})
