import ActivityKit
import SwiftUI
import WidgetKit

@main
struct HarkWidgets: WidgetBundle {
    var body: some Widget { HarkAgentActivityWidget() }
}

struct HarkAgentActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LiveActivityAttributes.self) { context in
            HarkLockScreenView(context: context)
                .activityBackgroundTint(Color(hex: "#0B1512"))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "hark://inbox"))
        } dynamicIsland: { context in
            let presentation = HarkActivityPresentation(context: context)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 7) {
                        Image(systemName: presentation.symbol)
                            .foregroundStyle(presentation.accent)
                        Text(presentation.title).font(.headline).lineLimit(1)
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(presentation.percentage ?? presentation.status)
                        .font(.system(.subheadline, design: presentation.style == "terminal" ? .monospaced : .default, weight: .semibold))
                        .monospacedDigit().foregroundStyle(presentation.accent).lineLimit(1)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HarkExpandedBottom(context: context, presentation: presentation)
                }
            } compactLeading: {
                Image(systemName: presentation.symbol).foregroundStyle(presentation.accent)
            } compactTrailing: {
                Text(presentation.percentage ?? presentation.status)
                    .font(.system(size: 12, weight: .semibold, design: presentation.style == "terminal" ? .monospaced : .default))
                    .foregroundStyle(presentation.accent).lineLimit(1)
            } minimal: {
                Image(systemName: presentation.symbol).foregroundStyle(presentation.accent)
                    .accessibilityLabel("\(presentation.title), \(presentation.status)")
            }
            .widgetURL(URL(string: "hark://inbox"))
            .keylineTint(presentation.accent)
        }
    }
}

private struct HarkActivityPresentation {
    let props: LiveActivityProps
    let title: String
    let status: String
    let detail: String?
    let style: String
    let accent: Color
    let symbol: String
    let percentage: String?

    init(context: ActivityViewContext<LiveActivityAttributes>) {
        props = context.state.decodedProps
        title = props.privacyMode == "private" ? "Agent task" : props.title
        status = props.privacyMode == "private" ? "In progress" : props.status
        detail = props.privacyMode == "private" ? nil : props.detail
        style = props.style ?? "standard"
        accent = Color(hex: props.accentColor ?? "#E13B3B")
        symbol = Self.symbolName(props.symbol)
        percentage = props.progress.map { "\(Int(($0 * 100).rounded()))%" }
    }

    private static func symbolName(_ symbol: String) -> String {
        switch symbol {
        case "code": "chevron.left.forwardslash.chevron.right"
        case "build": "gearshape.2.fill"
        case "success": "checkmark.circle.fill"
        case "warning": "exclamationmark.triangle.fill"
        default: "terminal.fill"
        }
    }
}

private struct HarkLockScreenView: View {
    let context: ActivityViewContext<LiveActivityAttributes>
    private var p: HarkActivityPresentation { HarkActivityPresentation(context: context) }

    @ViewBuilder var body: some View {
        switch p.style {
        case "ring": ring
        case "hero": hero
        case "terminal": terminal
        case "steps": steps
        case "approval": interactive(theme: .approval)
        case "shell": interactive(theme: .shell)
        case "verdict": interactive(theme: .verdict)
        case "signal": interactive(theme: .signal)
        default: standard
        }
    }

    private var standard: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 10) {
                Image(systemName: p.symbol).foregroundStyle(p.accent).font(.system(size: 20))
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.title).font(.headline).fontWeight(.semibold).lineLimit(1)
                    Text(p.status).font(.subheadline).fontWeight(.medium).foregroundStyle(p.accent).lineLimit(1)
                }
                Spacer()
                if let percentage = p.percentage {
                    Text(percentage).font(.subheadline).fontWeight(.semibold).monospacedDigit().foregroundStyle(p.accent)
                }
            }
            if let detail = p.detail { Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(2) }
            if let progress = p.props.progress { ProgressView(value: progress).tint(p.accent) }
        }
        .foregroundStyle(HarkWidgetColor.primary)
        .padding(.horizontal, 16).padding(.vertical, 14)
        .accessibilityElement(children: .combine)
    }

    private var ring: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().stroke(Color.white.opacity(0.12), lineWidth: 7)
                Circle().trim(from: 0, to: max(0.02, p.props.progress ?? 0.1))
                    .stroke(p.accent, style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90))
                Image(systemName: p.symbol).foregroundStyle(p.accent)
            }.frame(width: 58, height: 58)
            VStack(alignment: .leading, spacing: 4) {
                Text(p.title).font(.headline).fontWeight(.semibold).lineLimit(1)
                Text(p.status).font(.subheadline).foregroundStyle(p.accent).lineLimit(1)
                if let detail = p.detail { Text(detail).font(.caption).foregroundStyle(HarkWidgetColor.secondary).lineLimit(1) }
            }
            Spacer()
            if let percentage = p.percentage { Text(percentage).font(.title3.bold()).monospacedDigit().foregroundStyle(p.accent) }
        }.padding(.horizontal, 16).padding(.vertical, 14).foregroundStyle(HarkWidgetColor.primary)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Image(systemName: p.symbol).foregroundStyle(p.accent)
                Text(p.title.uppercased()).font(.footnote.weight(.semibold)).tracking(0.3).foregroundStyle(HarkWidgetColor.secondary).lineLimit(1)
                Spacer()
                if let percentage = p.percentage { Text(percentage).font(.footnote.bold()).monospacedDigit().foregroundStyle(p.accent) }
            }
            Text(p.status).font(.system(size: 22, weight: .bold)).lineLimit(1)
            if let detail = p.detail { Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(1) }
            if let progress = p.props.progress { ProgressView(value: progress).tint(p.accent).padding(.top, 6) }
        }.foregroundStyle(HarkWidgetColor.primary).padding(.horizontal, 16).padding(.vertical, 13)
    }

    private var terminal: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Image(systemName: p.symbol).foregroundStyle(p.accent)
                Text(p.title).font(.system(size: 13, weight: .semibold, design: .monospaced)).lineLimit(1)
                Spacer()
                Circle().fill(p.accent).frame(width: 7, height: 7).shadow(color: p.accent, radius: 4)
            }
            HStack(spacing: 6) {
                Text("❯").fontWeight(.semibold).foregroundStyle(p.accent)
                Text(p.status.lowercased()).lineLimit(1)
            }.font(.system(size: 13, design: .monospaced))
            if let detail = p.detail { Text("# \(detail)").font(.system(size: 11, design: .monospaced)).foregroundStyle(HarkWidgetColor.secondary).lineLimit(1) }
            if let progress = p.props.progress {
                HStack { ProgressView(value: progress).tint(p.accent); Text(p.percentage ?? "").font(.system(size: 11, design: .monospaced)).foregroundStyle(p.accent) }
            }
        }.foregroundStyle(HarkWidgetColor.primary).padding(.horizontal, 16).padding(.vertical, 13)
    }

    private var steps: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Image(systemName: p.symbol).foregroundStyle(p.accent)
                Text(p.title).font(.headline).fontWeight(.semibold).lineLimit(1)
                Spacer()
                Text(p.status).font(.subheadline.weight(.semibold)).foregroundStyle(p.accent).lineLimit(1)
            }
            if let progress = p.props.progress {
                HStack(spacing: 5) {
                    ForEach(1...5, id: \.self) { index in
                        Capsule().fill(progress + 0.0000001 >= Double(index) / 5 ? p.accent : Color.white.opacity(0.16)).frame(height: 5)
                    }
                }
            }
            if let detail = p.detail { Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(2) }
        }.foregroundStyle(HarkWidgetColor.primary).padding(.horizontal, 16).padding(.vertical, 14)
    }

    private func interactive(theme: InteractiveTheme) -> some View {
        VStack(alignment: theme == .verdict ? .center : .leading, spacing: 9) {
            if theme == .verdict {
                Text("“Hark” requests approval").font(.footnote.weight(.semibold))
            } else {
                HStack {
                    Image(systemName: theme.icon).foregroundStyle(theme.accentOverride ?? p.accent)
                    Text(theme == .shell ? "REQUEST" : p.status).font(theme == .shell ? .system(size: 12, weight: .semibold, design: .monospaced) : .headline).lineLimit(1)
                    Spacer()
                    Text(p.title).font(.caption.weight(.semibold)).foregroundStyle(theme.accentOverride ?? p.accent).lineLimit(1)
                }
            }
            Text(p.props.interaction?.prompt ?? p.detail ?? p.status)
                .font(theme == .shell ? .system(size: 13, design: .monospaced) : .subheadline)
                .foregroundStyle(HarkWidgetColor.secondary).lineLimit(2)
            HarkInteractionButtons(context: context, presentation: p, theme: theme)
        }
        .foregroundStyle(HarkWidgetColor.primary)
        .padding(.horizontal, 16).padding(.vertical, 13)
        .background(theme.background)
    }
}

private struct HarkExpandedBottom: View {
    let context: ActivityViewContext<LiveActivityAttributes>
    let presentation: HarkActivityPresentation
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let interaction = presentation.props.interaction {
                Text(interaction.prompt).font(.subheadline).foregroundStyle(HarkWidgetColor.secondary).lineLimit(2)
                HarkInteractionButtons(context: context, presentation: presentation, theme: .approval)
            } else {
                Text(presentation.status).font(.subheadline.weight(.semibold)).foregroundStyle(presentation.accent)
                if let detail = presentation.detail { Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(2) }
                if let progress = presentation.props.progress { ProgressView(value: progress).tint(presentation.accent) }
            }
        }.padding(.horizontal, 4).padding(.vertical, 2)
    }
}

private struct HarkInteractionButtons: View {
    let context: ActivityViewContext<LiveActivityAttributes>
    let presentation: HarkActivityPresentation
    let theme: InteractiveTheme

    @ViewBuilder var body: some View {
        if #available(iOS 17.0, *),
           let interaction = presentation.props.interaction,
           interaction.state == "pending",
           let interactionID = context.attributes.harkInteractionId,
           let credential = context.attributes.harkInteractionCredential,
           let deviceID = context.attributes.harkInteractionDeviceId,
           let deliveryID = context.attributes.deliveryId,
           let registrationURL = context.attributes.tokenRegistrationURL {
            HStack(spacing: 9) {
                responseButton(interaction.secondaryLabel, action: interaction.secondaryAction, prominent: false, interactionID: interactionID, credential: credential, deviceID: deviceID, deliveryID: deliveryID, registrationURL: registrationURL)
                responseButton(interaction.primaryLabel, action: interaction.primaryAction, prominent: true, interactionID: interactionID, credential: credential, deviceID: deviceID, deliveryID: deliveryID, registrationURL: registrationURL)
            }
        }
    }

    @available(iOS 17.0, *)
    @ViewBuilder private func responseButton(_ label: String, action: String, prominent: Bool, interactionID: String, credential: String, deviceID: String, deliveryID: String, registrationURL: String) -> some View {
        if prominent {
            Button(intent: responseIntent(action: action, interactionID: interactionID, credential: credential, deviceID: deviceID, deliveryID: deliveryID, registrationURL: registrationURL)) {
                Text(label).font(.system(size: 13, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 32)
            }
            .buttonStyle(.borderedProminent)
            .tint(theme.accentOverride ?? presentation.accent)
        } else {
            Button(intent: responseIntent(action: action, interactionID: interactionID, credential: credential, deviceID: deviceID, deliveryID: deliveryID, registrationURL: registrationURL)) {
                Text(label).font(.system(size: 13, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 32)
            }
            .buttonStyle(.bordered)
            .tint(Color.gray)
        }
    }

    @available(iOS 17.0, *)
    private func responseIntent(action: String, interactionID: String, credential: String, deviceID: String, deliveryID: String, registrationURL: String) -> HarkLiveActivityResponseIntent {
        HarkLiveActivityResponseIntent(
            activityID: context.activityID,
            action: action,
            interactionID: interactionID,
            credential: credential,
            deviceID: deviceID,
            deliveryID: deliveryID,
            registrationURL: registrationURL
        )
    }
}

private enum InteractiveTheme {
    case approval, shell, verdict, signal
    var icon: String {
        switch self { case .shell: "terminal.fill"; case .signal: "antenna.radiowaves.left.and.right"; default: "sparkles" }
    }
    var background: Color {
        switch self { case .verdict: Color(hex: "#1C1C1E"); case .shell: Color.black; case .signal: Color(hex: "#08111C"); default: Color(hex: "#0B1512") }
    }
    var accentOverride: Color? {
        switch self { case .verdict: .blue; case .signal: .cyan; default: nil }
    }
}

private enum HarkWidgetColor {
    static let primary = Color(hex: "#F4FBF9")
    static let secondary = Color(hex: "#B8C9C4")
}

private extension Color {
    init(hex: String) {
        let value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let number = UInt64(value, radix: 16) ?? 0xE13B3B
        self.init(
            .sRGB,
            red: Double((number >> 16) & 0xff) / 255,
            green: Double((number >> 8) & 0xff) / 255,
            blue: Double(number & 0xff) / 255,
            opacity: 1
        )
    }
}
