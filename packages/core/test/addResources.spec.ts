import { expect } from 'chai'
import { foaf } from 'rdf-namespaces'
import { LdhopEngine } from '../src/index.js'
import { parseRdfToQuads } from '../src/utils/helpers.js'
import {
  communityAccommodationsQuery,
  communityQuery,
  friendOfAFriendQuery,
  personAccommodationsQuery,
  Var,
} from './queries.js'
import { fetchRdf } from './resources/index.js'
import { run } from './run.js'

describe('Adding resources to LdhopEngine', () => {
  it('should accept array of commands, and initial variables', () => {
    const engine = new LdhopEngine(communityAccommodationsQuery, {
      [Var.community]: new Set(['https://community.example/community#us']),
    })

    const variables = engine.getAllVariables()
    expect(variables).to.haveOwnProperty('?community')
    expect(variables['?community'].size).to.equal(1)
    const term = [...variables['?community']][0]
    expect(term.termType).to.equal('NamedNode')
    expect(term.id).to.equal('https://community.example/community#us')
    const missingResources = engine.getMissingResources()
    expect(missingResources.size).to.equal(1)
    expect(missingResources.has('https://community.example/community')).to.be
      .true
  })

  it('should accept a resource and make step through it', () => {
    const engine = new LdhopEngine(communityAccommodationsQuery, {
      [Var.community]: new Set(['https://community.example/community#us']),
    })

    const resources = engine.getMissingResources()
    expect(resources.size).to.equal(1)
    expect(resources.has('https://community.example/community')).to.be.true

    const communityResource = [...resources][0]

    const data = fetchRdf(communityResource)

    engine.addResource(communityResource, data)

    const resourcesAfter = engine.getMissingResources()
    expect(resourcesAfter.size).to.equal(1)
    expect(resourcesAfter.has('https://community.example/group')).to.be.true
  })

  it("should make steps through person's profile and find all accommodation offers of the community", async () => {
    const engine = new LdhopEngine(personAccommodationsQuery, {
      [Var.person]: new Set(['https://person.example/profile/card#me']),
      [Var.community]: new Set(['https://community.example/community#us']),
    })

    await run(engine)

    const offers = engine.getVariable(Var.offer)
    expect(offers?.size).to.equal(2)
  })

  it('should not miss unused variables', () => {
    const engine = new LdhopEngine(communityQuery, {
      [Var.community]: new Set(['https://community.example/community#us']),
    })

    const resources = engine.getMissingResources()
    expect(resources.size).to.equal(1)
    expect(resources.has('https://community.example/community')).to.be.true

    const communityResource = [...resources][0]

    const data = fetchRdf(communityResource)

    engine.addResource(communityResource, data)

    const resourcesAfter = engine.getMissingResources()
    expect(resourcesAfter.size).to.equal(1)
    expect(resourcesAfter.has('https://community.example/group')).to.be.true

    const groupData = fetchRdf([...resourcesAfter][0])
    engine.addResource([...resourcesAfter][0], groupData)

    const missingAfter = engine.getMissingResources()
    expect(missingAfter).to.have.length(0)
  })

  it('should miss used variables', () => {
    const engine = new LdhopEngine(
      communityQuery.concat({
        type: 'add resources',
        variable: Var.person,
      }),
      {
        [Var.community]: new Set(['https://community.example/community#us']),
      },
    )

    const resources = engine.getMissingResources()
    expect(resources.size).to.equal(1)
    expect(resources.has('https://community.example/community')).to.be.true

    const communityResource = [...resources][0]

    const data = fetchRdf(communityResource)

    engine.addResource(communityResource, data)

    const resourcesAfter = engine.getMissingResources()
    expect(resourcesAfter.size).to.equal(1)
    expect(resourcesAfter.has('https://community.example/group')).to.be.true

    const groupData = fetchRdf([...resourcesAfter][0])
    engine.addResource([...resourcesAfter][0], groupData)

    const missingAfter = engine.getMissingResources()
    expect(missingAfter.size).to.equal(3)
  })

  it('should not save duplicate moves', async () => {
    const engine = new LdhopEngine(personAccommodationsQuery, {
      [Var.community]: new Set(['https://community.example/community#us']),
      [Var.person]: new Set(['https://person.example/profile/card#me']),
    })

    await run(engine)

    expect(engine.moves.list).to.have.length(10)

    const next = fetchRdf('https://person.example/settings/publicTypeIndex.ttl')

    engine.addResource(
      'https://person.example/settings/publicTypeIndex.ttl',
      next,
    )
    expect(engine.moves.list).to.have.length(10)
  })

  it('should handle gracefully when we encounter something unexpected instead of uri', async () => {
    const engine = new LdhopEngine(friendOfAFriendQuery, {
      [Var.person]: new Set(['https://personx.example/profile/card#me']),
    })

    await run(engine)

    expect(engine.getVariable(Var.person)?.size).to.equal(7)
  })

  it('should add errored resources and result in nothing missing', () => {
    const engine = new LdhopEngine(friendOfAFriendQuery, {
      [Var.person]: new Set(['https://id.person.example/profile#me']),
    })

    expect(engine.getGraphs().size).to.equal(1)
    expect(engine.getGraphs(false).size).to.equal(1)
    expect(engine.getGraphs(true).size).to.equal(0)

    engine.addResource(
      'https://id.person.example/profile',
      parseRdfToQuads(
        `<#me> <${foaf.knows}> <https://id2.person.example/profile#me>.`,
        { baseIRI: 'https://id.person.example/profile' },
      ),
    )

    expect(engine.getGraphs().size).to.equal(2)
    expect(engine.getGraphs(false).size).to.equal(1)
    expect(engine.getGraphs(true).size).to.equal(1)

    engine.addResource('https://id2.person.example/profile', [], 'error')

    expect(engine.getGraphs()).to.have.length(2)
    expect(engine.getGraphs(false)).to.have.length(0)
    expect(engine.getGraphs(true)).to.have.length(2)
  })
})
