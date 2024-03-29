import differenceWith from 'lodash/differenceWith'
import intersection from 'lodash/intersection'
import { NamedNode, Quad, Store } from 'n3'
import { Match, RdfQuery, TransformVariable } from '.'
import { removeHashFromURI } from './utils/helpers'

type Variables = { [key: string]: Set<string> }

type Move = { from: Variables; to: Variables; step: number; quad?: Quad }

const stringifyQuad = (quad: Quad) => JSON.stringify(quad.toJSON())

const meta = {
  meta: 'https://ldhop.example/meta',
  status: 'https://ldhop.example/status',
  missing: 'https://ldhop.example/status/missing',
  added: 'https://ldhop.example/status/added',
  resource: 'https://ldhop.example/resource',
  variable: 'https://ldhop.example/variable',
}

class Moves {
  list: Set<Move> = new Set()
  provides: { [key: string]: Set<Move> } = {}
  providedBy: { [key: string]: Set<Move> } = {}
  byQuad: { [key: string]: Set<Move> } = {}

  add(move: Move) {
    // add step to list
    this.list.add(move)
    // add step to "provides" index
    Object.values(move.from).forEach(values => {
      values.forEach(value => {
        this.provides[value] ??= new Set()
        this.provides[value].add(move)
      })
    })
    // add step to "providedBy" index
    Object.values(move.to).forEach(values => {
      values.forEach(value => {
        this.providedBy[value] ??= new Set()
        this.providedBy[value].add(move)
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
    Object.values(move.from).forEach(values => {
      values.forEach(value => {
        this.provides[value].delete(move)
      })
    })
    // add step to "providedBy" index
    Object.values(move.to).forEach(values => {
      values.forEach(value => {
        this.providedBy[value].delete(move)
      })
    })

    // add step to byQuad index
    if (move.quad) {
      this.byQuad[stringifyQuad(move.quad)].delete(move)
    }
  }
}

export class QueryAndStore {
  store: Store
  query: RdfQuery
  moves = new Moves()

  constructor(query: RdfQuery, startingPoints: Variables, store = new Store()) {
    this.store = store
    this.query = query

    Object.entries(startingPoints).forEach(([variable, uris]) => {
      uris.forEach(uri => {
        // we add a move for each variable that is provided at the beginning
        // sometimes circular reference would try to remove them
        // we prevent that by making sure the initial variables don't get orphaned, with this move
        this.moves.add({
          from: {},
          to: { [variable]: new Set([uri]) },
          step: -1,
        })
        this.addVariable(variable, uri)
      })
    })
  }

  getMissingResources() {
    const matches = this.store.getSubjects(
      new NamedNode(meta.status),
      new NamedNode(meta.missing),
      new NamedNode(meta.meta),
    )

    return matches.map(m => m.value)
  }

  private removeVariable(variable: string, uri: string) {
    const uriNode = new NamedNode(uri)
    const resourceNode = new NamedNode(removeHashFromURI(uri))
    this.store.removeQuads([
      new Quad(
        uriNode,
        new NamedNode(meta.variable),
        new NamedNode(meta.variable + '/' + variable),
        new NamedNode(meta.meta),
      ),
      new Quad(
        uriNode,
        new NamedNode(meta.resource),
        resourceNode,
        new NamedNode(meta.meta),
      ),
    ])

    this.store.removeQuads(
      this.store.getQuads(
        resourceNode,
        new NamedNode(meta.status),
        null,
        new NamedNode(meta.meta),
      ),
    )

    this.removeResource(resourceNode.value)

    // if the removed variable leads through some step to other variable, & nothing else leads to that variable, remove that variable

    const movesFromVariable = [
      ...(this.moves.provides[uri] ?? new Set()),
    ].filter(move => move.from[variable]?.has(uri))

    for (const move of movesFromVariable) {
      const nextVariables = move.to
      this.moves.remove(move)
      for (const variable in nextVariables) {
        nextVariables[variable].forEach(nextVar => {
          // see if there's any provision of this variable left
          const a = [...(this.moves.providedBy[nextVar] ?? new Set())].filter(
            a => a.to[variable]?.has(nextVar),
          )
          if (a.length === 0) this.removeVariable(variable, nextVar)
        })
      }
    }
  }

  addResource(resource: string, quads: Quad[]) {
    const oldResource = [
      ...this.store.match(null, null, null, new NamedNode(resource)),
    ]

    const [additions, deletions] = quadDiff(quads, oldResource as Quad[])

    deletions.forEach(quad => this.removeQuad(quad))

    this.store.addQuads(additions)

    for (const step of this.query) {
      if (typeof step === 'function') step(this)
      else if (step.type === 'match') this.run(step, resource)
    }

    // mark the resource as added
    this.store.removeQuad(
      new NamedNode(removeHashFromURI(resource)),
      new NamedNode(meta.status),
      new NamedNode(meta.missing),
      new NamedNode(meta.meta),
    )
    this.store.addQuad(
      new NamedNode(removeHashFromURI(resource)),
      new NamedNode(meta.status),
      new NamedNode(meta.added),
      new NamedNode(meta.meta),
    )
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

      for (const variable in providedVariables) {
        providedVariables[variable].forEach(v => {
          // which moves provide this variable
          const providingMoves = [...this.moves.providedBy[v]].filter(a =>
            a.to[variable]?.has(v),
          )
          if (providingMoves.length === 0) this.removeVariable(variable, v)
        })
      }
    })
  }

  // getRelevantSteps(q: Quad) {
  //   // first get variables for subject, predicate, and object
  //   Object.entries(this.variables).map(([variable, set]) => {
  //     if (set.has(q.subject.termType)) 1
  //     // TODO
  //   })
  //   // then

  //   return [] as Match[]
  // }

  // edit variable with transform function
  // currently it works for URIs, maybe we want to generalize
  transformVariable(step: TransformVariable) {
    const { source: sourceRaw, target: targetRaw, transform } = step
    const source = sourceRaw.slice(1)
    const target = targetRaw.slice(1)
    const stepIndex = this.query.findIndex(s => s === step)
    const sourceUris = this.getVariable(source)
    for (const uri of sourceUris) {
      const transformedUri = transform(uri)
      const existingMoves = [...this.moves.list].filter(
        m =>
          m.from[source]?.has(uri) &&
          m.to[target]?.has(transformedUri) &&
          m.step === stepIndex,
      )

      if (existingMoves.length > 0) continue

      this.addVariable(target, transformedUri)
      this.moves.add({
        from: { [source]: new Set([uri]) },
        to: { [target]: new Set([transformedUri]) },
        step: stepIndex,
      })
    }
  }

  run(step: Match, resource: string) {
    const stepIndex = this.query.findIndex(s => s === step)

    const config = {
      subject: [null] as (string | null)[],
      predicate: [null] as (string | null)[],
      object: [null] as (string | null)[],
      graph: [null] as (string | null)[],
    }

    for (const quadElement of [
      'subject',
      'predicate',
      'object',
      'graph',
    ] as const) {
      const definition = step[quadElement]
      if (definition) {
        config[quadElement] = definition.startsWith('?')
          ? // exchange variable to URIs on given position within current resource
            intersection(
              // URIs in variable
              this.store
                .getSubjects(
                  new NamedNode(meta.variable),
                  new NamedNode(meta.variable + '/' + definition.slice(1)),
                  null,
                )
                .map(s => s.value),
              // URIs at given position within resource
              quadElement === 'graph'
                ? [resource]
                : this.store[
                    quadElement === 'subject'
                      ? 'getSubjects'
                      : quadElement === 'predicate'
                        ? 'getPredicates'
                        : 'getObjects'
                  ](null, null, new NamedNode(resource)).map(x => x.value),
            )
          : [definition]
      }
    }

    const output = new Set<string>()

    for (const s of config.subject) {
      for (const p of config.predicate) {
        for (const o of config.object) {
          for (const g of config.graph) {
            this.store
              .getQuads(
                s === null ? s : new NamedNode(s),
                p === null ? p : new NamedNode(p),
                o === null ? o : new NamedNode(o),
                g === null ? new NamedNode(resource) : new NamedNode(g),
              )
              .forEach(q => {
                const target = q[step.pick].value
                output.add(target)
                const move: Move = {
                  from: {},
                  to: {},
                  step: stepIndex,
                  quad: q,
                }

                if (step.subject?.startsWith('?')) {
                  const variable = step.subject.slice(1)
                  move.from[variable] ??= new Set()
                  move.from[variable].add(s as string)
                }
                if (step.predicate?.startsWith('?')) {
                  const variable = step.predicate.slice(1)
                  move.from[variable] ??= new Set()
                  move.from[variable].add(p as string)
                }
                if (step.object?.startsWith('?')) {
                  const variable = step.object.slice(1)
                  move.from[variable] ??= new Set()
                  move.from[variable].add(o as string)
                }
                if (step.graph?.startsWith('?')) {
                  const variable = step.graph.slice(1)
                  move.from[variable] ??= new Set()
                  move.from[variable].add(g as string)
                }

                move.to[step.target.slice(1)] ??= new Set()
                move.to[step.target.slice(1)].add(target)

                this.moves.add(move)
              })
          }
        }
      }
    }

    for (const next of output) {
      this.addVariable(step.target.slice(1), next)
    }
  }

  private addVariable(variable: string, uri: string) {
    const uriNode = new NamedNode(uri)
    const resourceNode = new NamedNode(removeHashFromURI(uri))

    // if the variable is already added, there's nothing to do
    if (
      this.store.has(
        new Quad(
          uriNode,
          new NamedNode(meta.variable),
          new NamedNode(meta.variable + '/' + variable),
          new NamedNode(meta.meta),
        ),
      ) &&
      this.store.has(
        new Quad(
          uriNode,
          new NamedNode(meta.resource),
          resourceNode,
          new NamedNode(meta.meta),
        ),
      )
    )
      return

    this.store.addQuads([
      // add the new variable
      new Quad(
        uriNode,
        new NamedNode(meta.variable),
        new NamedNode(meta.variable + '/' + variable),
        new NamedNode(meta.meta),
      ),
      // make a resource
      new Quad(
        uriNode,
        new NamedNode(meta.resource),
        resourceNode,
        new NamedNode(meta.meta),
      ),
    ])

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
        (a.subject === qVariable ||
          a.predicate === qVariable ||
          a.object === qVariable ||
          a.graph === qVariable),
    )

    const isNeeded = isInAddResources || isInMatch

    if (
      isNeeded &&
      this.store.match(
        resourceNode,
        new NamedNode(meta.status),
        null,
        new NamedNode(meta.meta),
      ).size === 0
    ) {
      this.store.addQuad(
        resourceNode,
        new NamedNode(meta.status),
        new NamedNode(meta.missing),
        new NamedNode(meta.meta),
      )
    }

    // if there is transform step for this variable, transform it

    // find transform variable steps for this variable
    const steps = this.query.filter(
      (step): step is TransformVariable =>
        typeof step !== 'function' &&
        step.type === 'transform variable' &&
        step.source === qVariable,
    )

    // and run each step
    for (const step of steps) {
      this.transformVariable(step)
    }
  }

  /**
   * If you provide variable name, this method will return URIs that belong to that variable
   */
  getVariable(variableName: string) {
    return this.store
      .getSubjects(
        new NamedNode(meta.variable),
        new NamedNode(meta.variable + '/' + variableName),
        null,
      )
      .map(s => s.value)
  }

  getAllVariables() {
    return this.store
      .getQuads(null, new NamedNode(meta.variable), null, null)
      .reduce((dict: { [key: string]: Set<string> }, quad) => {
        dict[quad.object.value.split('/').pop() as string] ??= new Set<string>()
        dict[quad.object.value.split('/').pop() as string].add(
          quad.subject.value,
        )
        return dict
      }, {})
  }
}

const quadDiff = (newQuads: Quad[], oldQuads: Quad[]) => {
  // additions are new quads minus old quads
  const additions = differenceWith(newQuads, oldQuads, (a, b) => a.equals(b))
  // deletions are old quads minus new quads
  const deletions = differenceWith(oldQuads, newQuads, (a, b) => a.equals(b))

  return [additions, deletions] as const
}
