import { parseNameValue } from './names.js';
import { parseExpression, parseReservedBody } from './expression.js';
import type { ParseContext } from './parse-cst.js';
import type * as CST from './types.js';
import { whitespaces } from './util.js';
import { parseVariable } from './values.js';

export function parseDeclarations(ctx: ParseContext): {
  declarations: CST.Declaration[];
  end: number;
} {
  const { source } = ctx;
  let pos = whitespaces(source, 0);
  const declarations: CST.Declaration[] = [];
  loop: while (source[pos] === '.') {
    const keyword = parseNameValue(source, pos + 1);
    if (keyword.length !== keyword.value.length) {
      ctx.onError('parse-error', pos + 1, pos + 1 + keyword.length);
    }
    let decl;
    switch (keyword.value) {
      case '':
      case 'match':
        break loop;
      case 'input':
        decl = parseInputDeclaration(ctx, pos, keyword);
        break;
      case 'local':
        decl = parseLocalDeclaration(ctx, pos, keyword);
        break;
      default:
        decl = parseReservedStatement(ctx, pos, keyword);
    }
    declarations.push(decl);
    pos = decl.end;
    pos += whitespaces(source, pos);
  }
  return { declarations, end: pos };
}

function parseInputDeclaration(
  ctx: ParseContext,
  start: number,
  kw: { value: string; length: number }
): CST.InputDeclaration {
  //
  let pos = start + 1 + kw.length; // '.input'
  const keyword: CST.Syntax<'.input'> = { start, end: pos, value: '.input' };
  pos += whitespaces(ctx.source, pos);

  const value = parseDeclarationValue(ctx, pos);
  if (value.type === 'expression') {
    if (value.markup || value.arg?.type !== 'variable') {
      ctx.onError('bad-input-expression', value.start, value.end);
    }
  }

  return { type: 'input', start, end: value.end, keyword, value };
}

function parseLocalDeclaration(
  ctx: ParseContext,
  start: number,
  kw: { value: string; length: number }
): CST.LocalDeclaration {
  const { source } = ctx;

  let pos = start + 1 + kw.length; // '.local'
  const keyword: CST.Syntax<'.local'> = { start, end: pos, value: '.local' };
  const ws = whitespaces(source, pos);
  pos += ws;

  if (ws === 0) ctx.onError('missing-syntax', pos, ' ');

  let target: CST.VariableRef | CST.Junk;
  if (source[pos] === '$') {
    target = parseVariable(ctx, pos);
    pos = target.end;
  } else {
    const junkStart = pos;
    const junkEndOffset = source.substring(pos).search(/[\t\n\r ={}]/);
    pos = junkEndOffset === -1 ? source.length : pos + junkEndOffset;
    target = {
      type: 'junk',
      start: junkStart,
      end: pos,
      source: source.substring(junkStart, pos)
    };
    ctx.onError('missing-syntax', junkStart, '$');
  }

  pos += whitespaces(source, pos);
  let equals: CST.Syntax<'='> | undefined;
  if (source[pos] === '=') {
    equals = { start: pos, end: pos + 1, value: '=' };
    pos += 1;
  } else {
    ctx.onError('missing-syntax', pos, '=');
  }

  pos += whitespaces(source, pos);
  const value = parseDeclarationValue(ctx, pos);

  return {
    type: 'local',
    start,
    end: value.end,
    keyword,
    target,
    equals,
    value
  };
}

function parseReservedStatement(
  ctx: ParseContext,
  start: number,
  kw: { value: string; length: number }
): CST.ReservedStatement {
  const kwEnd = start + 1 + kw.length;
  let pos = kwEnd;
  pos += whitespaces(ctx.source, pos);

  const body = parseReservedBody(ctx, pos);
  let end = body.end;
  pos = end + whitespaces(ctx.source, end);

  const values: CST.Expression[] = [];
  while (ctx.source[pos] === '{') {
    if (ctx.source.startsWith('{{', pos)) break;
    const value = parseExpression(ctx, pos);
    values.push(value);
    end = value.end;
    pos = end + whitespaces(ctx.source, end);
  }
  if (values.length === 0) ctx.onError('missing-syntax', end, '{');

  return {
    type: 'reserved-statement',
    start,
    end,
    keyword: { start, end: kwEnd, value: '.' + kw.value },
    body,
    values
  };
}

function parseDeclarationValue(
  ctx: ParseContext,
  start: number
): CST.Expression | CST.Junk {
  const { source } = ctx;
  if (source[start] === '{') return parseExpression(ctx, start);

  const junkEndOffset = source.substring(start).search(/\.[a-z]|{{/);
  const end = junkEndOffset === -1 ? source.length : start + junkEndOffset;
  ctx.onError('missing-syntax', start, '{');
  return { type: 'junk', start, end, source: source.substring(start, end) };
}
