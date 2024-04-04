import { expect } from 'chai'
import { foaf } from 'rdf-namespaces'
import { QueryAndStore } from '../src/QueryAndStore.js'
import { friendOfAFriendQuery } from './queries.js'
import { fetchRdf } from './resources/index.js'
import { run } from './run.js'

describe('blank nodes', () => {
  it('should handle blank nodes correctly', () => {
    const base = 'https://blank.example/profile/card'
    const qas = new QueryAndStore(friendOfAFriendQuery, {
      person: new Set([base + '#me']),
    })

    run(qas)

    const persons = qas.getVariable('person')
    // console.log(persons)
    expect(persons).to.have.length(6)

    const testPerson = fetchRdf(base)

    const testPersonWithoutLinks = testPerson.filter(
      ({ predicate }) => predicate.value !== foaf.knows,
    )

    qas.addResource(base, testPerson)
    run(qas)
    expect(qas.getVariable('person')).to.have.length(6)
    expect(qas.moves.list.size).to.equal(7)

    qas.addResource(base, testPersonWithoutLinks)
    run(qas)
    expect(qas.getVariable('person')).to.have.length(1)
    expect(qas.moves.list.size).to.equal(1)

    qas.addResource(base, testPerson)
    run(qas)
    expect(qas.getVariable('person')).to.have.length(6)
    expect(qas.moves.list.size).to.equal(7)
  })
})
