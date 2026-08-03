import { SymbolView } from "expo-symbols";
import { cloneElement, type ReactElement, useCallback, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { colors, fonts, tightTracking } from "../lib/theme";

type AnchorRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

const MENU_WIDTH = 220;
const MENU_HEIGHT = 52;
const SCREEN_MARGIN = 16;
const MENU_GAP = 8;

/**
 * A React Native context menu for variable-height rows.
 *
 * The trigger stays in the normal Yoga tree at all times. On long press, a
 * visual copy is lifted into a modal alongside the destructive action. This
 * avoids routing the row through a SwiftUI Host, which cannot reliably report
 * dynamic trigger heights back to a React Native ScrollView.
 */
export function DeleteContextMenu({
  children,
  onDelete,
  style,
}: {
  children: ReactElement<PressableProps>;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const anchorRef = useRef<View>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [open, setOpen] = useState(false);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const childOnLongPress = children.props.onLongPress;

  const showMenu = useCallback<NonNullable<PressableProps["onLongPress"]>>(
    (event) => {
      childOnLongPress?.(event);
      anchorRef.current?.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) return;
        progress.setValue(0);
        setAnchor({ height, width, x, y });
        setOpen(true);
        requestAnimationFrame(() => {
          Animated.spring(progress, {
            damping: 22,
            mass: 0.65,
            stiffness: 260,
            toValue: 1,
            useNativeDriver: true,
          }).start();
        });
      });
    },
    [childOnLongPress, progress],
  );

  const closeMenu = useCallback(
    (afterClose?: () => void) => {
      Animated.timing(progress, {
        duration: 120,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => {
        setOpen(false);
        setAnchor(null);
        afterClose?.();
      });
    },
    [progress],
  );

  const trigger = cloneElement(children, {
    delayLongPress: children.props.delayLongPress ?? 450,
    onLongPress: showMenu,
  });

  const menuLeft = anchor
    ? Math.min(
        Math.max(SCREEN_MARGIN, anchor.x + anchor.width - MENU_WIDTH),
        windowWidth - MENU_WIDTH - SCREEN_MARGIN,
      )
    : SCREEN_MARGIN;
  const menuTop = anchor
    ? anchor.y + anchor.height + MENU_GAP + MENU_HEIGHT <= windowHeight - SCREEN_MARGIN
      ? anchor.y + anchor.height + MENU_GAP
      : Math.max(SCREEN_MARGIN, anchor.y - MENU_HEIGHT - MENU_GAP)
    : SCREEN_MARGIN;

  return (
    <>
      <View
        accessibilityElementsHidden={open}
        collapsable={false}
        importantForAccessibility={open ? "no-hide-descendants" : "auto"}
        ref={anchorRef}
        style={[style, open && styles.hiddenTrigger]}
      >
        {trigger}
      </View>
      <Modal
        animationType="none"
        onRequestClose={() => closeMenu()}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={open && anchor !== null}
      >
        <View style={styles.overlay}>
          <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: progress }]} />
          <Pressable
            accessibilityLabel="Dismiss context menu"
            accessibilityRole="button"
            onPress={() => closeMenu()}
            style={StyleSheet.absoluteFill}
          />
          {anchor ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.preview,
                  {
                    height: anchor.height,
                    left: anchor.x,
                    opacity: progress,
                    top: anchor.y,
                    transform: [
                      {
                        scale: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.98, 1.02],
                        }),
                      },
                    ],
                    width: anchor.width,
                  },
                ]}
              >
                {children}
              </Animated.View>
              <Animated.View
                accessibilityViewIsModal
                style={[
                  styles.menu,
                  {
                    left: menuLeft,
                    opacity: progress,
                    top: menuTop,
                    transform: [
                      {
                        scale: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.94, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => closeMenu(onDelete)}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.deleteButtonPressed,
                  ]}
                >
                  <Text style={styles.deleteLabel}>Delete from history</Text>
                  <SymbolView name="trash" size={16} tintColor={colors.danger} />
                </Pressable>
              </Animated.View>
            </>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hiddenTrigger: {
    opacity: 0,
  },
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.16)",
  },
  preview: {
    position: "absolute",
    borderRadius: 12,
    backgroundColor: colors.paper,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    height: MENU_HEIGHT,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  deleteButtonPressed: {
    backgroundColor: colors.accentSoft,
  },
  deleteLabel: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 15,
    letterSpacing: tightTracking(15),
  },
});
