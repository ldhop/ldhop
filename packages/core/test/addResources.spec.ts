import { expect } from 'chai'
import { QueryAndStore } from '../src/QueryAndStore'
import {
  communityAccommodationsQuery,
  personAccommodationsQuery,
} from './queries'
import { fetchRdf } from './resources'
import { run } from './run'

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
})
