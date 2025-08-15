import { NamedNode, Quad, Store, type Term } from 'n3'
import type { LdhopQuery, Match, Variable } from './types.js'
import { removeHashFromURI } from './utils/helpers.js'

type Variables<V extends Variable> = Partial<{ [key in V]: Set<Term> }>
type UriVariables<V extends Variable> = Partial<{ [key in V]: Set<string> }>

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

const metaUris = {
  meta: 'https://ldhop.example/meta',
  status: 'https://ldhop.example/status',
  missing: 'https://ldhop.example/status/missing',
  added: 'https://ldhop.example/status/added',
  failed: 'https://ldhop.example/status/failed',
  resource: 'https://ldhop.example/resource',
  variable: 'https://ldhop.example/variable',
}

class VVVVVVVVVVV<V extends Variable> extends NamedNode {
  variable: V

  constructor(variable: V) {
    super(metaUris.variable + '/' + variable)
    this.variable = variable
  }

  static getVar<V extends Variable>(term: Term) {
    return term.value.split('/').pop() as V
  }
}

type MetaUris = typeof metaUris
type Meta = { [P in keyof MetaUris]: NamedNode }
const meta = <Meta>(
  Object.fromEntries(
    Object.entries(metaUris).map(([key, uri]) => [key, new NamedNode(uri)]),
  )
)

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

export class LdhopEngine<V extends Variable = Variable> {
  store: Store
  query: LdhopQuery<V>
  moves = new Moves<V>()

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
            from: {} as Variables<V>,
            to: { [key]: new Set([term]) } as Variables<V>,
            step: -1,
          })
          this.addVariable(key, term)
        }
      }
    }
  }

  getMissingResources() {
    return this.getResources('missing')
  }

  private removeVariable(variable: V, node: Term) {
    this.store.removeQuad(
      new Quad(node, meta.variable, new VVVVVVVVVVV(variable), meta.meta),
    )

    if (node.termType === 'NamedNode') {
      const resourceNode = new NamedNode(removeHashFromURI(node.value))

      this.store.removeQuad(
        new Quad(node, meta.resource, resourceNode, meta.meta),
      )

      this.store.removeQuads(
        this.store.getQuads(resourceNode, meta.status, null, meta.meta),
      )

      this.removeResource(resourceNode.value)
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

  addResource(
    resource: string,
    quads: Quad[],
    status: 'success' | 'error' = 'success',
  ) {
    const resourceNode = new NamedNode(resource)

    const oldResource = this.store.getQuads(null, null, null, resourceNode)

    const [additions, deletions] = quadDiff(quads, oldResource as Quad[])

    additions.forEach(quad => this.addQuad(quad))
    deletions.forEach(quad => this.removeQuad(quad))

    const missing = new Quad(resourceNode, meta.status, meta.missing, meta.meta)
    const added = new Quad(resourceNode, meta.status, meta.added, meta.meta)
    const failed = new Quad(resourceNode, meta.status, meta.failed, meta.meta)

    // mark the resource as added or failed depending on status
    this.store.removeQuads([missing, added, failed])
    if (status === 'success') this.store.addQuad(added)
    if (status === 'error') this.store.addQuad(failed)
  }

  addQuad(quad: Quad) {
    // find relevant matches in steps

    this.store.addQuad(quad)

    const variables = Object.fromEntries(
      quadElements.map(el => [
        el,
        this.store.getObjects(quad[el], meta.variable, meta.meta),
      ]),
    ) as Record<QuadElement, VVVVVVVVVVV<V>[]>

    const matchQuadElement = (
      step: Match<V>,
      element: QuadElement,
    ): boolean => {
      const el = step[element]
      const node = quad[element]
      if (!el) return true
      if (isVariable<V>(el)) {
        if (variables[element].some(v => v.equals(new VVVVVVVVVVV(el))))
          return true
      }
      if (el === node.value) return true
      return false
    }

    // find relevant steps
    const relevantSteps = Object.entries(this.query)
      .filter(
        (entry): entry is [string, Match<V>] =>
          typeof entry[1] !== 'function' && entry[1].type === 'match',
      )
      .filter(([, step]) =>
        // keep only steps that match given quad.
        quadElements.every(element => matchQuadElement(step, element)),
      )
      .map(([i, s]) => [+i, s] as const)

    // hop the steps and assign new variables
    for (const [i, step] of relevantSteps) {
      // save the move
      const from: Variables<V> = {}
      for (const element of quadElements) {
        const el = step[element]
        if (isVariable<V>(el)) from[el] = new Set([quad[element]])
      }
      const to = { [step.target]: new Set([quad[step.pick]]) }
      this.moves.add({ step: i, from, to, quad })

      this.addVariable(step.target, quad[step.pick])
    }

    // when assigning new variables, make hops from the new variables, too
  }

  removeResource(uri: string) {
    const quads = this.store.getQuads(null, null, null, new NamedNode(uri))

    quads.forEach(q => this.removeQuad(q))
  }

  removeQuad(quad: Quad) {
    this.store.removeQuad(quad)

    // is there a move that was made thanks to this quad?
    const moves = this.moves.byQuad[stringifyQuad(quad)] ?? new Set()

    // now, for each move, let's go through the provided variables and remove those that have nothing; then remove the move
    moves.forEach(move => {
      const providedVariables = move.to

      this.moves.remove(move)

      // now, remove variables that are no longer provided by any move.
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
    })
  }

  private hopFromVariable(variable: V, node: Term) {
    // find steps relevant for this variable
    const relevantSteps = this.query
      .map((s, i) => [s, i] as const)
      .filter(([step]) => {
        if (
          step.type === 'match' &&
          quadElements.some(el => step[el] === variable)
        )
          return true
        if (step.type === 'transform variable' && step.source === variable)
          return true
        return false
      })

    relevantSteps.forEach(([step, i]) => {
      if (step.type === 'transform variable') {
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
        // try to match quad(s) relevant for this step
        const generateRules = (step: Match<V>, element: QuadElement) => {
          let outputs = new Set<Term | null>()
          const s = step[element]
          if (!s) outputs.add(null)
          else if (!isVariable(s)) outputs.add(new NamedNode(s))
          else if (s === variable) outputs.add(node)
          else {
            const variables = this.store.getSubjects(
              meta.variable,
              new VVVVVVVVVVV(s),
              meta.meta,
            )
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
    if (
      this.store.has(
        new Quad(node, meta.variable, new VVVVVVVVVVV(variable), meta.meta),
      )
    )
      return

    this.store.addQuads([
      // add the new variable
      new Quad(node, meta.variable, new VVVVVVVVVVV(variable), meta.meta),
    ])

    let resourceNode: NamedNode | undefined = undefined

    if (node.termType === 'NamedNode') {
      resourceNode = new NamedNode(removeHashFromURI(node.value))

      this.store.addQuads([
        // make a resource
        new Quad(node, meta.resource, resourceNode, meta.meta),
      ])
    }

    // if the variable is used in other queries and hasn't been given status, mark it as missing
    const isInAddResources = this.query.some(
      a =>
        typeof a !== 'function' &&
        a.type === 'add resources' &&
        a.variable === variable,
    )

    const isInMatch = this.query.some(
      a =>
        typeof a !== 'function' &&
        a.type === 'match' &&
        quadElements.some(el => a[el] === variable),
    )

    const isNeeded = isInAddResources || isInMatch

    if (
      resourceNode &&
      isNeeded &&
      this.store.match(resourceNode, meta.status, null, meta.meta).size === 0
    ) {
      this.store.addQuad(resourceNode, meta.status, meta.missing, meta.meta)
    }

    this.hopFromVariable(variable, node)
  }

  /**
   * If you provide variable name, this method will return URIs that belong to that variable
   */
  getVariable(variableName: V) {
    return this.store
      .getSubjects(meta.variable, new VVVVVVVVVVV(variableName), meta.meta)
      .map(s => s.value)
  }

  getAllVariables() {
    return this.store
      .getQuads(null, meta.variable, null, meta.meta)
      .reduce((dict: { [key: string]: Set<string> }, quad) => {
        dict[VVVVVVVVVVV.getVar<V>(quad.object)] ??= new Set<string>()
        dict[VVVVVVVVVVV.getVar<V>(quad.object)].add(quad.subject.value)
        return dict
      }, {})
  }

  getResources(status?: 'missing' | 'added' | 'failed') {
    if (!status)
      return this.store
        .getObjects(null, meta.resource, meta.meta)
        .map(s => s.value)

    const statusNode =
      status === 'missing'
        ? meta.missing
        : status === 'failed'
          ? meta.failed
          : meta.added
    return this.store
      .getSubjects(meta.status, statusNode, meta.meta)
      .map(m => m.value)
  }
}

const quadDiff = (newQuads: Quad[], oldQuads: Quad[]): [Quad[], Quad[]] => {
  // quickly bail out in simple cases
  if (oldQuads.length === 0) return [newQuads, []]
  if (newQuads.length === 0) return [[], oldQuads]

  // additions are new quads minus old quads
  const additions = newQuads.filter(nq => !oldQuads.some(oq => nq.equals(oq)))
  const deletions = oldQuads.filter(oq => !newQuads.some(nq => oq.equals(nq)))

  return [additions, deletions]
}

// type guard for testing variables
function isVariable<V extends Variable = Variable>(
  value: string | undefined,
): value is V {
  return typeof value === 'string' && value.startsWith('?')
}
