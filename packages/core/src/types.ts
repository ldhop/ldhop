import type { Term } from 'n3'
import type { QueryAndStore } from './index.js'

export type Variable = `?${string}`

export type Constant = '' | `${Letter | UpperLetter | Digit | Special}${string}`

/**
 * @deprecated will be removed in version 1.0
 */
export type TransformStore<V extends Variable> = (qas: QueryAndStore<V>) => void

export type Match<V extends Variable> = {
  type: 'match'
  subject?: V | Constant
  predicate?: V | Constant
  object?: V | Constant
  graph?: V | Constant
  pick: 'subject' | 'predicate' | 'object' | 'graph'
  target: V
}

export type TransformVariable<V extends Variable> = {
  type: 'transform variable'
  source: V
  target: V
  transform: (uri: Term) => Term | undefined
}

export type AddResources<V extends Variable> = {
  type: 'add resources'
  variable: V
}

/**
 * @deprecated Use LdhopQuery instead
 */
export type RdfQuery<V extends Variable = Variable> = (
  | TransformStore<V>
  | Match<V>
  | AddResources<V>
  | TransformVariable<V>
)[]

export type LdhopQuery<V extends Variable> = (
  | Match<V>
  | AddResources<V>
  | TransformVariable<V>
)[]

// reasonable characters other than '?'

type Letter =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'
type UpperLetter = Uppercase<Letter>
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type UrlSafe = '/' | '.' | '_' | '-' | ':' | '#' | '@'
type Punctuation = '!' | '$' | '%' | '&' | '*' | '+' | ',' | ';' | '='
type Brackets = '(' | ')' | '[' | ']' | '{' | '}' | '<' | '>'
type Quotes = "'" | '"' | '`'
type Symbols = '~' | '^' | '|' | '\\'
type Special = UrlSafe | Punctuation | Brackets | Quotes | Symbols
