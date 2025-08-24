import { NamedNode, Quad, Store, type Term } from 'n3'
import type { ValuesType } from 'utility-types'
import type { Match, RdfQuery, Variable as VariableType } from './types.js'
import { removeHashFromURI } from './utils/helpers.js'

type Variables = { [key: string]: Set<Term> }
type UriVariables = { [key: string]: Set<string> }

type Move = { from: Variables; to: Variables; step: number; quad?: Quad }

const stringifyQuad = (quad: Quad) => JSON.stringify(quad.toJSON())

const quadElements = ['subject', 'predicate', 'object', 'graph'] as const
type QuadElement = ValuesType<typeof quadElements>

const metaUris = {
  meta: 'https://ldhop.example/meta',
  status: 'https://ldhop.example/status',
  missing: 'https://ldhop.example/status/missing',
  added: 'https://ldhop.example/status/added',
  failed: 'https://ldhop.example/status/failed',
  resource: 'https://ldhop.example/resource',
  variable: 'https://ldhop.example/variable',
}

class Variable extends NamedNode {
  variable: string

  constructor(variable: string) {
    super(metaUris.variable + '/' + variable)
    this.variable = variable
  }

  static getVar(term: Term) {
    return <string>term.value.split('/').pop()
  }
}

type MetaUris = typeof metaUris
type Meta = { [P in keyof MetaUris]: NamedNode }
const meta = <Meta>(
  Object.fromEntries(
    Object.entries(metaUris).map(([key, uri]) => [key, new NamedNode(uri)]),
  )
)

class Moves {
  list: Set<Move> = new Set()
  provides: { [key: string]: Set<Move> } = {}
  providersOf: { [key: string]: Set<Move> } = {}
  byQuad: { [key: string]: Set<Move> } = {}

  add(move: Move) {
    // add step to list
    this.list.add(move)
    // add step to "provides" index
    Object.values(move.from).forEach(terms => {
      terms.forEach(term => {
        this.provides[term.value] ??= new Set()
        this.provides[term.value].add(move)
      })
    })
    // add step to "providersOf" index
    Object.values(move.to).forEach(terms => {
      terms.forEach(term => {
        this.providersOf[term.value] ??= new Set()
        this.providersOf[term.value].add(move)
      })
    })

    // add step to byQuad index
    if (move.quad) {
      this.byQuad[stringifyQuad(move.quad)] ??= new Set()
      this.byQuad[stringifyQuad(move.quad)].add(move)
    }
  }

  remove(move: Move) {
    this.list.delete(move)
    // remove step from "provides" index
    Object.values(move.from).forEach(terms => {
      terms.forEach(term => {
        this.provides[term.value].delete(move)
      })
    })
    // remove step from "providersOf" index
    Object.values(move.to).forEach(terms => {
      terms.forEach(term => {
        this.providersOf[term.value].delete(move)
      })
    })

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
        .flatMap(f => Array.from(f))
        .map(f => f.value)
      const to = Object.values(move.to)
        .flatMap(f => Array.from(f))
        .map(f => f.value)

      output += from.concat(' ') + ' ==> ' + to.concat(' ')
    })

    return output
  }
}

/**
 * @deprecated use LdhopEngine instead
 */
export class QueryAndStore<V extends VariableType = VariableType> {
  store: Store
  query: RdfQuery<V>
  moves = new Moves()

  constructor(
    query: RdfQuery<V>,
    startingPoints: UriVariables,
    store = new Store(),
  ) {
    this.store = store
    this.query = query

    Object.entries(startingPoints).forEach(([variable, uris]) => {
      variable = variable.startsWith('?') ? variable.slice(1) : variable
      uris.forEach(uri => {
        // we add a move for each variable that is provided at the beginning
        // sometimes circular reference would try to remove them
        // we prevent that by making sure the initial variables don't get orphaned, with this move
        const term = new NamedNode(uri)

        this.moves.add({
          from: {},
          to: { [variable]: new Set([term]) },
          step: -1,
        })
        this.addVariable(variable, term)
      })
    })
  }

  getMissingResources() {
    return this.getResources('missing')
  }

  private removeVariable(variable: string, node: Term) {
    this.store.removeQuad(
      new Quad(node, meta.variable, new Variable(variable), meta.meta),
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
        nextVariables[variable].forEach(nextTerm => {
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
    ) as Record<QuadElement, Variable[]>

    const matchQuadElement = (
      step: Match<V>,
      element: QuadElement,
    ): boolean => {
      const el = step[element]
      const node = quad[element]
      if (!el) return true
      if (el.startsWith('?')) {
        if (variables[element].some(v => v.equals(new Variable(el.slice(1)))))
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
      const from: Variables = {}
      for (const element of quadElements) {
        const el = step[element]
        if (el?.startsWith('?')) from[el.slice(1)] = new Set([quad[element]])
      }
      const to = { [step.target.slice(1)]: new Set([quad[step.pick]]) }
      this.moves.add({ step: i, from, to, quad })

      this.addVariable(step.target.slice(1), quad[step.pick])
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
        providedVariables[variable].forEach(term => {
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

  private hopFromVariable(variable: string, node: Term) {
    // find steps relevant for this variable
    const qVariable = `?${variable}`
    const relevantSteps = this.query
      .map((s, i) => [s, i] as const)
      .filter(([step]) => {
        if (typeof step === 'function') return true
        if (
          step.type === 'match' &&
          quadElements.some(el => step[el] === qVariable)
        )
          return true
        if (step.type === 'transform variable' && step.source === qVariable)
          return true
        return false
      })

    relevantSteps.forEach(([step, i]) => {
      if (typeof step === 'function') {
        step(this)
      } else if (step.type === 'transform variable') {
        const transformedNode = step.transform(node)
        if (transformedNode) {
          this.moves.add({
            from: { [step.source.slice(1)]: new Set([node]) },
            to: {
              [step.target.slice(1)]: new Set([transformedNode]),
            },
            step: i,
          })
          this.addVariable(step.target.slice(1), transformedNode)
        }
      } else if (step.type === 'match') {
        // try to match quad(s) relevant for this step
        const generateRules = (step: Match<V>, element: QuadElement) => {
          let outputs = new Set<Term | null>()
          const s = step[element]
          if (!s) outputs.add(null)
          else if (!s.startsWith('?')) outputs.add(new NamedNode(s))
          else if (s.slice(1) === variable) outputs.add(node)
          else {
            const variables = this.store.getSubjects(
              meta.variable,
              new Variable(s.slice(1)),
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
                  const targetVar = step.target.slice(1)
                  const target = quad[step.pick]
                  const from: Variables = {}
                  for (const el of quadElements)
                    if (step[el]?.startsWith('?'))
                      from[step[el]!.slice(1)] = new Set([quad[el]])
                  const to = { [targetVar]: new Set([target]) }
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

  private addVariable(variable: string, node: Term) {
    // if the variable is already added, there's nothing to do
    if (
      this.store.has(
        new Quad(node, meta.variable, new Variable(variable), meta.meta),
      )
    )
      return

    this.store.addQuads([
      // add the new variable
      new Quad(node, meta.variable, new Variable(variable), meta.meta),
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
    const qVariable = `?${variable}`

    const isInAddResources = this.query.some(
      a =>
        typeof a !== 'function' &&
        a.type === 'add resources' &&
        a.variable === qVariable,
    )

    const isInMatch = this.query.some(
      a =>
        typeof a !== 'function' &&
        a.type === 'match' &&
        quadElements.some(el => a[el] === qVariable),
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
  getVariable(variableName: string) {
    if (variableName.startsWith('?')) variableName = variableName.slice(1)
    return this.store
      .getSubjects(meta.variable, new Variable(variableName), meta.meta)
      .map(s => s.value)
  }

  getAllVariables() {
    return this.store
      .getQuads(null, meta.variable, null, meta.meta)
      .reduce((dict: { [key: string]: Set<string> }, quad) => {
        dict[Variable.getVar(quad.object)] ??= new Set<string>()
        dict[Variable.getVar(quad.object)].add(quad.subject.value)
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
