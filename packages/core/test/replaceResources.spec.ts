import { expect } from 'chai'
import { NamedNode, Quad } from 'n3'
import { sioc } from 'rdf-namespaces'
import { LdhopEngine } from '../src/index.js'
import {
  chatsWithPerson,
  friendOfAFriendQuery,
  personAccommodationsQuery,
  Var,
} from './queries.js'
import { hospex } from './rdf-namespaces.js'
import { fetchRdf } from './resources/index.js'
import { run } from './run.js'

describe('Replacing resources in LdhopEngine', () => {
  it('[remove link] should correctly update the results', async () => {
    const engine = new LdhopEngine(personAccommodationsQuery, {
      [Var.person]: new Set(['https://person.example/profile/card#me']),
      [Var.community]: new Set(['https://community.example/community#us']),
    })

    await run(engine)

    const offersBefore = engine.getVariable(Var.offer)
    expect(offersBefore).to.have.length(2)

    // add the community document without the link to one of the offers
    const quads = fetchRdf(
      'https://person.example/hospex/community-example/card',
    )

    const updated = quads.filter(
      q =>
        !(
          q.subject.value === 'https://person.example/profile/card#me' &&
          q.predicate.value === 'http://w3id.org/hospex/ns#offers' &&
          q.object.value ===
            'https://person.example/hospex/community-example/accommodation1#accommodation'
        ),
    )

    engine.addGraph(
      'https://person.example/hospex/community-example/card',
      updated,
    )

    await run(engine)

    const offersAfter = engine.getVariable(Var.offer)
    expect(offersAfter).to.have.length(1)
  })

  it('[add link] should correctly update the results', async () => {
    const engine = new LdhopEngine(personAccommodationsQuery, {
      [Var.person]: new Set(['https://person.example/profile/card#me']),
      [Var.community]: new Set(['https://community.example/community#us']),
    })

    await run(engine)

    const offersBefore = engine.getVariable(Var.offer)
    expect(offersBefore).to.have.length(2)

    // add the community document with additional offer
    const quads = fetchRdf(
      'https://person.example/hospex/community-example/card',
    )
    quads.push(
      new Quad(
        new NamedNode('https://person.example/profile/card#me'),
        new NamedNode(hospex.offers),
        new NamedNode(
          'https://person.example/hospex/community-example/accommodation2#accommodation',
        ),
        new NamedNode('https://person.example/hospex/community-example/card'),
      ),
    )

    engine.addGraph(
      'https://person.example/hospex/community-example/card',
      quads,
    )

    await run(engine)

    const offersAfter = engine.getVariable(Var.offer)
    expect(offersAfter).to.have.length(3)
  })

  it('[remove community] should correctly update the results', async () => {
    const engine = new LdhopEngine(personAccommodationsQuery, {
      [Var.person]: new Set(['https://person.example/profile/card#me']),
      [Var.community]: new Set(['https://community.example/community#us']),
    })

    await run(engine)

    const offersBefore = engine.getVariable(Var.offer)
    expect(offersBefore).to.have.length(2)

    // add the community document without the link to one of the offers
    const quads = fetchRdf(
      'https://person.example/hospex/community-example/card',
    )

    const updated = quads.filter(
      q =>
        !(
          q.subject.value === 'https://person.example/profile/card#me' &&
          q.predicate.value === sioc.member_of
        ),
    )

    engine.addGraph(
      'https://person.example/hospex/community-example/card',
      updated,
    )

    await run(engine)

    const offersAfter = engine.getVariable(Var.offer)
    expect(offersAfter).to.have.length(0)
  })

  it('should work fine with hopping in circles', async () => {
    const engine = new LdhopEngine(friendOfAFriendQuery, {
      [Var.person]: new Set(['https://person.example/profile/card#me']),
    })

    await run(engine)

    const personsBefore = engine.getVariable(Var.person)
    expect(personsBefore).to.have.length(4)

    engine.addGraph('https://person2.example/profile/card', [])

    await run(engine)

    const personsAfter = engine.getVariable(Var.person)
    // there will be remaining person and person2
    expect(personsAfter).to.have.length(2)
    expect(engine.moves.list.size).to.equal(2)

    // now, let's try to revert it
    const person2 = fetchRdf('https://person2.example/profile/card')
    engine.addGraph('https://person2.example/profile/card', person2)
    await run(engine)
    expect(engine.getVariable(Var.person)).to.have.length(4)
  })

  it('should allow replacing all resources with empty resources', async () => {
    const engine = new LdhopEngine(chatsWithPerson, {
      [Var.person]: new Set(['https://person.example/profile/card#me']),
      [Var.otherPerson]: new Set(['https://person2.example/profile/card#me']),
    })
    expect(engine.getVariable(Var.person)).to.have.length(1)
    expect(engine.getVariable(Var.person)).to.have.length(1)

    await run(engine)

    const messages = engine.getVariable(Var.message)

    expect(messages).to.have.length(23)

    const resources = engine.store
      .getGraphs(null, null, null)
      .map(g => g.value)
      .filter(r => !r.includes('ldhop.example'))

    resources.forEach(resource => engine.addGraph(resource, []))

    // only initial variable moves stay
    expect(engine.moves.list.size).to.equal(2)
    expect(engine.getAllVariablesAsStringSets()).to.deep.equal({
      [Var.person]: new Set(['https://person.example/profile/card#me']),
      [Var.otherPerson]: new Set(['https://person2.example/profile/card#me']),
    })
  })
})
