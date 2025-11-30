import { expect } from 'chai'
import sinon, { SinonSpy } from 'sinon'
import { LdhopEngine } from '../src/index.js'
import {
  friendOfAFriendQuery,
  inboxMessagesQuery,
  personAccommodationsQuery,
  Var,
} from './queries.js'
import { fetchRdf } from './resources/index.js'
import { run } from './run.js'

describe('Callbacks', () => {
  let onNeedResource: SinonSpy
  let onDropResource: SinonSpy
  let onQueryComplete: SinonSpy
  let onVariableAdded: SinonSpy
  let onVariableRemoved: SinonSpy

  beforeEach(() => {
    sinon.restore()
    onNeedResource = sinon.spy()
    onDropResource = sinon.spy()
    onQueryComplete = sinon.spy()
    onVariableAdded = sinon.spy()
    onVariableRemoved = sinon.spy()
  })

  it('should trigger callback onNeedResource when a missing resource is found', () => {
    const engine = new LdhopEngine(
      friendOfAFriendQuery,
      { [Var.person]: new Set(['https://id.example']) },
      undefined,
      {
        onNeedResource,
        onDropResource,
        onQueryComplete,
        onVariableAdded,
        onVariableRemoved,
      },
    )

    expect(onNeedResource.called).to.be.true
    expect(onNeedResource.firstCall.args[0]).to.equal('https://id.example/')
    expect(onDropResource.called).to.be.false
    expect(onQueryComplete.called).to.be.false
    expect(onVariableAdded.called).to.be.true
    expect(onVariableRemoved.called).to.be.false

    engine.addGraph(
      'https://data.example/profile/card',
      [],
      'https://id.example',
    )

    expect(onQueryComplete.called).to.be.true

    const missingResourcesAfter = engine.getMissingResources()
    expect(missingResourcesAfter.size).to.equal(0)
  })

  it('[remove resource, remove link] should call onDropResource and onVariableRemoved', async () => {
    // first run the normal query
    const engine = new LdhopEngine(
      inboxMessagesQuery,
      { [Var.person]: new Set(['https://person.example/profile/card#me']) },
      undefined,
      {
        onNeedResource,
        onDropResource,
        onQueryComplete,
        onVariableAdded,
        onVariableRemoved,
      },
    )

    await run(engine)
    expect(onQueryComplete.callCount).to.equal(1)

    sinon.resetHistory()

    // then delete the notification - replace resource with empty
    engine.addGraph('https://person.example/inbox/notification1', [])

    await run(engine)

    // and other graphs and variables will get dropped
    expect(onQueryComplete.callCount).to.equal(1)
    expect(onNeedResource.callCount).to.equal(0)
    expect(onDropResource.callCount).to.equal(2)
    expect(onVariableAdded.callCount).to.equal(0)
    expect(onVariableRemoved.callCount).to.equal(4)
  })

  it('[replace resource, remove link] should correctly call the callbacks', async () => {
    const engine = new LdhopEngine(
      personAccommodationsQuery,
      {
        [Var.person]: new Set(['https://person.example/profile/card#me']),
        [Var.community]: new Set(['https://community.example/community#us']),
      },
      undefined,
      {
        onNeedResource,
        onDropResource,
        onQueryComplete,
        onVariableAdded,
        onVariableRemoved,
      },
    )

    await run(engine)
    expect(onQueryComplete.callCount).to.equal(1)
    expect(onNeedResource.callCount).to.equal(7)
    expect(onDropResource.callCount).to.equal(0)
    expect(onVariableAdded.callCount).to.equal(10)
    expect(onVariableRemoved.callCount).to.equal(0)
    sinon.resetHistory()

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

    // and other graphs and variables will get dropped
    expect(onQueryComplete.callCount).to.equal(1)
    expect(onNeedResource.callCount).to.equal(0)
    expect(onDropResource.callCount).to.equal(1)
    expect(onVariableAdded.callCount).to.equal(0)
    expect(onVariableRemoved.callCount).to.equal(1)
  })
})
