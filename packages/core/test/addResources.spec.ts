import { expect } from 'chai'
import { QueryAndStore } from '../src/QueryAndStore.js'
import {
  communityAccommodationsQuery,
  communityQuery,
  friendOfAFriendQuery,
  personAccommodationQuery2,
  personAccommodationsQuery,
} from './queries.js'
import { fetchRdf } from './resources/index.js'
import { run } from './run.js'

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

  it("should make steps through person's profile and find all accommodation offers of the community", () => {
    const qas = new QueryAndStore(personAccommodationsQuery, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    run(qas)

    const offers = qas.getVariable('offer')

    expect(offers).to.have.length(2)
  })

  it("should make steps through person's profile and find all accommodation offers of the community (2)", () => {
    const qas = new QueryAndStore(personAccommodationQuery2, {
      person: new Set(['https://person.example/profile/card#me']),
      community: new Set(['https://community.example/community#us']),
    })

    run(qas)

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
      communityQuery.concat({
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

  it('should not save duplicate moves', () => {
    const qas = new QueryAndStore(personAccommodationQuery2, {
      community: new Set(['https://community.example/community#us']),
      person: new Set(['https://person.example/profile/card#me']),
    })

    run(qas)

    expect(qas.moves.list).to.have.length(10)

    const next = fetchRdf('https://person.example/settings/publicTypeIndex.ttl')

    qas.addResource('https://person.example/settings/publicTypeIndex.ttl', next)
    expect(qas.moves.list).to.have.length(10)
  })

  it('should handle gracefully when we encounter something unexpected instead of uri', () => {
    const qas = new QueryAndStore(friendOfAFriendQuery, {
      person: new Set(['https://personx.example/profile/card#me']),
    })

    run(qas)
  })
})
