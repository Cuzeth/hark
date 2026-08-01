import { ContextMenu, Host, Button as MenuButton } from "@expo/ui/swift-ui";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

/**
 * Wraps a row in the native iOS context menu: touch-and-hold lifts the row
 * out with the system pop-out animation and shows a destructive Delete item.
 * The menu itself is the confirmation step, so `onDelete` runs immediately.
 */
export function DeleteContextMenu({
  children,
  onDelete,
  style,
}: {
  children: ReactNode;
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
        <ContextMenu.Trigger>{children}</ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
