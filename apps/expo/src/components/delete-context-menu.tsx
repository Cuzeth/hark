import { ContextMenu, Host, Button as MenuButton, RNHostView } from "@expo/ui/swift-ui";
import type { ReactElement } from "react";
import type { StyleProp, ViewStyle } from "react-native";

/**
 * Wraps a row in the native iOS context menu: touch-and-hold lifts the row
 * out with the system pop-out animation and shows a destructive Delete item.
 * The menu itself is the confirmation step, so `onDelete` runs immediately.
 *
 * The row is a React Native view inside SwiftUI content, so it must go
 * through `RNHostView matchContents` — that feeds the Yoga-computed row size
 * into SwiftUI (otherwise the trigger measures zero-height and rows stack)
 * and attaches the touch handler that keeps the row's Pressable tappable.
 */
export function DeleteContextMenu({
  children,
  onDelete,
  style,
}: {
  children: ReactElement;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Host matchContents={{ vertical: true }} style={style}>
      <ContextMenu>
        <ContextMenu.Items>
          {/* biome-ignore lint/a11y/useValidAriaRole: SwiftUI button role, not an ARIA role */}
          <MenuButton
            label="Delete from history"
            onPress={onDelete}
            role="destructive"
            systemImage="trash"
          />
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          <RNHostView matchContents>{children}</RNHostView>
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
