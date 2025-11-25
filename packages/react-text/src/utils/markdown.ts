import { Alignment, type CustomText, type LinkElement, type ParagraphElement } from '@plait/common';

type MarkState = {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underlined?: boolean;
  code?: boolean;
  color?: string;
  ['font-size']?: string;
};

const HEADING_FONT_SIZE_MAP: Record<number, string> = {
  1: '28px',
  2: '24px',
  3: '20px',
  4: '18px',
  5: '16px',
  6: '14px',
};

const BULLET_PREFIX = '\u2022 ';
const UNCHECKED_BOX_PREFIX = '\u2610 ';
const CHECKED_BOX_PREFIX = '\u2611 ';
const HORIZONTAL_RULE = '\u2015\u2015\u2015';

const ensureText = (value: string, marks: MarkState = {}): CustomText => ({
  text: value,
  ...marks,
});

const append = (
  target: (CustomText | LinkElement)[],
  values: (CustomText | LinkElement | null | undefined)[]
) => {
  values.forEach((item) => {
    if (!item) {
      return;
    }
    target.push(item);
  });
};

const cloneMarks = (marks: MarkState, extra: MarkState = {}): MarkState => ({
  ...marks,
  ...extra,
});

const findClosing = (
  value: string,
  start: number,
  openChar: string,
  closeChar: string
): number => {
  let depth = 0;
  for (let index = start; index < value.length; index++) {
    const char = value[index];
    if (char === '\\') {
      index++;
      continue;
    }
    if (char === openChar) {
      depth++;
      continue;
    }
    if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
};

const findClosingBacktick = (value: string, start: number): number => {
  for (let index = start + 1; index < value.length; index++) {
    if (value[index] === '\\') {
      index++;
      continue;
    }
    if (value[index] === '`') {
      return index;
    }
  }
  return -1;
};

const getHeadingFontSize = (depth: number): string | undefined => {
  return HEADING_FONT_SIZE_MAP[Math.max(1, Math.min(depth, 6))];
};

const parseInline = (
  input: string,
  marks: MarkState = {}
): (CustomText | LinkElement)[] => {
  if (!input) {
    return [ensureText('', marks)];
  }
  const result: (CustomText | LinkElement)[] = [];
  let index = 0;
  let buffer = '';

  const flushBuffer = () => {
    if (buffer) {
      result.push(ensureText(buffer, marks));
      buffer = '';
    }
  };

  const parseWithMarks = (content: string, extra: MarkState) => {
    append(result, parseInline(content, cloneMarks(marks, extra)));
  };

  while (index < input.length) {
    const char = input[index];
    if (char === '\\') {
      if (index + 1 < input.length) {
        buffer += input[index + 1];
        index += 2;
      } else {
        index++;
      }
      continue;
    }

    if (char === '[') {
      const closingBracket = findClosing(input, index, '[', ']');
      const openingParen =
        closingBracket !== -1 ? input.indexOf('(', closingBracket + 1) : -1;
      const closingParen =
        openingParen !== -1 ? findClosing(input, openingParen, '(', ')') : -1;
      if (
        closingBracket !== -1 &&
        openingParen === closingBracket + 1 &&
        closingParen !== -1
      ) {
        flushBuffer();
        const label = input.slice(index + 1, closingBracket);
        const url = input.slice(openingParen + 1, closingParen);
        const children = parseInline(label, marks);
        result.push({
          type: 'link',
          url,
          children: children.length
            ? children
            : [ensureText('', marks)],
        });
        index = closingParen + 1;
        continue;
      }
    }

    if (char === '`') {
      const closing = findClosingBacktick(input, index);
      if (closing !== -1) {
        flushBuffer();
        const codeText = input.slice(index + 1, closing);
        result.push(ensureText(codeText, cloneMarks(marks, { code: true })));
        index = closing + 1;
        continue;
      }
    }

    if (input.startsWith('***', index)) {
      const closing = input.indexOf('***', index + 3);
      if (closing !== -1) {
        flushBuffer();
        parseWithMarks(input.slice(index + 3, closing), {
          bold: true,
          italic: true,
        });
        index = closing + 3;
        continue;
      }
    }

    if (input.startsWith('___', index)) {
      const closing = input.indexOf('___', index + 3);
      if (closing !== -1) {
        flushBuffer();
        parseWithMarks(input.slice(index + 3, closing), {
          bold: true,
          italic: true,
        });
        index = closing + 3;
        continue;
      }
    }

    if (input.startsWith('**', index)) {
      const closing = input.indexOf('**', index + 2);
      if (closing !== -1) {
        flushBuffer();
        parseWithMarks(input.slice(index + 2, closing), { bold: true });
        index = closing + 2;
        continue;
      }
    }

    if (input.startsWith('__', index)) {
      const closing = input.indexOf('__', index + 2);
      if (closing !== -1) {
        flushBuffer();
        parseWithMarks(input.slice(index + 2, closing), { bold: true });
        index = closing + 2;
        continue;
      }
    }

    if (input.startsWith('~~', index)) {
      const closing = input.indexOf('~~', index + 2);
      if (closing !== -1) {
        flushBuffer();
        parseWithMarks(input.slice(index + 2, closing), { strike: true });
        index = closing + 2;
        continue;
      }
    }

    if (input.startsWith('++', index)) {
      const closing = input.indexOf('++', index + 2);
      if (closing !== -1) {
        flushBuffer();
        parseWithMarks(input.slice(index + 2, closing), { underlined: true });
        index = closing + 2;
        continue;
      }
    }

    if (input.startsWith('==', index)) {
      const closing = input.indexOf('==', index + 2);
      if (closing !== -1) {
        flushBuffer();
        parseWithMarks(input.slice(index + 2, closing), { underlined: true });
        index = closing + 2;
        continue;
      }
    }

    if (char === '*' || char === '_') {
      const closing = input.indexOf(char, index + 1);
      if (closing !== -1) {
        flushBuffer();
        parseWithMarks(input.slice(index + 1, closing), { italic: true });
        index = closing + 1;
        continue;
      }
    }

    buffer += char;
    index++;
  }
  flushBuffer();
  return result.length ? result : [ensureText('', marks)];
};

const parseCodeLine = (line: string): (CustomText | LinkElement)[] => {
  return [ensureText(line, { code: true })];
};

const parseBlockLine = (line: string): (CustomText | LinkElement)[] => {
  const result: (CustomText | LinkElement)[] = [];
  const trimmed = line.trimEnd();

  if (!trimmed) {
    return [ensureText('')];
  }

  const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    const depth = headingMatch[1].length;
    const content = headingMatch[2];
    const fontSize = getHeadingFontSize(depth);
    const marks: MarkState = { bold: true };
    if (fontSize) {
      marks['font-size'] = fontSize;
    }
    append(result, parseInline(content, marks));
    return result;
  }

  const blockquoteMatch = trimmed.match(/^>\s?(.*)$/);
  if (blockquoteMatch) {
    result.push(ensureText('> '));
    append(result, parseInline(blockquoteMatch[1], { italic: true }));
    return result;
  }

  const taskMatch = trimmed.match(/^[-*+]\s+\[( |x|X)\]\s+(.*)$/);
  if (taskMatch) {
    const checked = taskMatch[1].toLowerCase() === 'x';
    result.push(ensureText(checked ? CHECKED_BOX_PREFIX : UNCHECKED_BOX_PREFIX));
    append(result, parseInline(taskMatch[2]));
    return result;
  }

  const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
  if (bulletMatch) {
    result.push(ensureText(BULLET_PREFIX));
    append(result, parseInline(bulletMatch[1]));
    return result;
  }

  const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
  if (orderedMatch) {
    result.push(ensureText(`${orderedMatch[1]}. `));
    append(result, parseInline(orderedMatch[2]));
    return result;
  }

  if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
    result.push(ensureText(HORIZONTAL_RULE));
    return result;
  }

  append(result, parseInline(trimmed));
  return result;
};

export const normalizeMarkdownString = (value: string): string => {
  if (!value) {
    return '';
  }
  return value.replace(/\r\n?/g, '\n');
};

export const parseMarkdownParagraph = (
  markdown: string,
  align?: Alignment
): ParagraphElement => {
  const normalized = normalizeMarkdownString(markdown);
  const lines = normalized.split('\n');
  const children: (CustomText | LinkElement)[] = [];
  let inCodeBlock = false;

  lines.forEach((line, index) => {
    if (inCodeBlock) {
      if (/^\s*```/.test(line)) {
        inCodeBlock = false;
      } else {
        append(children, parseCodeLine(line));
        if (index < lines.length - 1) {
          children.push(ensureText('\n'));
        }
      }
      return;
    }

    if (/^\s*```/.test(line)) {
      inCodeBlock = true;
      return;
    }

    append(children, parseBlockLine(line));
    if (index < lines.length - 1) {
      children.push(ensureText('\n'));
    }
  });

  if (!children.length) {
    children.push(ensureText(''));
  }

  return {
    type: 'paragraph',
    align,
    children: children as ParagraphElement['children'],
  };
};

export const buildMarkdownParagraph = (
  markdown: string,
  align?: Alignment
): ParagraphElement => ({
  type: 'paragraph',
  align,
  children: [ensureText(markdown)] as ParagraphElement['children'],
});

const escapeMarkdownText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([\*\_\`\[\]\(\)\>\#\+\-\!\|])/g, '\\$1');
};

const fontSizeToHeading = (fontSize?: string): number | undefined => {
  if (!fontSize) {
    return undefined;
  }
  const entry = Object.entries(HEADING_FONT_SIZE_MAP).find(
    ([, size]) => size === fontSize
  );
  return entry ? Number(entry[0]) : undefined;
};

const serializeInlineNodes = (
  nodes: (CustomText | LinkElement)[]
): string => {
  let result = '';
  nodes.forEach((node) => {
    if ('text' in node) {
      result += serializeTextNode(node);
    } else {
      const linkChildren = node.children as (CustomText | LinkElement)[];
      const label = serializeInlineNodes(linkChildren);
      const escapedUrl = node.url.replace(/\)/g, '%29');
      result += `[${label}](${escapedUrl})`;
    }
  });
  return result;
};

const serializeTextNode = (node: CustomText): string => {
  const value = node.text || '';

  if (node.code) {
    return `\`${value}\``;
  }

  if (value === BULLET_PREFIX) {
    return '- ';
  }

  if (value === UNCHECKED_BOX_PREFIX) {
    return '- [ ] ';
  }

  if (value === CHECKED_BOX_PREFIX) {
    return '- [x] ';
  }

  if (value === HORIZONTAL_RULE) {
    return '---';
  }

  let content = escapeMarkdownText(value);

  const headingLevel = fontSizeToHeading(node['font-size']);
  if (headingLevel) {
    const prefix = '#'.repeat(headingLevel);
    return `${prefix} ${content.trim()}`;
  }

  if (node.bold && node.italic) {
    content = `***${content}***`;
  } else {
    if (node.bold) {
      content = `**${content}**`;
    }
    if (node.italic) {
      content = `*${content}*`;
    }
  }

  if (node.strike) {
    content = `~~${content}~~`;
  }

  if (node.underlined) {
    content = `++${content}++`;
  }

  return content;
};

export const serializeParagraphToMarkdown = (paragraph: ParagraphElement): string => {
  return serializeInlineNodes(
    (paragraph.children as unknown as (CustomText | LinkElement)[])
  );
};

export const isParagraphEqual = (
  prev?: ParagraphElement,
  next?: ParagraphElement
): boolean => {
  if (!prev && !next) {
    return true;
  }
  if (!prev || !next) {
    return false;
  }
  return JSON.stringify(prev) === JSON.stringify(next);
};
