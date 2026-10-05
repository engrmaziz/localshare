const EMOJIS = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🤩",
  "😘",
  "😜",
  "🤔",
  "😴",
  "😭",
  "😡",
  "👍",
  "👎",
  "👏",
  "🙏",
  "🔥",
  "✨",
  "🎉",
  "💯",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "✅",
  "❌",
  "⚠️",
  "📌",
  "📎",
  "📷",
  "📁",
  "💡",
  "☕",
  "🍕",
  "🏠",
  "💻",
];

type EmojiPickerProps = {
  onPick: (emoji: string) => void;
};

export function EmojiPicker({ onPick }: EmojiPickerProps) {
  return (
    <div
      role="listbox"
      aria-label="Emojis"
      className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-line bg-canvas p-2 dark:border-line-dark dark:bg-canvas-dark sm:grid-cols-10"
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="option"
          onClick={() => onPick(emoji)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-lg leading-none hover:bg-panel dark:hover:bg-panel-dark"
          aria-label={`Insert ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
