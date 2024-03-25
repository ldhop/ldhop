import { expect } from 'chai'
import { NamedNode, Quad } from 'n3'
import { QueryAndStore } from '../src/QueryAndStore'
import {
  chatsWithPerson,
  friendOfAFriendQuery,
  personAccommodationsQuery,
} from './queries'
import { hospex, rdf, sioc } from './rdf-namespaces'
import { fetchRdf } from './resources'
import { run } from './run'

describe('Replacing resources in QueryAndStore', () => {
  it('[remove link] should correctly update the results', () => {
    const qas = new QueryAndStore(personAccommodationsQuery, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    run(qas)

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

    run(qas)

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

  it('[add link] should correctly update the results', () => {
    const qas = new QueryAndStore(personAccommodationsQuery, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    run(qas)

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

    run(qas)

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

  it('[remove community] should correctly update the results', () => {
    const qas = new QueryAndStore(personAccommodationsQuery, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    run(qas)

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

    run(qas)

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

  it('should work fine with hopping in circles', () => {
    const qas = new QueryAndStore(friendOfAFriendQuery, {
      person: new Set(['https://person.example/profile/card#me']),
    })

    run(qas)

    const personsBefore = qas.getVariable('person')
    expect(personsBefore).to.have.length(4)

    qas.addResource('https://person2.example/profile/card', [])

    run(qas)

    const personsAfter = qas.getVariable('person')
    // there will be remaining person and person2
    expect(personsAfter).to.have.length(2)
    expect(qas.moves.list.size).to.equal(2)
  })

  it('should allow replacing all resources with empty resources', () => {
    const qas = new QueryAndStore(chatsWithPerson, {
      person: new Set(['https://person.example/profile/card#me']),
      otherPerson: new Set(['https://person2.example/profile/card#me']),
    })
    expect(qas.getVariable('person')).to.have.length(1)

    run(qas)

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
