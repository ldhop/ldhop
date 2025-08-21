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
  redirectsTo?: Graph<V>
}
type UriVariables<V extends Variable> = Partial<{ [key in V]: Set<string> }>
type VariableMap<V extends Variable, Value = Term> = Map<V, Map<TermId, Value>>

interface Move<V extends Variable> {
  from: VariableMap<V, Term>
  to: VariableMap<V, Term>
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
  // moves that are provided by the variable
  providedByVariable: VariableMap<V, Set<Move<V>>> = new Map() // { [key: string]: Set<Move<V>> } = {}
  // moves that provide the variable
  provideVariable: VariableMap<V, Set<Move<V>>> = new Map() // { [key: string]: Set<Move<V>> } = {}
  byQuad: { [key: string]: Set<Move<V>> } = {}

  add(move: Move<V>) {
    // add step to list
    this.list.add(move)
    // add step to "provides" index
    for (const [variable, termMap] of move.from) {
      for (const [termId] of termMap) {
        if (!this.providedByVariable.has(variable))
          this.providedByVariable.set(variable, new Map())
        if (!this.providedByVariable.get(variable)!.has(termId))
          this.providedByVariable.get(variable)?.set(termId, new Set())
        this.providedByVariable.get(variable)!.get(termId)!.add(move)
      }
    }

    // add step to "providersOf" index
    for (const [variable, termMap] of move.to) {
      for (const [termId] of termMap) {
        if (!this.provideVariable.has(variable))
          this.provideVariable.set(variable, new Map())
        if (!this.provideVariable.get(variable)!.has(termId))
          this.provideVariable.get(variable)?.set(termId, new Set())
        this.provideVariable.get(variable)!.get(termId)!.add(move)
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
    move.from.forEach((termMap, variable) => {
      termMap.forEach((term, termId) => {
        this.providedByVariable.get(variable)?.get(termId)?.delete(move)
      })
    })
    // remove step from "providersOf" index
    move.to.forEach((termMap, variable) => {
      termMap.forEach((term, termId) => {
        this.provideVariable.get(variable)?.get(termId)?.delete(move)
      })
    })

    // remove step from byQuad index
    if (move.quad) {
      this.byQuad[stringifyQuad(move.quad)].delete(move)
    }
  }

  /* this is a debugging feature, it will return a list of current moves as a string */
  print(): string {
    const moveStrings: string[] = []

    for (const move of this.list) {
      const fromStr = this.formatVariableMap(move.from)
      const toStr = this.formatVariableMap(move.to)
      moveStrings.push(`${fromStr} ==> ${toStr}`)
    }

    return moveStrings.join('\n')
  }

  private formatVariableMap(varMap: VariableMap<V, Term>): string {
    const pairs: string[] = []

    for (const [variable, termMap] of varMap) {
      for (const [, term] of termMap) {
        pairs.push(`${variable}:${term.id}`)
      }
    }

    return pairs.join(', ')
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
            from: new Map() as VariableMap<V>,
            to: new Map([[key, new Map([[getTermId(term), term]])]]),
          })
          this.addVariable(key, term)
        }
      }
    }
  }

  getMissingResources() {
    return this.getGraphs(false)
  }

  addGraph(actualUri: string, quads: Quad[], requestedUri?: string) {
    // TODO keep track of redirects

    const graph: Graph<V> = this.graphs.get(actualUri) ?? {
      uri: actualUri,
      term: new NamedNode(actualUri),
      added: false,
      sourceVariables: new Map(),
    }

    if (
      requestedUri &&
      removeHashFromURI(requestedUri) !== removeHashFromURI(actualUri)
    ) {
      const requestGraph = this.graphs.get(removeHashFromURI(requestedUri))
      if (requestGraph) {
        requestGraph.added = true
        requestGraph.redirectsTo = graph
      }
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
    this.graphs.set(actualUri, graph)

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
      const from: VariableMap<V> = new Map()
      for (const element of quadElements) {
        const el = step[element]
        if (isVariable<V>(el)) {
          if (!from.has(el)) from.set(el, new Map())

          from.get(el)!.set(getTermId(quad[element]), quad[element])
        }
      }
      const to: VariableMap<V> = new Map([
        [step.target, new Map([[getTermId(quad[step.pick]), quad[step.pick]]])],
      ])

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

    // if the move leads to a variable, and it is the last move supporting this variable, (remove the variable).
    move.to.forEach((termMap, variable) => {
      termMap.forEach((term, termId) => {
        const providingMoves = this.moves.provideVariable
          .get(variable)
          ?.get(termId)

        if (!providingMoves || providingMoves.size === 0)
          this.removeVariable(variable, term)
        else this.detectAndRemoveOrphans(variable, term)
      })
    })
  }

  private coloredVariables: VariableMap<V> = new Map()

  /**
   * First iteration: color all variables that follow from the initial variable
   * Then see if the resulting colored variables are held by any uncolored variables.
   */
  private colorDependents(variable: V, term: Term) {
    if (this.coloredVariables.get(variable)?.has(getTermId(term))) return
    if (!this.coloredVariables.has(variable))
      this.coloredVariables.set(variable, new Map())
    this.coloredVariables.get(variable)?.set(getTermId(term), term)
    const movesProvidedByVariable = this.moves.providedByVariable
      .get(variable)
      ?.get(getTermId(term))

    if (movesProvidedByVariable)
      for (const move of movesProvidedByVariable) {
        move.to.forEach((nextTermMap, nextVariable) => {
          nextTermMap.forEach(nextTerm => {
            this.colorDependents(nextVariable, nextTerm)
          })
        })
      }
  }

  private detectAndRemoveOrphans(variable: V, term: Term) {
    this.coloredVariables = new Map()
    this.colorDependents(variable, term)
    // now see if any colored var is held by uncolored
    // Check if the entire set of colored variables is held by uncolored variables
    let isHeldByUncolored = false

    // Look at all moves that produce any colored variable
    for (const [coloredVariable, termMap] of this.coloredVariables) {
      for (const [termId] of termMap) {
        const producingMoves = this.moves.provideVariable
          .get(coloredVariable)
          ?.get(termId)

        if (producingMoves) {
          for (const move of producingMoves) {
            // Check if ALL variables in this move's "from" are uncolored
            let allFromVariablesUncolored = true
            for (const [fromVariable, fromTermMap] of move.from) {
              for (const [fromTermId] of fromTermMap) {
                if (this.coloredVariables.get(fromVariable)?.has(fromTermId)) {
                  allFromVariablesUncolored = false
                  break
                }
              }
              if (!allFromVariablesUncolored) break
            }

            if (allFromVariablesUncolored) {
              // Found one move with all uncolored "from" variables
              // This holds the entire colored set
              isHeldByUncolored = true
              break
            }
          }
          if (isHeldByUncolored) break
        }
      }
      if (isHeldByUncolored) break
    }

    if (!isHeldByUncolored) {
      // The entire set is orphaned - remove all colored variables
      for (const [coloredVariable, termMap] of this.coloredVariables) {
        for (const [, coloredTerm] of termMap) {
          this.removeVariable(coloredVariable, coloredTerm)
        }
      }
    }
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

    const movesFromVariable = this.moves.providedByVariable
      .get(variable)
      ?.get(getTermId(node))

    if (movesFromVariable)
      for (const move of movesFromVariable) this.removeMove(move)
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
            from: new Map([[step.source, new Map([[getTermId(node), node]])]]),
            to: new Map([
              [
                step.target,
                new Map([[getTermId(transformedNode), transformedNode]]),
              ],
            ]),
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
                  const from: VariableMap<V> = new Map()
                  for (const el of quadElements)
                    if (isVariable(step[el])) {
                      if (!from.has(step[el])) from.set(step[el], new Map())
                      from.get(step[el])!.set(getTermId(quad[el]), quad[el])
                    }
                  const to: VariableMap<V> = new Map([
                    [targetVar, new Map([[getTermId(target), target]])],
                  ])
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
