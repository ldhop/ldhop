type AfterPick<V extends Variable> = Omit<LdhopQueryBuilder<V>, 'add'> &
  Picks<V> & { add: (v?: V) => LdhopQueryBuilder<V> }

type Picks<V extends Variable> = {
  s: <N extends Variable>(t: N) => AfterPick<V | N>
  p: <N extends Variable>(t: N) => AfterPick<V | N>
  o: <N extends Variable>(t: N) => AfterPick<V | N>
  g: <N extends Variable>(t: N) => AfterPick<V | N>
}

import type { Term } from 'n3'
import type { Constant, LdhopQuery, Variable } from './types.js'

export class LdhopQueryBuilder<V extends Variable> {
  query: LdhopQuery<V> = []

  constructor(query?: LdhopQuery<V>) {
    if (query) this.query = query
  }

  match(
    s?: V | Constant | null,
    p?: V | Constant | null,
    o?: V | Constant | null,
    g?: V | Constant | null,
  ): Picks<V> {
    return {
      s: <N extends Variable>(t: N) => this._match('subject', t, s, p, o, g),
      p: <N extends Variable>(t: N) => this._match('predicate', t, s, p, o, g),
      o: <N extends Variable>(t: N) => this._match('object', t, s, p, o, g),
      g: <N extends Variable>(t: N) => this._match('graph', t, s, p, o, g),
    }
  }

  private _match<NV extends Variable>(
    pick: 'subject' | 'predicate' | 'object' | 'graph',
    target: NV,
    s?: V | Constant | null,
    p?: V | Constant | null,
    o?: V | Constant | null,
    g?: V | Constant | null,
  ): AfterPick<V | NV> {
    const builder = new LdhopQueryBuilder<V | NV>([
      ...this.query,
      {
        type: 'match',
        ...(s ? { subject: s } : {}),
        ...(p ? { predicate: p } : {}),
        ...(o ? { object: o } : {}),
        ...(g ? { graph: g } : {}),
        pick,
        target,
      },
    ])

    return Object.assign(builder, {
      s: <N extends Variable>(t: N) => builder._match('subject', t, s, p, o, g),
      p: <N extends Variable>(t: N) =>
        builder._match('predicate', t, s, p, o, g),
      o: <N extends Variable>(t: N) => builder._match('object', t, s, p, o, g),
      g: <N extends Variable>(t: N) => builder._match('graph', t, s, p, o, g),
      add: (variable?: V | NV) =>
        new LdhopQueryBuilder<V | NV>([
          ...builder.query,
          { type: 'add resources', variable: variable ?? target },
        ]),
    })
  }

  add(variable: V) {
    return new LdhopQueryBuilder<V>([
      ...this.query,
      { type: 'add resources', variable },
    ])
  }

  transform<N extends Variable>(
    source: V,
    target: N,
    transform: (s: Term) => Term | undefined,
  ) {
    return new LdhopQueryBuilder<V | N>([
      ...this.query,
      { type: 'transform variable', source, target, transform },
    ])
  }

  concat<V2 extends Variable>(
    other: Omit<LdhopQueryBuilder<V2>, '_match' | 'add'> | LdhopQuery<V2>,
  ) {
    return new LdhopQueryBuilder<V | V2>([...this.query, ...other])
  }

  [Symbol.iterator](): Iterator<LdhopQuery<V>[number]> {
    return this.query[Symbol.iterator]()
  }

  toArray() {
    return this.query
  }
}

/**
 * Build LdhopQuery array with chain of functions
 *
 * usage:
 * const query = ldhop('?starting', '?variables')
 *   .match(s, p, o, g)
 *   .s('?s')
 *   .p('?p')
 *   .o('?o')
 *   .g('?g')
 *   .add()
 *   .transform('?s', '?t', (t: Term) => change(t))
 *   .concat(otherQuery)
 *   .toArray()
 */
export function ldhop<Start extends Variable>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ...starting: Start[]
): LdhopQueryBuilder<Start> {
  return new LdhopQueryBuilder<Start>([])
}
