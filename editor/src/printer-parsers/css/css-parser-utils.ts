import * as csstree from 'css-tree'
import {
  CSSColor,
  CSSColorHSL,
  cssColorHSL,
  CSSColorRGB,
  cssColorRGB,
  cssKeyword,
  CSSKeyword,
  CSSNumber,
  cssNumber,
  CSSNumberUnit,
  LengthUnit,
  LengthUnits,
  parseColor,
  ParsedCurlyBrace,
  parsedCurlyBrace,
  ParsedDoubleBar,
  parsedDoubleBar,
} from '../../components/inspector/common/css-utils'
import {
  Either,
  eitherToMaybe,
  isRight,
  left,
  right,
  Right,
  sequenceEither,
  traverseEither,
  mapEither,
} from '../../core/shared/either'
import * as csstreemissing from '../../missing-types/css-tree'
import utils from '../../utils/utils'
import {
  arrayIndexNotPresentParseError,
  descriptionParseError,
  parseAlternative,
  Parser,
} from '../../utils/value-parser-utils'

export function getLexerPropertyMatches(
  propertyName: string,
  propertyValue: unknown,
  syntaxNamesToFilter?: ReadonlyArray<string>,
): Either<string, Array<LexerMatch>> {
  // todo support for number values
  if (typeof propertyValue === 'string') {
    const ast = csstree.parse(propertyValue, {
      context: 'value',
      positions: true,
    })
    const lexerMatch = (csstree as any).lexer.matchProperty(propertyName, ast)
    if (lexerMatch.error === null && ast.type === 'Value') {
      if (syntaxNamesToFilter != null) {
        const filtered = lexerMatch.matched.match.filter(
          (m: LexerMatch) => 'name' in m.syntax && syntaxNamesToFilter.includes(m.syntax.name),
        )
        return right(filtered)
      } else {
        return right(lexerMatch.matched.match)
      }
    } else {
      return left(lexerMatch.error.message)
    }
  }
  return left(`Property ${propertyName}'s value is not a string`)
}

export function getLexerTypeMatches(typeName: string, value: unknown): Either<string, LexerMatch> {
  if (typeof value === 'string') {
    const ast = csstree.parse(value, {
      context: 'value',
      positions: true,
    })
    const lexerMatch = (csstree as any).lexer.matchType(typeName, ast)
    if (lexerMatch.error === null && ast.type === 'Value') {
      return right(lexerMatch.matched)
    } else {
      return left(lexerMatch.error.message)
    }
  }
  return left(`Property ${typeName}'s value is not a string`)
}

// Keywords

export const parseCSSKeyword: Parser<CSSKeyword> = (match: unknown) => {
  if (isLexerToken(match) && match.syntax != null && match.syntax.type === 'Keyword') {
    return right(cssKeyword(match.syntax.name))
  } else {
    return left(descriptionParseError('Leaf is not a keyword'))
  }
}

export function parseCSSValidKeyword<T extends string>(
  valid: ReadonlyArray<T>,
): Parser<CSSKeyword<T>> {
  return function (value: unknown) {
    const parsed = parseCSSKeyword(value)
    if (isRight(parsed)) {
      if (valid.includes(parsed.value.value as T)) {
        return parsed as Right<CSSKeyword<T>>
      } else {
        return left(descriptionParseError(`${value} is not valid keyword`))
      }
    } else {
      return parsed
    }
  }
}

// Numbers

export const parseNumber: Parser<CSSNumber> = (value) => {
  if (
    isLexerMatch(value) &&
    isNamedSyntaxType(value.syntax, ['number']) &&
    value.match[0] != null &&
    isLexerToken(value.match[0]) &&
    value.match[0].node.type === 'Number'
  ) {
    return right(cssNumber(Number(value.match[0].node.value), null))
  }
  return left(descriptionParseError(`${value} is not a number`))
}

export const parseAngle: Parser<CSSNumber> = (value) => {
  if (
    isLexerMatch(value) &&
    isNamedSyntaxType(value.syntax, ['angle']) &&
    value.match[0] != null &&
    isLexerToken(value.match[0]) &&
    value.match[0].node.type === 'Dimension'
  ) {
    return right(
      cssNumber(Number(value.match[0].node.value), value.match[0].node.unit as CSSNumberUnit),
    )
  }
  return left(descriptionParseError(`${value} is not an angle`))
}

export const parsePercentage: Parser<CSSNumber> = (value: unknown) => {
  if (isLexerMatch(value) && value.match.length === 1) {
    const match = value.match[0]
    if (isLexerToken(match)) {
      if (match.node.type === 'Percentage') {
        const number = Number(match.node.value)
        if (!isNaN(number)) {
          return right(cssNumber(number, '%'))
        } else {
          return left(descriptionParseError(`${match.node.value} is not a valid percentage number`))
        }
      }
    }
  }
  return left(descriptionParseError('leaf is not Percentage'))
}

export const parseLength: Parser<CSSNumber> = (value: unknown) => {
  if (isLexerMatch(value)) {
    if (value.match.length === 1 && value.match[0] != null) {
      const leaf = value.match[0]
      if (isLexerToken(leaf)) {
        if (leaf.node.type === 'Dimension') {
          const number = Number(leaf.node.value)
          const unit = leaf.node.unit ?? 'px'
          if (!isNaN(number) && LengthUnits.includes(unit as LengthUnit)) {
            return right(cssNumber(number, unit as LengthUnit))
          }
        } else if (leaf.node.type === 'Number' && leaf.node.value === '0') {
          return right(cssNumber(0, null))
        }
      }
    } else {
      return left(arrayIndexNotPresentParseError(0))
    }
  }
  return left(descriptionParseError('leaf is not Dimension'))
}

export const parseLengthPercentage: Parser<CSSNumber> = (value: unknown) => {
  if (isLexerMatch(value) && value.match.length === 1) {
    return parseAlternative<CSSNumber>(
      [parseLength, parsePercentage],
      'Could not parse length-percentage',
    )(value.match[0])
  }
  return left(descriptionParseError('Could not parse length-percentage'))
}

export function parseWholeValue<T>(parser: Parser<T>): Parser<T> {
  return function (match: unknown) {
    if (Array.isArray(match) && match.length === 1) {
      return parser(match[0])
    } else {
      return left(descriptionParseError(`Match ${JSON.stringify(match)} is not an array`))
    }
  }
}

export const parseAlphaValue: Parser<CSSNumber> = (value) => {
  if (isLexerMatch(value) && value.match[0] != null) {
    return parseAlternative<CSSNumber>(
      [parseNumber, parsePercentage],
      `Match ${JSON.stringify(value.match[0])} is not a valid number or percentage <alpha-value>`,
    )(value.match[0])
  } else {
    return left(
      descriptionParseError(
        `Match ${JSON.stringify(value)} is not a valid <alpha-value> lexer match`,
      ),
    )
  }
}

export const parseHue: Parser<CSSNumber> = (value) => {
  if (isLexerMatch(value) && value.match[0] != null) {
    return parseAlternative<CSSNumber>(
      [parseNumber, parseAngle],
      `Match ${JSON.stringify(value.match[0])} is not a valid number or angle <hue>`,
    )(value.match[0])
  } else {
    return left(
      descriptionParseError(`Match ${JSON.stringify(value)} is not a valid <hue> lexer match`),
    )
  }
}

export const parseRGBColor: Parser<CSSColorRGB> = (value) => {
  if (isLexerMatch(value) && isNamedSyntaxType(value.syntax, ['rgb()', 'rgba()'])) {
    let percentagesUsed: boolean = false
    let percentageAlpha: boolean = false
    const parsedComponents = utils.stripNulls(
      value.match.map((v) => {
        if (
          isLexerMatch(v) &&
          isNamedSyntaxType(v.syntax, ['percentage', 'number', 'alpha-value'])
        ) {
          switch (v.syntax.name) {
            case 'percentage':
              // lexer guarantees all value types match, so we can safely go off of last used
              percentagesUsed = true
              return eitherToMaybe(parsePercentage(v))
            case 'number':
              percentagesUsed = false
              return eitherToMaybe(parseNumber(v))
            case 'alpha-value':
              const parsed = parseAlphaValue(v)
              if (isRight(parsed) && parsed.value.unit === '%') {
                percentageAlpha = true
                parsed.value.value = parsed.value.value / 100
              }
              return eitherToMaybe(parsed)
            default:
              const _exhaustiveCheck: never = v.syntax.name
              throw `Unexpected syntax name type in rgb()`
          }
        }
        return null
      }),
    )
    if (parsedComponents.length >= 3) {
      const alpha = parsedComponents[3] != null ? parsedComponents[3].value : 1
      return right(
        cssColorRGB(
          parsedComponents[0].value,
          parsedComponents[1].value,
          parsedComponents[2].value,
          alpha,
          percentageAlpha,
          percentagesUsed,
        ),
      )
    }
  }
  return left(descriptionParseError(`Match ${JSON.stringify(value)} is not an rgb(a) color`))
}

export const parseHSLColor: Parser<CSSColorHSL> = (value) => {
  if (isLexerMatch(value) && isNamedSyntaxType(value.syntax, ['hsl()', 'hsla()'])) {
    let percentageAlpha: boolean = false
    const parsedComponents = utils.stripNulls(
      value.match.map((v) => {
        if (isLexerMatch(v) && isNamedSyntaxType(v.syntax, ['hue', 'percentage', 'alpha-value'])) {
          switch (v.syntax.name) {
            case 'hue':
              return eitherToMaybe(parseHue(v))
            case 'percentage':
              return eitherToMaybe(parsePercentage(v))
            case 'alpha-value':
              const parsed = parseAlphaValue(v)
              if (isRight(parsed) && parsed.value.unit === '%') {
                percentageAlpha = true
                parsed.value.value = parsed.value.value / 100
              }
              return eitherToMaybe(parsed)
            default:
              const _exhaustiveCheck: never = v.syntax.name
              throw `Unexpected syntax name type in hsl()`
          }
        }
        return null
      }),
    )
    if (
      parsedComponents.length >= 3 &&
      (parsedComponents[0].unit === 'deg' || parsedComponents[0].unit === null)
    ) {
      const alpha = parsedComponents[3] != null ? parsedComponents[3].value : 1
      return right(
        cssColorHSL(
          parsedComponents[0].value,
          parsedComponents[1].value,
          parsedComponents[2].value,
          alpha,
          percentageAlpha,
        ),
      )
    }
  }
  return left(descriptionParseError(`Match ${JSON.stringify(value)} is not an hsl(a) color`))
}

export const parseLexedColor: Parser<CSSColor> = (value) => {
  if (
    isLexerMatch(value) &&
    value.syntax.type === 'Type' &&
    value.syntax.name === 'color' &&
    value.match.length === 1
  ) {
    if (value.match[0] != null) {
      const leaf = value.match[0]
      if (isLexerMatch(leaf)) {
        if (isNamedSyntaxType(leaf.syntax, ['rgb()', 'rgba()', 'hsl()', 'hsla()'])) {
          const parsed = parseAlternative<CSSColorRGB | CSSColorHSL>(
            [parseRGBColor, parseHSLColor],
            `Value ${JSON.stringify(
              value,
            )} is not an <rgb()>, <rgba()>, <hsl()>, or <hsla()> color`,
          )(leaf)
          return parsed
        } else if (isNamedSyntaxType(leaf.syntax, ['hex-color', 'named-color'])) {
          if (leaf.match[0] != null) {
            const tokenLeaf = leaf.match[0]
            if (isLexerToken(tokenLeaf)) {
              const parsed = parseColor(tokenLeaf.token)
              if (isRight(parsed)) {
                return parsed
              } else {
                return left(descriptionParseError(parsed.value))
              }
            }
          }
        }
        return left(descriptionParseError('color is valid, but not supported by utopia'))
      }
      return left(arrayIndexNotPresentParseError(0))
    }
  }
  return left(descriptionParseError('leaf is not color'))
}

// Curly Braces
export function parseCurlyBraces<T>(
  min: number,
  max: number,
  parsers: Array<Parser<T>>,
): Parser<ParsedCurlyBrace<T>> {
  return function (match: unknown) {
    if (Array.isArray(match) && match.length >= min && match.length <= max) {
      const parsed = sequenceEither(
        match.map((m) => parseAlternative(parsers, 'Match is not valid curly brace value.')(m)),
      )
      return mapEither(parsedCurlyBrace, parsed)
    }
    return left(descriptionParseError('Lexer element is not a match'))
  }
}

export function parseDoubleBar<T>(
  max: number,
  parsers: Array<Parser<T>>,
): Parser<ParsedDoubleBar<T>> {
  return function (match: unknown) {
    if (Array.isArray(match) && match.length > 0 && match.length <= max) {
      const parsed = traverseEither(
        (m: Array<unknown>) => parseAlternative(parsers, 'Match is not valid double bar value.')(m),
        match,
      )
      return mapEither(parsedDoubleBar, parsed)
    }
    return left(descriptionParseError('Lexer element is not a match'))
  }
}

// Type is very much in flex, if you find it doesn't match the data, fix it please
export type LexerToken<T extends string = string> = {
  syntax: csstreemissing.Syntax.Keyword<T> | null
  token: string
  node: csstree.CssNode
}

function isLexerToken(leaf: unknown): leaf is LexerToken<string> {
  const anyLeaf = leaf as any
  return (
    typeof anyLeaf === 'object' &&
    anyLeaf.token != null &&
    anyLeaf.node != null &&
    anyLeaf.node.loc != null
  )
}

// Type is very much in flex, if you find it doesn't match the data, fix it please
export type LexerMatch<
  T extends csstreemissing.Syntax.SyntaxItem = csstreemissing.Syntax.SyntaxItem
> = {
  syntax: T
  match: Array<LexerElement>
}

export function isLexerMatch(parent: unknown): parent is LexerMatch {
  const anyParent = parent as any
  return anyParent.match != null && Array.isArray(anyParent.match)
}

export type LexerElement = LexerMatch | LexerToken<string>

export function isNamedSyntaxType<T extends string>(
  syntax: csstreemissing.Syntax.SyntaxItem,
  names: ReadonlyArray<T>,
): syntax is csstreemissing.Syntax.Type<T> {
  return syntax.type === 'Type' && names.includes(syntax.name as T)
}

export interface PreparsedLayer {
  type: 'PREPARSED_LAYER'
  value: string
  enabled: boolean
}

export function preparsedLayer(value: string, enabled: boolean): PreparsedLayer {
  return {
    type: 'PREPARSED_LAYER',
    value,
    enabled,
  }
}

export function traverseForPreparsedLayers(
  remaining: string,
  inComment = false,
  layers: Array<PreparsedLayer> = [],
  workingValue = '',
): Array<PreparsedLayer> {
  if (remaining.length === 0) {
    const trimmedWorkingValue = workingValue.trim()
    if (trimmedWorkingValue !== '') {
      layers.push(preparsedLayer(trimmedWorkingValue, !inComment))
    }
    return layers
  }
  switch (remaining[0]) {
    case '/': {
      if (remaining[1] === '*') {
        const trimmedWorkingValue = workingValue.trim()
        if (trimmedWorkingValue !== '') {
          layers.push(preparsedLayer(trimmedWorkingValue, !inComment))
        }
        return traverseForPreparsedLayers(remaining.slice(2), true, layers, '')
      } else {
        return traverseForPreparsedLayers(remaining.slice(1), inComment, layers, workingValue + '/')
      }
    }
    case '*': {
      if (inComment && remaining[1] === '/') {
        layers.push(preparsedLayer(workingValue.trim(), !inComment))
        return traverseForPreparsedLayers(remaining.slice(2), false, layers)
      } else {
        return traverseForPreparsedLayers(remaining.slice(1), inComment, layers, workingValue + '*')
      }
    }
    case ',': {
      if (inComment) {
        return traverseForPreparsedLayers(remaining.slice(1), inComment, layers, workingValue)
      } else {
        layers.push(preparsedLayer(workingValue.trim(), !inComment))
        return traverseForPreparsedLayers(remaining.slice(1), false, layers)
      }
    }
    default: {
      return traverseForPreparsedLayers(
        remaining.slice(1),
        inComment,
        layers,
        workingValue + remaining[0],
      )
    }
  }
}

export function cssValueOnlyContainsComments(cssValue: string): boolean {
  const layers = traverseForPreparsedLayers(cssValue)
  return layers.every((l) => l.enabled === false)
}
