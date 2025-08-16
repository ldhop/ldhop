import { expect } from 'chai'
import { NamedNode, Quad } from 'n3'
import { rdf, sioc } from 'rdf-namespaces'
import { QueryAndStore } from '../../src/QueryAndStore.js'
import {
  chatsWithPerson,
  friendOfAFriendQuery,
  personAccommodationsQuery2,
} from '../queries.js'
import { hospex } from '../rdf-namespaces.js'
import { fetchRdf } from '../resources/index.js'
import { run } from '../run.js'

describe('Replacing resources in QueryAndStore', () => {
  it('[remove link] should correctly update the results', async () => {
    const qas = new QueryAndStore(personAccommodationsQuery2, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    await run(qas)

    const offersBefore = qas.getVariable('offer')
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

    qas.addResource(
      'https://person.example/hospex/community-example/card',
      updated,
    )

    await run(qas)

    const offersAfter = qas.getVariable('offer')
    expect(offersAfter).to.have.length(1)

    // test that only one accommodation remains in the retrieved store
    const matches = [
      ...qas.store.match(
        new NamedNode('https://person.example/profile/card#me'),
        new NamedNode(hospex.offers),
        null,
        null,
      ),
    ]

    expect(matches).to.have.length(1)
  })

  it('[add link] should correctly update the results', async () => {
    const qas = new QueryAndStore(personAccommodationsQuery2, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    await run(qas)

    const offersBefore = qas.getVariable('offer')
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

    qas.addResource(
      'https://person.example/hospex/community-example/card',
      quads,
    )

    await run(qas)

    const offersAfter = qas.getVariable('offer')
    expect(offersAfter).to.have.length(3)

    // test that there are 3 accommodations now
    const matches = [
      ...qas.store.match(
        new NamedNode('https://person.example/profile/card#me'),
        new NamedNode(hospex.offers),
        null,
        null,
      ),
    ]

    expect(matches).to.have.length(3)

    expect(
      qas.store.match(
        null,
        new NamedNode(rdf.type),
        new NamedNode(hospex.Accommodation),
      ).size,
    ).to.equal(3)
  })

  it('[remove community] should correctly update the results', async () => {
    const qas = new QueryAndStore(personAccommodationsQuery2, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    await run(qas)

    const offersBefore = qas.getVariable('offer')
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

    qas.addResource(
      'https://person.example/hospex/community-example/card',
      updated,
    )

    await run(qas)

    const offersAfter = qas.getVariable('offer')
    expect(offersAfter).to.have.length(0)

    // test that there are 3 accommodations now
    const matches = [
      ...qas.store.match(
        new NamedNode('https://person.example/profile/card#me'),
        new NamedNode(hospex.offers),
        null,
        null,
      ),
    ]

    expect(matches).to.have.length(0)

    expect(
      qas.store.match(
        null,
        new NamedNode(rdf.type),
        new NamedNode(hospex.Accommodation),
      ).size,
    ).to.equal(0)
  })

  it('should work fine with hopping in circles', async () => {
    const qas = new QueryAndStore(friendOfAFriendQuery, {
      person: new Set(['https://person.example/profile/card#me']),
    })

    await run(qas)

    const personsBefore = qas.getVariable('person')
    expect(personsBefore).to.have.length(4)

    qas.addResource('https://person2.example/profile/card', [])

    await run(qas)

    const personsAfter = qas.getVariable('person')
    // there will be remaining person and person2
    expect(personsAfter).to.have.length(2)
    expect(qas.moves.list.size).to.equal(2)

    // now, let's try to revert it
    const person2 = fetchRdf('https://person2.example/profile/card')
    qas.addResource('https://person2.example/profile/card', person2)
    await run(qas)
    expect(qas.getVariable('person')).to.have.length(4)
  })

  it('should allow replacing all resources with empty resources', async () => {
    const qas = new QueryAndStore(chatsWithPerson, {
      person: new Set(['https://person.example/profile/card#me']),
      otherPerson: new Set(['https://person2.example/profile/card#me']),
    })
    expect(qas.getVariable('person')).to.have.length(1)

    await run(qas)

    const messages = qas.getVariable('message')

    expect(messages).to.have.length(23)

    const resources = qas.store
      .getGraphs(null, null, null)
      .map(g => g.value)
      .filter(r => !r.includes('ldhop.example'))

    resources.forEach(resource => qas.addResource(resource, []))

    // only initial variable moves stay
    expect(qas.moves.list.size).to.equal(2)
    expect(qas.getAllVariables()).to.deep.equal({
      person: new Set(['https://person.example/profile/card#me']),
      otherPerson: new Set(['https://person2.example/profile/card#me']),
    })
  })
})
