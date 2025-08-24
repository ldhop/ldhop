import { expect } from 'chai'
import { foaf } from 'rdf-namespaces'
import { QueryAndStore } from '../../src/QueryAndStore.js'
import { RdfQuery } from '../../src/types.js'
import { parseRdfToQuads } from '../../src/utils/helpers.js'
import {
  communityAccommodationsQuery,
  communityQuery,
  friendOfAFriendQuery,
  personAccommodationsQuery,
  personAccommodationsQuery2,
} from '../queries.js'
import { fetchRdf } from '../resources/index.js'
import { run } from '../run.js'

describe('Adding resources to QueryAndStore', () => {
  it('should accept array of commands, and initial variables', () => {
    const qas = new QueryAndStore(communityAccommodationsQuery, {
      community: new Set(['https://community.example/community#us']),
    })

    expect(qas).to.exist
    expect(qas.store.size).to.equal(3)
  })

  it('should accept a resource and make step through it', () => {
    const qas = new QueryAndStore(communityAccommodationsQuery, {
      community: new Set(['https://community.example/community#us']),
    })

    const resources = qas.getMissingResources()
    expect(resources)
      .to.have.length(1)
      .and.to.deep.equal(['https://community.example/community'])

    const communityResource = resources[0]

    const data = fetchRdf(communityResource)

    qas.addResource(communityResource, data)

    const resourcesAfter = qas.getMissingResources()
    expect(resourcesAfter)
      .to.have.length(1)
      .and.to.deep.equal(['https://community.example/group'])
  })

  it("should make steps through person's profile and find all accommodation offers of the community", async () => {
    const qas = new QueryAndStore(personAccommodationsQuery, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    await run(qas)

    const offers = qas.getVariable('offer')

    expect(offers).to.have.length(2)
  })

  it("should make steps through person's profile and find all accommodation offers of the community (2)", async () => {
    const qas = new QueryAndStore(personAccommodationsQuery2, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    await run(qas)

    const offers = qas.getVariable('offer')

    expect(offers).to.have.length(2)
  })

  it('should not miss unused variables', () => {
    const qas = new QueryAndStore(communityQuery, {
      community: new Set(['https://community.example/community#us']),
    })

    const resources = qas.getMissingResources()
    expect(resources)
      .to.have.length(1)
      .and.to.deep.equal(['https://community.example/community'])

    const communityResource = resources[0]

    const data = fetchRdf(communityResource)

    qas.addResource(communityResource, data)

    const resourcesAfter = qas.getMissingResources()
    expect(resourcesAfter)
      .to.have.length(1)
      .and.to.deep.equal(['https://community.example/group'])

    const groupData = fetchRdf(resourcesAfter[0])
    qas.addResource(resourcesAfter[0], groupData)

    const missingAfter = qas.getMissingResources()
    expect(missingAfter).to.have.length(0)
  })

  it('should miss used variables', () => {
    const qas = new QueryAndStore(
      (communityQuery as RdfQuery).concat({
        type: 'add resources',
        variable: '?person',
      }),
      {
        community: new Set(['https://community.example/community#us']),
      },
    )

    const resources = qas.getMissingResources()
    expect(resources)
      .to.have.length(1)
      .and.to.deep.equal(['https://community.example/community'])

    const communityResource = resources[0]

    const data = fetchRdf(communityResource)

    qas.addResource(communityResource, data)

    const resourcesAfter = qas.getMissingResources()
    expect(resourcesAfter)
      .to.have.length(1)
      .and.to.deep.equal(['https://community.example/group'])

    const groupData = fetchRdf(resourcesAfter[0])
    qas.addResource(resourcesAfter[0], groupData)

    const missingAfter = qas.getMissingResources()
    expect(missingAfter).to.have.length(3)
  })

  it('should not save duplicate moves', async () => {
    const qas = new QueryAndStore(personAccommodationsQuery2, {
      community: new Set(['https://community.example/community#us']),
      person: new Set(['https://person.example/profile/card#me']),
    })

    await run(qas)

    expect(qas.moves.list).to.have.length(10)

    const next = fetchRdf('https://person.example/settings/publicTypeIndex.ttl')

    qas.addResource('https://person.example/settings/publicTypeIndex.ttl', next)
    expect(qas.moves.list).to.have.length(10)
  })

  it('should handle gracefully when we encounter something unexpected instead of uri', async () => {
    const qas = new QueryAndStore(friendOfAFriendQuery, {
      person: new Set(['https://personx.example/profile/card#me']),
    })

    await run(qas)
  })

  it('should add errored resources and result in nothing missing', () => {
    const qas = new QueryAndStore(friendOfAFriendQuery, {
      person: new Set(['https://id.person.example/profile#me']),
    })

    expect(qas.getResources()).to.have.length(1)
    expect(qas.getResources('missing')).to.have.length(1)
    expect(qas.getResources('failed')).to.have.length(0)
    expect(qas.getResources('added')).to.have.length(0)

    qas.addResource(
      'https://id.person.example/profile',
      parseRdfToQuads(
        `<#me> <${foaf.knows}> <https://id2.person.example/profile#me>.`,
        { baseIRI: 'https://id.person.example/profile' },
      ),
    )

    expect(qas.getResources()).to.have.length(2)
    expect(qas.getResources('missing')).to.have.length(1)
    expect(qas.getResources('failed')).to.have.length(0)
    expect(qas.getResources('added')).to.have.length(1)

    qas.addResource('https://id2.person.example/profile', [], 'error')

    expect(qas.getResources()).to.have.length(2)
    expect(qas.getResources('missing')).to.have.length(0)
    expect(qas.getResources('failed')).to.have.length(1)
    expect(qas.getResources('added')).to.have.length(1)
  })
})
