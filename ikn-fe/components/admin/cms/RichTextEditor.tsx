'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import { useLang } from '@/components/LanguageProvider';
import { errorMessage, uploadMedia } from '@/lib/api';
import { MediaLibraryModal } from './MediaPicker';

// WYSIWYG editor (TipTap v3) that produces HTML inside the server whitelist:
// p, br, h2-h4, strong, em, u, s, a, ul/ol/li, blockquote, img, hr, iframe (YouTube)
// and style="text-align: ..." on blocks. Anything else is stripped server-side.
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Media collection used for images uploaded from the toolbar. */
  collection?: string;
  minHeight?: number;
  id?: string;
  invalid?: boolean;
}

// The server keeps only the <iframe>, so a saved body may come back without the
// <div data-youtube-video> wrapper TipTap emits. Accept both when parsing.
const YoutubeEmbed = Youtube.extend({
  parseHTML() {
    return [
      { tag: 'div[data-youtube-video] iframe' },
      { tag: 'iframe[src*="youtube.com/embed/"]' },
      { tag: 'iframe[src*="youtube-nocookie.com/embed/"]' },
    ];
  },
});

const LINK_ATTRS = { target: '_blank', rel: 'noopener' };

function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '');
}

/** HTML the parent should store: '' for an empty document instead of '<p></p>'. */
function htmlOf(editor: Editor): string {
  return editor.isEmpty ? '' : editor.getHTML();
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  collection = 'news',
  minHeight = 320,
  id,
  invalid = false,
}: RichTextEditorProps) {
  const { lang } = useLang();
  const t = (idText: string, en: string) => (lang === 'en' ? en : idText);
  const fileRef = useRef<HTMLInputElement>(null);
  const placeholderRef = useRef(placeholder ?? '');
  placeholderRef.current = placeholder ?? '';
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [error, setError] = useState('');

  const editor = useEditor({
    // Required in Next.js: the editor is created on the client after hydration.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: 'https',
          HTMLAttributes: LINK_ATTRS,
        },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      TiptapImage.configure({ inline: false, allowBase64: false }),
      YoutubeEmbed.configure({ nocookie: true, width: 640, height: 360, modestBranding: true }),
      Placeholder.configure({ placeholder: () => placeholderRef.current }),
    ],
    content: value,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: current }) => onChange(htmlOf(current)),
  });

  // Outside → editor: when the parent replaces the value (e.g. record loaded)
  // and the editor is not being typed in, replace the document without emitting.
  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused) return;
    if (value === htmlOf(editor)) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  // Toolbar state. TipTap v3 does not re-render on every transaction, so read
  // the active marks/nodes through useEditorState instead of editor.isActive().
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      ready: !!e,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
      paragraph: e?.isActive('paragraph') ?? false,
      h2: e?.isActive('heading', { level: 2 }) ?? false,
      h3: e?.isActive('heading', { level: 3 }) ?? false,
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      underline: e?.isActive('underline') ?? false,
      strike: e?.isActive('strike') ?? false,
      bulletList: e?.isActive('bulletList') ?? false,
      orderedList: e?.isActive('orderedList') ?? false,
      blockquote: e?.isActive('blockquote') ?? false,
      alignLeft: e?.isActive({ textAlign: 'left' }) ?? false,
      alignCenter: e?.isActive({ textAlign: 'center' }) ?? false,
      alignRight: e?.isActive({ textAlign: 'right' }) ?? false,
      alignJustify: e?.isActive({ textAlign: 'justify' }) ?? false,
      link: e?.isActive('link') ?? false,
    }),
  });

  function promptLink() {
    if (!editor) return;
    const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
    const input = window.prompt(t('URL tautan (kosongkan untuk melepas tautan)', 'Link URL (leave empty to remove the link)'), previous || 'https://');
    if (input === null) return;
    const href = input.trim();
    if (href === '' || href === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const { from, to } = editor.state.selection;
    if (from === to && !state?.link) {
      // No selection: insert the URL itself as linked text.
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href, ...LINK_ATTRS } }] })
        .run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href, ...LINK_ATTRS }).run();
  }

  function unsetLink() {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
  }

  function insertImage(src: string, alt: string) {
    editor?.chain().focus().setImage({ src, alt }).run();
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError('');
    try {
      const media = await uploadMedia(file, collection);
      insertImage(media.url, stripExtension(media.originalName || file.name));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function promptYoutube() {
    if (!editor) return;
    const input = window.prompt(t('URL video YouTube', 'YouTube video URL'), 'https://www.youtube.com/watch?v=');
    if (input === null) return;
    const src = input.trim();
    if (!src) return;
    setError('');
    const inserted = editor.chain().focus().setYoutubeVideo({ src }).run();
    if (!inserted) setError(t('URL YouTube tidak dikenali.', 'Unrecognised YouTube URL.'));
  }

  function clearFormatting() {
    editor?.chain().focus().unsetAllMarks().clearNodes().run();
  }

  const disabled = !editor || !state?.ready;

  return (
    <div className={`rte${invalid ? ' is-invalid' : ''}`}>
      <div className="rte-toolbar" role="toolbar" aria-label={t('Alat format', 'Formatting tools')}>
        <div className="rte-group">
          <ToolButton title={t('Urungkan', 'Undo')} disabled={disabled || !state?.canUndo} onClick={() => editor?.chain().focus().undo().run()}>
            {icons.undo}
          </ToolButton>
          <ToolButton title={t('Ulangi', 'Redo')} disabled={disabled || !state?.canRedo} onClick={() => editor?.chain().focus().redo().run()}>
            {icons.redo}
          </ToolButton>
        </div>
        <div className="rte-group">
          <ToolButton title={t('Paragraf', 'Paragraph')} active={state?.paragraph} disabled={disabled} onClick={() => editor?.chain().focus().setParagraph().run()}>
            {icons.paragraph}
          </ToolButton>
          <ToolButton title={t('Subjudul (H2)', 'Heading 2')} active={state?.h2} disabled={disabled} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <span className="rte-text">H2</span>
          </ToolButton>
          <ToolButton title={t('Subjudul kecil (H3)', 'Heading 3')} active={state?.h3} disabled={disabled} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            <span className="rte-text">H3</span>
          </ToolButton>
        </div>
        <div className="rte-group">
          <ToolButton title={t('Tebal', 'Bold')} active={state?.bold} disabled={disabled} onClick={() => editor?.chain().focus().toggleBold().run()}>
            {icons.bold}
          </ToolButton>
          <ToolButton title={t('Miring', 'Italic')} active={state?.italic} disabled={disabled} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            {icons.italic}
          </ToolButton>
          <ToolButton title={t('Garis bawah', 'Underline')} active={state?.underline} disabled={disabled} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            {icons.underline}
          </ToolButton>
          <ToolButton title={t('Coret', 'Strikethrough')} active={state?.strike} disabled={disabled} onClick={() => editor?.chain().focus().toggleStrike().run()}>
            {icons.strike}
          </ToolButton>
        </div>
        <div className="rte-group">
          <ToolButton title={t('Daftar butir', 'Bullet list')} active={state?.bulletList} disabled={disabled} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            {icons.bulletList}
          </ToolButton>
          <ToolButton title={t('Daftar bernomor', 'Numbered list')} active={state?.orderedList} disabled={disabled} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            {icons.orderedList}
          </ToolButton>
          <ToolButton title={t('Kutipan', 'Blockquote')} active={state?.blockquote} disabled={disabled} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            {icons.quote}
          </ToolButton>
          <ToolButton title={t('Garis pemisah', 'Horizontal rule')} disabled={disabled} onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
            {icons.hr}
          </ToolButton>
        </div>
        <div className="rte-group">
          <ToolButton title={t('Rata kiri', 'Align left')} active={state?.alignLeft} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
            {icons.alignLeft}
          </ToolButton>
          <ToolButton title={t('Rata tengah', 'Align center')} active={state?.alignCenter} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
            {icons.alignCenter}
          </ToolButton>
          <ToolButton title={t('Rata kanan', 'Align right')} active={state?.alignRight} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
            {icons.alignRight}
          </ToolButton>
          <ToolButton title={t('Rata kiri-kanan', 'Justify')} active={state?.alignJustify} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign('justify').run()}>
            {icons.alignJustify}
          </ToolButton>
        </div>
        <div className="rte-group">
          <ToolButton title={t('Tautan', 'Link')} active={state?.link} disabled={disabled} onClick={promptLink}>
            {icons.link}
          </ToolButton>
          {state?.link && (
            <ToolButton title={t('Lepas tautan', 'Remove link')} disabled={disabled} onClick={unsetLink}>
              {icons.unlink}
            </ToolButton>
          )}
        </div>
        <div className="rte-group">
          <ToolButton title={t('Unggah gambar dari komputer', 'Upload image from computer')} disabled={disabled || uploading} onClick={() => fileRef.current?.click()}>
            {icons.upload}
          </ToolButton>
          <ToolButton title={t('Pilih gambar dari media', 'Choose image from library')} disabled={disabled} onClick={() => setLibraryOpen(true)}>
            {icons.image}
          </ToolButton>
          <ToolButton title={t('Sisipkan video YouTube', 'Insert YouTube video')} disabled={disabled} onClick={promptYoutube}>
            {icons.video}
          </ToolButton>
        </div>
        <div className="rte-group">
          <ToolButton title={t('Hapus format', 'Clear formatting')} disabled={disabled} onClick={clearFormatting}>
            {icons.eraser}
          </ToolButton>
        </div>
        {uploading && <span className="rte-status">{t('Mengunggah gambar...', 'Uploading image...')}</span>}
      </div>

      <EditorContent editor={editor} className="rte-content" style={{ '--rte-min-height': `${minHeight}px` } as CSSProperties} />

      {error && <small className="cms-field-error rte-error">{error}</small>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      {libraryOpen && (
        <MediaLibraryModal
          accept="image"
          selectedId={null}
          onClose={() => setLibraryOpen(false)}
          onPick={(media) => {
            setLibraryOpen(false);
            insertImage(media.url, stripExtension(media.originalName));
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Toolbar pieces

interface ToolButtonProps {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ToolButton({ title, active = false, disabled = false, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`rte-btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor selection: a mousedown on the toolbar must not blur the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function svg(children: ReactNode) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const icons = {
  undo: svg(<path d="M9 14 4 9l5-5M4 9h9a6 6 0 0 1 0 12h-1" />),
  redo: svg(<path d="m15 14 5-5-5-5M20 9h-9a6 6 0 0 0 0 12h1" />),
  paragraph: svg(<path d="M13 4v16M17 4v16M17 4h-6.5a4 4 0 0 0 0 8H13" />),
  bold: svg(<path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z" />),
  italic: svg(<path d="M14 4h6M4 20h6M15 4 9 20" />),
  underline: svg(<path d="M6 4v6a6 6 0 0 0 12 0V4M5 20h14" />),
  strike: svg(<path d="M4 12h16M16.5 7.5A4.5 4.5 0 0 0 12 4c-2.5 0-4.5 1.5-4.5 3.5 0 .6.1 1.1.4 1.5M7.5 16.5A4.5 4.5 0 0 0 12 20c2.5 0 4.5-1.5 4.5-3.5 0-.6-.1-1.1-.4-1.5" />),
  bulletList: svg(<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />),
  orderedList: svg(<path d="M10 6h10M10 12h10M10 18h10M4 5.5 5.5 5v4M4 13.5c0-1 2-1.4 2-.2 0 .6-2 1.3-2 2.7h2.2M4 17.5h1.5a1 1 0 0 1 0 2H5m.5 0a1 1 0 0 1 0 2H4" />),
  quote: svg(<path d="M5 15V9a4 4 0 0 1 4-4M14 15V9a4 4 0 0 1 4-4M5 15a3 3 0 1 0 3 3v-3zM14 15a3 3 0 1 0 3 3v-3z" />),
  hr: svg(<path d="M4 12h16M8 6h8M8 18h8" opacity="0.5" />),
  alignLeft: svg(<path d="M4 6h16M4 10h10M4 14h16M4 18h10" />),
  alignCenter: svg(<path d="M4 6h16M7 10h10M4 14h16M7 18h10" />),
  alignRight: svg(<path d="M4 6h16M10 10h10M4 14h16M10 18h10" />),
  alignJustify: svg(<path d="M4 6h16M4 10h16M4 14h16M4 18h16" />),
  link: svg(<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />),
  unlink: svg(<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16" />),
  image: svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 20" />
    </>,
  ),
  upload: svg(<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />),
  video: svg(
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
    </>,
  ),
  eraser: svg(<path d="m16 4 4 4-9 9H7l-3-3 9-9zM4 20h16" />),
};
