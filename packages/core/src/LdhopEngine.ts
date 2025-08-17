import { NamedNode, Quad, Store, type Term } from 'n3'
import type { LdhopQuery, Match, Variable } from './types.js'
import { removeHashFromURI } from './utils/helpers.js'

type TermId = `${Term['termType']}:${Term['id']}`

type Uri = string
interface Graph<V extends Variable> {
  added: boolean
  uri: Uri
  term: NamedNode
  sourceVariables: VariableMap<V>
}
type Variables<V extends Variable> = Partial<{ [key in V]: Set<Term> }>
type UriVariables<V extends Variable> = Partial<{ [key in V]: Set<string> }>
type VariableMap<V extends Variable> = Map<V, Map<TermId, Term>>

interface Move<V extends Variable> {
  from: Variables<V>
  to: Variables<V>
  // step: LdhopQuery<V>[number]
  step: number
  quad?: Quad
}

const stringifyQuad = (quad: Quad) => JSON.stringify(quad.toJSON())

enum QuadElement {
  subject = 'subject',
  predicate = 'predicate',
  object = 'object',
  graph = 'graph',
}

const quadElements = Object.values(QuadElement)

class Moves<V extends Variable> {
  list: Set<Move<V>> = new Set()
  provides: { [key: string]: Set<Move<V>> } = {}
  providersOf: { [key: string]: Set<Move<V>> } = {}
  byQuad: { [key: string]: Set<Move<V>> } = {}

  add(move: Move<V>) {
    // add step to list
    this.list.add(move)
    // add step to "provides" index
    for (const uri in move.from) {
      if (isVariable(uri)) {
        for (const term of move.from[uri]!) {
          this.provides[term.value] ??= new Set()
          this.provides[term.value].add(move)
        }
      }
    }

    // add step to "providersOf" index
    for (const uri in move.to) {
      if (isVariable(uri)) {
        for (const term of move.to[uri]!) {
          this.providersOf[term.value] ??= new Set()
          this.providersOf[term.value].add(move)
        }
      }
    }

    // add step to byQuad index
    if (move.quad) {
      this.byQuad[stringifyQuad(move.quad)] ??= new Set()
      this.byQuad[stringifyQuad(move.quad)].add(move)
    }
  }

  remove(move: Move<V>) {
    this.list.delete(move)
    // remove step from "provides" index
    for (const uri in move.from) {
      if (isVariable(uri) && move.from[uri]) {
        for (const term of move.from[uri]) {
          this.provides[term.value].delete(move)
        }
      }
    }
    // remove step from "providersOf" index
    for (const uri in move.to) {
      if (isVariable(uri) && move.to[uri]) {
        for (const term of move.to[uri]) {
          this.providersOf[term.value].delete(move)
        }
      }
    }

    // remove step from byQuad index
    if (move.quad) {
      this.byQuad[stringifyQuad(move.quad)].delete(move)
    }
  }

  /* this is a debugging feature, it will return a list of current moves as a string */
  print = () => {
    let output = ''
    this.list.forEach(move => {
      const from = Object.values(move.from)
        .flatMap(f => Array.from(f as Set<Term>))
        .map(f => f.value)
      const to = Object.values(move.to)
        .flatMap(f => Array.from(f as Set<Term>))
        .map(f => f.value)

      output += from.concat(' ') + ' ==> ' + to.concat(' ')
    })

    return output
  }
}

/**
 * The engine to execute LdhopQuery.
 *
 * It works in steps. So you give it a resource, and it tells you what to add next, and what's no longer needed (TODO).
 *
 * Usage:
 *
 * const engine = new LdhopEngine(query, startingPoints, store?)
 *
 *
 * Internal parts:
 *
 * store - RDF store that keeps track of the Linked Data
 * variables - the map of variables we hop through
 * moves -
 * graphs -
 *
 * ## Algorithm:
 *
 * - add the defined starting variables
 *
 * ### Add a variable
 * - if variable is already in the list of variables, done.
 * - add a variable to the list of variables
 * - if variable is required in any steps, get its URI without #hash part. If resource is needed, see if it is listed in graphs map already. If not, add it to the graphs map as missing.
 * - go through all steps of the query, and if the variable matches any of the Match or TransformVariable steps, make the hop, collect the resulting target variable, save the Move and (Add the variable).
 *
 * ### Add missing resource/graph:
 * - a resource/graph IRI, and all contained triples are provided
 * - each added quad will be given a graph, which typically represents the final URL of the resource
 * - TODO: keep track of any redirect
 * - see which quads should be added and which ones should be removed
 * - For each quad to add
 *   - (Add the quad).
 * - For each quad to remove
 *   - (Remove the quad).
 *
 * - mark the graph as added or add it
 *
 * - return missing resources and no-more-needed resources (TODO)
 *
 * ### Add a quad:
 * - add quad to the store
 * - for each step:
 *    - if the quad matches the step, get final variable, save the Move, and (Add the variable).
 *
 * ### Remove a quad:
 * - remove quad from store
 * - get all moves that this quad provided and (remove the move)
 *
 * ### Remove move:
 * - remove move from moves.
 * - if the move leads to a variable, and it is the last move supporting this variable, (remove the variable).
 * - TODO prune in such a way that orphaned cycles get removed
 *
 * ### Remove variable:
 * - remove variable value from variables
 * - if the related graph is not supported by any other variable (remove the graph)
 * - Remove all moves that this variable leads to
 *
 * ### Remove graph:
 * - remove graph from graphs
 * - for each matching quad (remove quad)
 */
export class LdhopEngine<V extends Variable = Variable> {
  public store: Store
  public query: LdhopQuery<V>
  public moves = new Moves<V>()
  private variables = new Map<V, Map<TermId, Term>>()
  private graphs = new Map<Uri, Graph<V>>()

  constructor(
    query: LdhopQuery<V>,
    startingPoints: UriVariables<V>,
    store = new Store(),
  ) {
    this.store = store
    this.query = query

    // we add a move for each variable that is provided at the beginning
    // sometimes circular reference would try to remove them
    // we prevent that by making sure the initial variables don't get orphaned, with this move
    for (const key in startingPoints) {
      if (isVariable<V>(key) && startingPoints[key]) {
        for (const value of startingPoints[key]) {
          const term = new NamedNode(value)

          this.moves.add({
            step: -1,
            from: {} as Variables<V>,
            to: { [key]: new Set([term]) } as Variables<V>,
          })
          this.addVariable(key, term)
        }
      }
    }
  }

  getMissingResources() {
    return this.getGraphs(false)
  }

  addGraph(graphUri: string, quads: Quad[]) {
    // TODO keep track of redirects

    const graph: Graph<V> = this.graphs.get(graphUri) ?? {
      uri: graphUri,
      term: new NamedNode(graphUri),
      added: false,
      sourceVariables: new Map(),
    }

    const oldQuads = this.store.getQuads(null, null, null, graph.term)
    // each added quad will be given a graph, which typically represents the final URL of the resource
    const newQuads = quads.map(
      q => new Quad(q.subject, q.predicate, q.object, graph.term),
    )

    // get quad additions and deletions of this graph from this.store
    const additions = newQuads.filter(nq => !oldQuads.some(oq => nq.equals(oq)))
    const deletions = oldQuads.filter(oq => !newQuads.some(nq => oq.equals(nq)))

    // For each quad to add, (Add the quad).
    additions.forEach(quad => this.addQuad(quad))
    // For each quad to remove, (Remove the quad).
    deletions.forEach(quad => this.removeQuad(quad))

    // mark the graph as added or add it
    graph.added = true
    this.graphs.set(graphUri, graph)

    return {
      missing: this.getMissingResources(),
      notNeeded: 'TODO',
    }
  }

  private isVariablePresent(variable: V, node: Term) {
    return Boolean(this.variables.get(variable)?.has(getTermId(node)))
  }

  addQuad(quad: Quad) {
    // add quad to the store
    this.store.addQuad(quad)

    // find relevant matches in steps
    const matchQuadElement = (
      quad: Quad,
      step: Match<V>,
      element: QuadElement,
    ): boolean => {
      const el = step[element]
      const node = quad[element]
      if (!el) return true
      if (isVariable<V>(el) && this.isVariablePresent(el, node)) return true

      if (el === node.value) return true
      return false
    }

    // hop the steps and assign new variables
    this.query.forEach((step, i) => {
      if (step.type !== 'match') return
      if (!quadElements.every(element => matchQuadElement(quad, step, element)))
        return
      // if the quad matches the step, get final variable, save the Move, and (Add the variable).
      const from: Variables<V> = {}
      for (const element of quadElements) {
        const el = step[element]
        if (isVariable<V>(el)) from[el] = new Set([quad[element]])
      }
      const to = { [step.target]: new Set([quad[step.pick]]) } as Variables<V>
      this.moves.add({ step: i, from, to, quad })
      this.addVariable(step.target, quad[step.pick])
    })
  }

  removeQuad(quad: Quad) {
    this.store.removeQuad(quad)

    // is there a move that was made thanks to this quad?
    const moves = this.moves.byQuad[stringifyQuad(quad)] ?? new Set()

    // now, for each move provided by this quad, remove the move
    moves.forEach(move => this.removeMove(move))
  }

  private removeMove(move: Move<V>) {
    // remove move from moves.
    this.moves.remove(move)
    const providedVariables = move.to

    // if the move leads to a variable, and it is the last move supporting this variable, (remove the variable).
    for (const variable in providedVariables) {
      providedVariables[variable]!.forEach(term => {
        // which moves provide this variable
        const providingMoves = Array.from(
          this.moves.providersOf[term.value],
        ).filter(a =>
          Array.from(a.to[variable] ?? []).some(t => t.equals(term)),
        )

        if (providingMoves.length === 0) this.removeVariable(variable, term)
      })
    }

    // TODO prune orphaned cycles
  }

  private removeVariable(variable: V, node: Term) {
    // remove variable value from variables
    this.variables.get(variable)?.delete(getTermId(node))
    if (this.variables.get(variable)?.size === 0)
      this.variables.delete(variable)

    // if the related graph is not supported by any other variable (remove the graph)
    if (node.termType === 'NamedNode') {
      const graphNode = new NamedNode(removeHashFromURI(node.value))

      const graph = this.graphs.get(graphNode.value)

      // remove the supporting variable from its graph
      graph?.sourceVariables.get(variable)?.delete(getTermId(node))

      const leftoverGraphSources = new Set(
        graph?.sourceVariables.values().flatMap(varMap => varMap.values()),
      )

      if (leftoverGraphSources.size === 0) this.removeGraph(graphNode.value)
    }

    // if the removed variable leads through some step to other variable, & nothing else leads to that variable, remove that variable

    const uri = node.value

    const movesFromVariable = Array.from(this.moves.provides[uri] ?? []).filter(
      move =>
        Array.from(move.from[variable] ?? []).some(term => term.equals(node)),
    )

    for (const move of movesFromVariable) {
      const nextVariables = move.to
      this.moves.remove(move)
      for (const variable in nextVariables) {
        nextVariables[variable]!.forEach(nextTerm => {
          // see if there's any provision of this variable left
          const a = Array.from(
            this.moves.providersOf[nextTerm.value] ?? new Set(),
          ).filter(a =>
            Array.from(a.to[variable] ?? []).some(t => t.equals(nextTerm)),
          )
          if (a.length === 0) this.removeVariable(variable, nextTerm)
        })
      }
    }
  }

  removeGraph(uri: string) {
    this.graphs.delete(uri)
    const quads = this.store.getQuads(null, null, null, new NamedNode(uri))

    quads.forEach(q => this.removeQuad(q))
  }

  private hopFromVariable(variable: V, node: Term) {
    // continuation of adding a variable
    // go through all steps of the query, and if the variable matches any of the Match or TransformVariable steps, make the hop, collect the resulting target variable, save the Move and (Add the variable).
    this.query.forEach((step, i) => {
      if (step.type === 'transform variable') {
        if (step.source !== variable) return
        const transformedNode = step.transform(node)
        if (transformedNode) {
          this.moves.add({
            from: { [step.source]: new Set([node]) } as Variables<V>,
            to: { [step.target]: new Set([transformedNode]) } as Variables<V>,
            step: i,
          })
          this.addVariable(step.target, transformedNode)
        }
      } else if (step.type === 'match') {
        if (quadElements.every(el => step[el] !== variable)) return
        // try to match quad(s) relevant for this step
        const generateRules = (step: Match<V>, element: QuadElement) => {
          let outputs = new Set<Term | null>()
          const s = step[element]
          if (!s) outputs.add(null)
          else if (!isVariable(s)) outputs.add(new NamedNode(s))
          else if (s === variable) outputs.add(node)
          else {
            const variables = this.getVariable(s)?.values()
            outputs = new Set(variables)
          }

          return outputs
        }

        const constraints = Object.fromEntries(
          quadElements.map(el => [el, generateRules(step, el)] as const),
        ) as Record<QuadElement, Set<Term | null>>

        for (const s of constraints.subject) {
          for (const p of constraints.predicate) {
            for (const o of constraints.object) {
              for (const g of constraints.graph) {
                const quads = this.store.getQuads(s, p, o, g)

                for (const quad of quads) {
                  const targetVar = step.target
                  const target = quad[step.pick]
                  const from: Variables<V> = {}
                  for (const el of quadElements)
                    if (isVariable(step[el]))
                      from[step[el]] = new Set([quad[el]])
                  const to = { [targetVar]: new Set([target]) } as Variables<V>
                  this.moves.add({ from, to, step: i, quad })
                  this.addVariable(targetVar, target)
                }
              }
            }
          }
        }
      }
    })
  }

  private addVariable(variable: V, node: Term) {
    // if the variable is already added, there's nothing to do
    if (this.isVariablePresent(variable, node)) return

    // add a variable to the list of variables
    if (!this.variables.has(variable)) this.variables.set(variable, new Map())
    this.variables.get(variable)!.set(getTermId(node), node)

    // if the variable is required in any steps...
    const isInAddResources = this.query.some(
      a => a.type === 'add resources' && a.variable === variable,
    )
    const isInMatch = this.query.some(
      a => a.type === 'match' && quadElements.some(el => a[el] === variable),
    )
    const isNeeded = isInAddResources || isInMatch
    if (isNeeded && node.termType === 'NamedNode') {
      //... see if the resource graph has been added to the graph map
      // and if not, add it
      const graphName = removeHashFromURI(node.value)

      if (!this.graphs.has(graphName))
        this.graphs.set(graphName, {
          added: false,
          uri: graphName,
          term: node,
          sourceVariables: new Map(),
        })

      const graph = this.graphs.get(graphName)!

      // add the variable to graph sources
      if (!graph.sourceVariables.has(variable))
        graph.sourceVariables.set(variable, new Map())

      graph.sourceVariables.get(variable)!.set(getTermId(node), node)
    }

    this.hopFromVariable(variable, node)
  }

  /**
   * If you provide variable name, this method will return URIs that belong to that variable
   */
  getVariable(variableName: V) {
    return new Set(this.variables.get(variableName)?.values())
  }

  getVariableAsStringSet(variableName: V) {
    return termSetToStringSet(this.getVariable(variableName))
  }

  getAllVariables() {
    return Object.fromEntries(
      this.variables
        .entries()
        .map(([key, value]) => [key, new Set(value.values())]),
    )
  }

  getAllVariablesAsStringSets() {
    return Object.fromEntries(
      this.variables
        .entries()
        .map(([key, value]) => [
          key,
          termSetToStringSet(new Set(value.values())),
        ]),
    )
  }

  public getGraphs(added?: boolean) {
    if (typeof added !== 'boolean') return new Set(this.graphs.keys())

    const result = new Set<Uri>()
    this.graphs.forEach((graph, uri) => {
      if (graph.added === added) result.add(uri)
    })
    return result
  }
}

// type guard for testing variables
function isVariable<V extends Variable = Variable>(
  value: string | undefined,
): value is V {
  return typeof value === 'string' && value.startsWith('?')
}

const termSetToStringSet = (set: Set<Term>): Set<string> =>
  new Set([...set].map(term => term.value))

/**
 * Get unique term identifier
 */
const getTermId = (term: Term): TermId => {
  return `${term.termType}:${term.id}`
}
