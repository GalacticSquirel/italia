import { useState } from 'react';
import { View } from 'react-native';

import { Button, TextField, useTheme } from '@/ui';

import { AccentBar } from './AccentBar';

export interface AnswerInputProps {
  /** Label of the field, read by screen readers. */
  label: string;
  onSubmit: (answer: string) => void;
  /** Typing a whole sentence: allow capitals and sentence keyboard behaviour. */
  sentence?: boolean;
}

interface Selection {
  start: number;
  end: number;
}

/** Insert `char` over `selection` in `text`; returns the new text and caret. */
export function insertAt(text: string, selection: Selection, char: string) {
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  const caret = start + char.length;
  return {
    text: text.slice(0, start) + char + text.slice(end),
    selection: { start: caret, end: caret },
  };
}

/** Typed answer field with the accent bar and a Check button. */
export function AnswerInput({ label, onSubmit, sentence = false }: AnswerInputProps) {
  const { spacing } = useTheme();
  const [value, setValue] = useState('');
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const empty = value.trim().length === 0;
  const submit = () => {
    if (!empty) onSubmit(value);
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label={label}
        hideLabel
        placeholder="Type in Italian"
        value={value}
        selection={selection}
        onChangeText={(text) => {
          setValue(text);
        }}
        onSelectionChange={(e) => {
          setSelection(e.nativeEvent.selection);
        }}
        autoCapitalize={sentence ? 'sentences' : 'none'}
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={submit}
        autoFocus
      />
      <AccentBar
        onInsert={(char) => {
          const next = insertAt(value, selection, char);
          setValue(next.text);
          setSelection(next.selection);
        }}
      />
      <Button label="Check" disabled={empty} onPress={submit} />
    </View>
  );
}
