import { NamedNode, Quad, Store, type Term, type Triple } from 'n3'
import {
  type Constant,
  type LdhopQuery,
  type Match,
  type Variable,
} from './types.js'

type Uri = string

interface Graph {
  added: boolean
  uri: Uri
  term: NamedNode
}

type Variables<V extends Variable> = { [key in V]?: Set<Term> }

interface Move<V extends Variable> {
  from: Variables<V>
  to: Variables<V>
  step: LdhopQuery<V>[number]
}

class Moves<V extends Variable> {
  public add(move: Move<V>) {}
  public remove(move: Move<V>) {}
  public list: unknown = []
}

export class LdhopEngine<V extends Variable> {
  public store: Store
  private variables = new Map<V, Set<Term>>()
  private graphs = new Map<Uri, Graph>()
  public moves = new Moves<V>()
  public query: LdhopQuery<V>

  // make Store interface more precise
  constructor(
    query: LdhopQuery<V>,
    variables: { [key in V]?: Set<string> },
    store: Store = new Store(),
  ) {
    this.query = query
    this.store = store
  }

  public getMissingResources() {
    return this.getGraphs(false)
  }

  /**
   * @deprecated use getGraphs instead
   */
  public getResources(status?: 'missing' | 'added' | 'failed') {
    switch (status) {
      case undefined: {
        return this.getGraphs()
      }
      case 'missing': {
        return this.getGraphs(false)
      }
      case 'added': {
        throw new Error('ambiguous')
      }
      case 'failed': {
        throw new Error('ambiguous')
      }
    }
  }

  public getGraphs(added?: boolean) {
    if (typeof added !== 'boolean') return new Set(this.graphs.keys())

    const result = new Set<Uri>()
    this.graphs.forEach((graph, uri) => {
      if (graph.added === added) result.add(uri)
    })
    return result
  }

  /**
   * @deprecated use addGraph instead
   */
  public addResource(resource: string, quads: Quad[]) {
    return this.addGraph({ graphUri: resource, triples: quads })
  }

  /**
   * This is the core of the engine.
   */
  public addGraph({
    graphUri,
    triples = [],
  }: {
    graphUri: string
    triples?: (Triple | Quad)[]
  }) {
    const graph: Graph = this.graphs.get(graphUri) ?? {
      uri: graphUri,
      term: new NamedNode(graphUri),
      added: false,
    }

    const oldQuads = this.store.getQuads(null, null, null, graph.term)
    const newQuads = triples.map(
      q => new Quad(q.subject, q.predicate, q.object, graph.term),
    )

    // get quad additions and deletions of this graph from this.store
    const additions = newQuads.filter(nq => !oldQuads.some(oq => nq.equals(oq)))
    const deletions = oldQuads.filter(oq => !newQuads.some(nq => oq.equals(nq)))

    // then add each addition, and remove each deletion
    for (const quad of additions) this.addQuad(quad)
    for (const quad of deletions) this.removeQuad(quad)

    // and update the status of this graph
    graph.added = true
    this.graphs.set(graphUri, graph)

    return this.getMissingResources()
  }

  private addQuad(quad: Quad) {
    // 1. add the quad to the store
    this.store.addQuad(quad)
    // 2. hop the steps
    this.query.forEach(step => {
      switch (step.type) {
        case 'match': {
          this.hop(step, quad)
          break
        }
      }
    })
  }

  private hop(step: Match<V>, quad: Quad) {
    // 1. detect whether the step matches the quad
    const move = this.match(step, quad)
    // 2. make the jump, save the move, save the variable
    // 3. hop from the variable, if new
  }

  private isMatch(a: V | Constant | undefined, b: Term) {
    if (typeof a === 'undefined') return true
    if (isVariable<V>(a)) return this.variables.get(a)?.has(b) ? true : false
    if (!isVariable(a)) return a === b.value
  }

  private match = (step: Match<V>, quad: Quad): Move<V> | undefined => {
    const nextVar: Term = quad[step.pick]

    const move: Move<V> = {
      from: {},
      to: {},
      step,
    }

    move.to[step.target] = new Set([nextVar])

    for (const part of rdfParts) {
      if (!this.isMatch(step[part], quad[part])) return undefined
      if (isVariable<V>(step[part])) {
        move.from[step[part]] ??= new Set()
        move.from[step[part]]!.add(quad[part])
      }
    }

    return move
  }

  private removeQuad(quad: Quad) {}

  public getAllVariables() {}
  public getVariable() {}
}

// type guard for testing variables
function isVariable<V extends Variable = Variable>(
  value: string | undefined,
): value is V {
  return typeof value === 'string' && value.startsWith('?')
}

const rdfParts = ['subject', 'predicate', 'object', 'graph'] as const
