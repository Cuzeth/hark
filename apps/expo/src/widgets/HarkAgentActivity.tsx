import { HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityElement,
  accessibilityLabel,
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  progressViewStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import type { LiveActivityProps } from "@hark/contracts";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";

function HarkAgentActivityLayout(props: LiveActivityProps, environment: LiveActivityEnvironment) {
  "widget";
  const green = environment.colorScheme === "dark" ? "#5ED8B7" : "#08715D";
  const secondary = { type: "hierarchical", style: "secondary" } as const;
  const title = props.privacyMode === "private" ? "Agent task" : props.title;
  const status = props.privacyMode === "private" ? "In progress" : props.status;
  const detail = props.privacyMode === "private" ? undefined : props.detail;
  const symbol =
    props.symbol === "code"
      ? "chevron.left.forwardslash.chevron.right"
      : props.symbol === "build"
        ? "gearshape.2.fill"
        : props.symbol === "success"
          ? "checkmark.circle.fill"
          : props.symbol === "warning"
            ? "exclamationmark.triangle.fill"
            : "terminal.fill";
  const percentage =
    props.progress === undefined ? undefined : `${Math.round(props.progress * 100)}%`;

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={8}
        modifiers={[
          padding({ horizontal: 16, vertical: 14 }),
          activityBackgroundTint(environment.colorScheme === "dark" ? "#10231F" : "#F5FBF9"),
          accessibilityElement("combine"),
          accessibilityLabel(`${title}, ${status}${percentage ? `, ${percentage}` : ""}`),
        ]}
      >
        <HStack spacing={10}>
          <Image systemName={symbol} color={green} size={20} />
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ textStyle: "headline", weight: "semibold" }), lineLimit(1)]}>
              {title}
            </Text>
            <Text
              modifiers={[
                font({ textStyle: "subheadline", weight: "medium" }),
                foregroundStyle(green),
                lineLimit(1),
              ]}
            >
              {status}
            </Text>
          </VStack>
          <Spacer />
          {percentage ? (
            <Text
              modifiers={[
                font({ textStyle: "subheadline", weight: "semibold" }),
                monospacedDigit(),
                foregroundStyle(green),
              ]}
            >
              {percentage}
            </Text>
          ) : null}
        </HStack>
        {detail ? (
          <Text
            modifiers={[font({ textStyle: "footnote" }), foregroundStyle(secondary), lineLimit(2)]}
          >
            {detail}
          </Text>
        ) : null}
        {props.progress !== undefined ? (
          <ProgressView
            value={props.progress}
            modifiers={[progressViewStyle("linear"), tint(green), frame({ maxWidth: Infinity })]}
          />
        ) : null}
      </VStack>
    ),
    bannerSmall: (
      <HStack spacing={8} modifiers={[padding({ all: 10 }), accessibilityElement("combine")]}>
        <Image systemName={symbol} color={green} size={18} />
        <Text modifiers={[font({ textStyle: "subheadline", weight: "semibold" }), lineLimit(1)]}>
          {status}
        </Text>
        <Spacer />
        {percentage ? <Text modifiers={[monospacedDigit()]}>{percentage}</Text> : null}
      </HStack>
    ),
    compactLeading: <Image systemName={symbol} color={green} size={16} />,
    compactTrailing: (
      <Text
        modifiers={[
          font({ size: 12, weight: "semibold" }),
          monospacedDigit(),
          foregroundStyle(green),
          lineLimit(1),
        ]}
      >
        {percentage ?? status}
      </Text>
    ),
    minimal: (
      <Image
        systemName={symbol}
        color={green}
        size={15}
        modifiers={[accessibilityLabel(`${title}, ${status}`)]}
      />
    ),
    expandedLeading: (
      <HStack spacing={7} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={symbol} color={green} size={18} />
        <Text modifiers={[font({ textStyle: "headline", weight: "semibold" }), lineLimit(1)]}>
          {title}
        </Text>
      </HStack>
    ),
    expandedTrailing: percentage ? (
      <Text
        modifiers={[
          padding({ trailing: 4 }),
          font({ textStyle: "headline", weight: "semibold" }),
          monospacedDigit(),
          foregroundStyle(green),
        ]}
      >
        {percentage}
      </Text>
    ) : undefined,
    expandedBottom: (
      <VStack
        alignment="leading"
        spacing={7}
        modifiers={[
          padding({ horizontal: 4, vertical: 2 }),
          accessibilityElement("combine"),
          accessibilityLabel(`${title}, ${status}${percentage ? `, ${percentage}` : ""}`),
        ]}
      >
        <Text
          modifiers={[
            font({ textStyle: "subheadline", weight: "semibold" }),
            foregroundStyle(green),
          ]}
        >
          {status}
        </Text>
        {detail ? (
          <Text
            modifiers={[font({ textStyle: "footnote" }), foregroundStyle(secondary), lineLimit(2)]}
          >
            {detail}
          </Text>
        ) : null}
        {props.progress !== undefined ? (
          <ProgressView
            value={props.progress}
            modifiers={[progressViewStyle("linear"), tint(green), frame({ maxWidth: Infinity })]}
          />
        ) : null}
      </VStack>
    ),
  };
}

export default createLiveActivity<LiveActivityProps>("HarkAgentActivity", HarkAgentActivityLayout);
