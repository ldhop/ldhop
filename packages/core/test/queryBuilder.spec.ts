import { expect } from 'chai'
import { NamedNode, type Term } from 'n3'
import { foaf, rdfs } from 'rdf-namespaces'
import { ldhop } from '../src/query.js'

describe('Functional query builder', () => {
  it('should be able build query with Match steps', () => {
    const query = ldhop('?person')
      .match('?person', foaf.knows)
      .o('?person2')
      .match('?person2', foaf.knows, '?person')
      .s('?friend')
      .toArray()

    expect(query).to.have.length(2)
    expect(query[0]).to.deep.equal({
      type: 'match',
      subject: '?person',
      predicate: foaf.knows,
      pick: 'object',
      target: '?person2',
    })
    expect(query[1]).to.deep.equal({
      type: 'match',
      subject: '?person2',
      predicate: foaf.knows,
      object: '?person',
      pick: 'subject',
      target: '?friend',
    })
  })

  it('should be able build query with Match steps with multiple chained pickers', () => {
    const query = ldhop('?person')
      .match('?person', foaf.knows)
      .o('?person2')
      .match('?person2', foaf.knows, '?person')
      .s('?friend')
      .o('?personWithFriend')
      .toArray()

    expect(query).to.have.length(3)
    expect(query[0]).to.deep.equal({
      type: 'match',
      subject: '?person',
      predicate: foaf.knows,
      pick: 'object',
      target: '?person2',
    })
    expect(query[1]).to.deep.equal({
      type: 'match',
      subject: '?person2',
      predicate: foaf.knows,
      object: '?person',
      pick: 'subject',
      target: '?friend',
    })
    expect(query[2]).to.deep.equal({
      type: 'match',
      subject: '?person2',
      predicate: foaf.knows,
      object: '?person',
      pick: 'object',
      target: '?personWithFriend',
    })
  })

  it('should add resources for the last target when add() is called with no args', () => {
    const query = ldhop('?person')
      .match('?person', foaf.knows)
      .o('?friend')
      .add()
      .toArray()

    expect(query).to.have.length(2)
    expect(query[1]).to.deep.equal({
      type: 'add resources',
      variable: '?friend',
    })
  })

  it('should add resources for the provided variable when add(variable) is used', () => {
    const query = ldhop('?person')
      .match('?person', foaf.knows)
      .o('?friend')
      .add('?friend')
      .toArray()

    expect(query).to.have.length(2)
    expect(query[1]).to.deep.equal({
      type: 'add resources',
      variable: '?friend',
    })
  })

  it('should append transform step with source, target, and function', () => {
    const transform = (term: Term) =>
      term.termType === 'NamedNode'
        ? new NamedNode(`${term.value}#id`)
        : undefined

    const query = ldhop('?source')
      .transform('?source', '?target', transform)
      .toArray()

    expect(query).to.have.length(1)
    expect(query[0]).to.deep.equal({
      type: 'transform variable',
      source: '?source',
      target: '?target',
      transform,
    })
  })

  it('should allow concatenating queries', () => {
    const queryExtendedProfile = ldhop('?person')
      .match('?person', rdfs.seeAlso)
      .o('?profile')
      .add()
    const query = ldhop('?person')
      .match('?person', foaf.knows)
      .o('?friend')
      .concat(queryExtendedProfile)
      .toArray()

    expect(query).to.have.length(3)
    expect(query[0]).to.deep.equal({
      type: 'match',
      subject: '?person',
      predicate: foaf.knows,
      pick: 'object',
      target: '?friend',
    })
    expect(query[1]).to.deep.equal({
      type: 'match',
      subject: '?person',
      predicate: rdfs.seeAlso,
      pick: 'object',
      target: '?profile',
    })
    expect(query[2]).to.deep.equal({
      type: 'add resources',
      variable: '?profile',
    })
  })
})
