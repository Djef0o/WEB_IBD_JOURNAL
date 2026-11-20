import { useId } from 'preact/hooks';

interface NoteFieldProps {
  label: string;
  value: string;
  onInput: (value: string) => void;
}

/** Free multi-line note of a Care editor (two lines high, sentence capitalization). */
export function NoteField({ label, value, onInput }: NoteFieldProps) {
  const id = useId();
  return (
    <div class="field">
      <label class="field-name" for={id}>{label}</label>
      <textarea
        id={id}
        class="input"
        rows={2}
        value={value}
        autocapitalize="sentences"
        onInput={(e) => onInput(e.currentTarget.value)}
      />
    </div>
  );
}
