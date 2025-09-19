import {
  createEditor,
  type Descendant,
  Range,
  Transforms,
  Editor,
  Node,
} from 'slate';
import { isKeyHotkey } from 'is-hotkey';
import {
  Editable,
  RenderElementProps,
  RenderLeafProps,
  Slate,
  withReact,
} from 'slate-react';
import {
  type CustomElement,
  type CustomText,
  type LinkElement,
  type ParagraphElement,
  type TextProps,
} from '@plait/common';
import React, {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
  CSSProperties,
} from 'react';
import { withHistory } from 'slate-history';
import { isUrl, LinkEditor } from '@plait/text-plugins';
import { withText } from './plugins/with-text';
import { CustomEditor, RenderElementPropsFor } from './custom-types';
import {
  buildMarkdownParagraph,
  isParagraphEqual,
  parseMarkdownParagraph,
  serializeParagraphToMarkdown,
  normalizeMarkdownString,
} from './utils/markdown';

import './styles/index.scss';
import { LinkComponent, withInlineLink } from './plugins/with-link';

export type TextComponentProps = TextProps;

export const Text: React.FC<TextComponentProps> = (
  props: TextComponentProps
) => {
  const { text, readonly, onChange, onComposition, afterInit, textPlugins } =
    props;

  const paragraphText = text as ParagraphElement;
  const textAlign = paragraphText.align;

  const renderLeaf = useCallback(
    (props: RenderLeafProps) => <Leaf {...props} />,
    []
  );

  const [initialValue] = useState<Descendant[]>(() => {
    const markdown = serializeParagraphToMarkdown(paragraphText);
    const paragraph =
      readonly === false
        ? buildMarkdownParagraph(markdown, textAlign)
        : parseMarkdownParagraph(markdown, textAlign);
    return [paragraph];
  });

  const editor = useMemo(() => {
    let instance = withInlineLink(
      withText(withHistory(withReact(createEditor())))
    ) as CustomEditor;
    if (textPlugins && textPlugins.length) {
      textPlugins.forEach((plugin) => {
        instance = plugin(instance) as CustomEditor;
      });
    }
    afterInit && afterInit(instance);
    return instance;
  }, [afterInit, textPlugins]);

  const previousReadonlyRef = useRef<boolean | undefined>(readonly);
  const isSyncingRef = useRef(false);

  const setEditorValue = useCallback(
    (paragraph: ParagraphElement) => {
      const current = editor.children[0] as ParagraphElement | undefined;
      if (isParagraphEqual(current, paragraph)) {
        return;
      }
      isSyncingRef.current = true;
      Editor.withoutNormalizing(editor, () => {
        editor.children = [paragraph];
      });
      editor.onChange();
      isSyncingRef.current = false;
    },
    [editor]
  );

  useEffect(() => {
    const previousReadonly = previousReadonlyRef.current;
    const markdownSource = normalizeMarkdownString(
      serializeParagraphToMarkdown(paragraphText)
    );
    if (readonly === false) {
      if (previousReadonly !== false) {
        const markdownParagraph = buildMarkdownParagraph(
          markdownSource,
          textAlign
        );
        setEditorValue(markdownParagraph);
      }
    } else {
      const parsedParagraph = parseMarkdownParagraph(
        markdownSource,
        textAlign
      );
      setEditorValue(parsedParagraph);
    }
    previousReadonlyRef.current = readonly;
  }, [text, readonly, setEditorValue]);

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    const { selection } = editor;

    // Default left/right behavior is unit:'character'.
    // This fails to distinguish between two cursor positions, such as
    // <inline>foo<cursor/></inline> vs <inline>foo</inline><cursor/>.
    // Here we modify the behavior to unit:'offset'.
    // This lets the user step into and out of the inline without stepping over characters.
    // You may wish to customize this further to only use unit:'offset' in specific cases.
    if (selection && Range.isCollapsed(selection)) {
      const { nativeEvent } = event;
      if (isKeyHotkey('left', nativeEvent)) {
        event.preventDefault();
        Transforms.move(editor, { unit: 'offset', reverse: true });
        return;
      }
      if (isKeyHotkey('right', nativeEvent)) {
        event.preventDefault();
        Transforms.move(editor, { unit: 'offset' });
        return;
      }
    }
  };

  return (
    <Slate
      editor={editor}
      initialValue={initialValue}
      onChange={() => {
        if (isSyncingRef.current) {
          return;
        }
        const currentParagraph = editor.children[0] as ParagraphElement;
        const markdownSource =
          readonly === false
            ? normalizeMarkdownString(Node.string(currentParagraph))
            : serializeParagraphToMarkdown(currentParagraph);
        const normalizedParagraph = parseMarkdownParagraph(
          markdownSource,
          currentParagraph.align
        );
        onChange &&
          onChange({
            newText: normalizedParagraph,
            operations: editor.operations,
          });
      }}
    >
      <Editable
        className="slate-editable-container plait-text-container"
        renderElement={(props) => <Element {...props} />}
        renderLeaf={renderLeaf}
        readOnly={readonly === undefined ? true : readonly}
        onCompositionStart={(event) => {
          if (onComposition) {
            onComposition(event as unknown as CompositionEvent);
          }
        }}
        onCompositionUpdate={(event) => {
          if (onComposition) {
            onComposition(event as unknown as CompositionEvent);
          }
        }}
        onCompositionEnd={(event) => {
          if (onComposition) {
            onComposition(event as unknown as CompositionEvent);
          }
        }}
        onKeyDown={onKeyDown}
      />
    </Slate>
  );
};

const Element = (props: RenderElementProps) => {
  const { attributes, children, element } = props as RenderElementPropsFor<
    CustomElement & { type: string }
  >;
  switch (element.type) {
    case 'link':
      return (
        <LinkComponent {...(props as RenderElementPropsFor<LinkElement>)} />
      );
    default:
      return (
        <ParagraphComponent
          {...(props as RenderElementPropsFor<ParagraphElement>)}
        />
      );
  }
};

const ParagraphComponent = ({
  attributes,
  children,
  element,
}: RenderElementPropsFor<ParagraphElement>) => {
  const style = { textAlign: element.align } as CSSProperties;
  return (
    <div style={style} {...attributes}>
      {children}
    </div>
  );
};

const Leaf: React.FC<RenderLeafProps> = ({ children, leaf, attributes }) => {
  const customLeaf = leaf as CustomText;
  let content = children;

  if (customLeaf.bold) {
    content = <strong>{content}</strong>;
  }

  if (customLeaf.italic) {
    content = <em>{content}</em>;
  }

  if (customLeaf.underlined) {
    content = <u>{content}</u>;
  }

  if (customLeaf.strike) {
    content = <s>{content}</s>;
  }

  if (customLeaf.code) {
    content = <code>{content}</code>;
  }

  const style: CSSProperties = {
    color: customLeaf.color,
  };

  if (customLeaf['font-size']) {
    const fontSize = customLeaf['font-size'];
    const normalizedSize = fontSize.endsWith('px') ? fontSize : `${fontSize}px`;
    style.fontSize = normalizedSize;
    style.lineHeight = '1.4em';
  }

  return (
    <span style={style} {...attributes}>
      {content}
    </span>
  );
};
