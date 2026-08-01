import { useCallback, useState } from "react";
import type { NativeSyntheticEvent, TextLayoutEventData } from "react-native";

/**
 * Reports whether a text node needs more than `maxLines` lines at its laid-out
 * width. Attach `onTextLayout` to a hidden, unclamped copy of the text (the
 * clamped copy only ever reports the truncated line count).
 */
export function useTextOverflow(maxLines = 1) {
  const [overflowing, setOverflowing] = useState(false);
  const onTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      setOverflowing(event.nativeEvent.lines.length > maxLines);
    },
    [maxLines],
  );
  return { overflowing, onTextLayout };
}
