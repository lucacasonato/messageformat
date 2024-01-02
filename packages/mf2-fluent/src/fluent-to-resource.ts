import * as Fluent from '@fluent/syntax';
import { Message, MessageFormat, MessageFormatOptions } from 'messageformat';
import type { FluentMessageResource, FluentMessageResourceData } from '.';
import { fluentToMessage } from './fluent-to-message';
import { getFluentFunctions } from './functions';

/**
 * Compile a Fluent resource (i.e. an FTL file) into a Map of
 * {@link messageformat#MessageFormat} instances.
 *
 * @remarks
 * A runtime provided by {@link getFluentFunctions} is automatically used in these instances.
 *
 * @beta
 * @param source - A Fluent resource,
 *   as the string contents of an FTL file,
 *   as a {@link https://projectfluent.org/fluent.js/syntax/classes/resource.html | Fluent.Resource},
 *   or in the shape output by {@link fluentToResourceData} as `data`.
 * @param locales - The locale code or codes to use for all of the resource's messages.
 * @param options - The MessageFormat constructor options to use for all of the resource's messages.
 * @param options.detectNumberSelection - Set `false` to disable number selector detection based on keys.
 */
export function fluentToResource(
  source: string | Fluent.Resource | FluentMessageResourceData,
  locales?: string | string[],
  options?: MessageFormatOptions & { detectNumberSelection?: boolean }
): FluentMessageResource {
  const res: FluentMessageResource = new Map();

  const { detectNumberSelection, ...opt } = options ?? {};
  opt.functions = Object.assign(getFluentFunctions(res), options?.functions);

  const data =
    typeof source === 'string' || source instanceof Fluent.Resource
      ? fluentToResourceData(source, { detectNumberSelection }).data
      : source;
  for (const [id, group] of data) {
    let rg = res.get(id);
    if (!rg) {
      rg = new Map();
      res.set(id, rg);
    }
    for (const [attr, msg] of group) {
      rg.set(attr, new MessageFormat(msg, locales, opt));
    }
  }

  return res;
}

/**
 * Compile a Fluent resource (i.e. an FTL file) into a Map of
 * {@link messageformat#Message} data objects.
 *
 * @beta
 * @param source - A Fluent resource,
 *   as the string contents of an FTL file or
 *   as a {@link https://projectfluent.org/fluent.js/syntax/classes/resource.html | Fluent.Resource}
 * @param options.detectNumberSelection - Set `false` to disable number selector detection based on keys.
 * @returns An object containing the messages as `data` and any resource-level
 *   `comments` of the resource.
 */
export function fluentToResourceData(
  source: string | Fluent.Resource,
  options?: { detectNumberSelection?: boolean }
): {
  data: FluentMessageResourceData;
  comments: string;
} {
  const ast =
    typeof source === 'string'
      ? Fluent.parse(source, { withSpans: false })
      : source;
  const data: FluentMessageResourceData = new Map();
  let groupComment = '';
  const resourceComments: string[] = [];
  for (const msg of ast.body) {
    switch (msg.type) {
      case 'Message':
      case 'Term': {
        const id = msg.type === 'Term' ? `-${msg.id.name}` : msg.id.name;
        const group: Map<string, Message> = new Map();
        if (msg.value) {
          const entry = fluentToMessage(msg.value, options);
          if (msg.comment) entry.comment = msg.comment.content;
          if (groupComment) {
            entry.comment = entry.comment
              ? `${groupComment}\n\n${entry.comment}`
              : groupComment;
          }
          group.set('', entry);
        }
        for (const attr of msg.attributes) {
          group.set(attr.id.name, fluentToMessage(attr.value, options));
        }
        data.set(id, group);
        break;
      }
      case 'GroupComment':
        groupComment = msg.content;
        break;
      case 'ResourceComment':
        resourceComments.push(msg.content);
        break;
    }
  }

  return { data, comments: resourceComments.join('\n\n') };
}
