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
            let presentation = HarkActivityPresentation(context: context)
            HarkLockScreenView(context: context, p: presentation)
                .activityBackgroundTint(presentation.background)
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "hark://inbox"))
        } dynamicIsland: { context in
            let presentation = HarkActivityPresentation(context: context)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HarkExpandedLeading(p: presentation)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if presentation.style == "steps" {
                        Text(presentation.status)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(presentation.accent).lineLimit(1)
                            .padding(.trailing, 4)
                    } else if let percentage = presentation.percentage {
                        Text(percentage)
                            .font(.system(.subheadline, design: presentation.style == "terminal" ? .monospaced : .default, weight: .semibold))
                            .monospacedDigit().foregroundStyle(presentation.accent)
                            .padding(.trailing, 4)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HarkExpandedBottom(context: context, p: presentation)
                }
            } compactLeading: {
                Image(systemName: presentation.symbol).foregroundStyle(presentation.accent)
            } compactTrailing: {
                Text(presentation.percentage ?? (presentation.style == "terminal" ? "❯_" : presentation.status))
                    .font(.system(size: 12, weight: .semibold, design: presentation.style == "terminal" ? .monospaced : .default))
                    .monospacedDigit().foregroundStyle(presentation.accent).lineLimit(1)
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

    var interactionPending: Bool { props.interaction?.state == "pending" }

    var isInteractive: Bool { ["approval", "shell", "verdict", "signal"].contains(style) }

    /// The approval banner and the Dynamic Island bottom swap the prompt out for
    /// the regular progress copy once the response resolves.
    var promptText: String {
        guard let interaction = props.interaction else { return detail ?? status }
        return interaction.state == "pending" ? interaction.prompt : (detail ?? status)
    }

    /// shell/verdict/signal keep the prompt on screen for the life of the
    /// interaction, resolved or not.
    var persistentPromptText: String { props.interaction?.prompt ?? detail ?? status }

    var a11ySummary: String {
        guard let percentage = percentage else { return "\(title), \(status)" }
        return "\(title), \(status), \(percentage)"
    }

    var background: Color {
        switch style {
        case "shell": Color(hex: "#0A0C0A")
        case "signal": Color(hex: "#141518")
        case "verdict": Color(hex: "#1C1C1E")
        default: Color(hex: "#0B1512")
        }
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
    let p: HarkActivityPresentation

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
        .accessibilityLabel(p.a11ySummary)
    }

    private var ring: some View {
        HStack(spacing: 13) {
            HarkRingGauge(p: p)
            VStack(alignment: .leading, spacing: 2) {
                Text(p.title).font(.headline).fontWeight(.semibold).lineLimit(1)
                Text(p.status).font(.subheadline).fontWeight(.medium).foregroundStyle(p.accent).lineLimit(1)
                if let detail = p.detail { Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(1) }
            }
            Spacer()
        }
        .padding(.horizontal, 16).padding(.vertical, 14).foregroundStyle(HarkWidgetColor.primary)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(p.a11ySummary)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Image(systemName: p.symbol).font(.system(size: 15)).foregroundStyle(p.accent)
                    Text(p.title.uppercased()).font(.footnote.weight(.semibold)).tracking(0.3).foregroundStyle(HarkWidgetColor.secondary).lineLimit(1)
                    Spacer()
                    if let percentage = p.percentage { Text(percentage).font(.system(size: 13, weight: .semibold)).monospacedDigit().foregroundStyle(p.accent) }
                }
                Text(p.status).font(.system(size: 22, weight: .bold)).lineLimit(1)
                if let detail = p.detail { Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(1) }
            }
            .padding(.top, 13).padding(.horizontal, 16).padding(.bottom, 12)
            // The progress bar bleeds to the banner edges, unlike every other style.
            if let progress = p.props.progress { ProgressView(value: progress).tint(p.accent) }
        }
        .foregroundStyle(HarkWidgetColor.primary)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(p.a11ySummary)
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
        }
        .foregroundStyle(HarkWidgetColor.primary).padding(.horizontal, 16).padding(.vertical, 13)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(p.a11ySummary)
    }

    private var steps: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Image(systemName: p.symbol).foregroundStyle(p.accent)
                Text(p.title).font(.headline).fontWeight(.semibold).lineLimit(1)
                Spacer()
                Text(p.status).font(.subheadline.weight(.semibold)).foregroundStyle(p.accent).lineLimit(1)
            }
            if let progress = p.props.progress { HarkStepsPips(progress: progress, accent: p.accent) }
            if let detail = p.detail { Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(2) }
        }
        .foregroundStyle(HarkWidgetColor.primary).padding(.horizontal, 16).padding(.vertical, 14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(p.a11ySummary)
    }

    private func interactive(theme: InteractiveTheme) -> some View {
        VStack(alignment: theme == .verdict ? .center : .leading, spacing: 9) {
            switch theme {
            case .approval:
                HStack(spacing: 8) {
                    Image(systemName: p.interactionPending ? "sparkles" : p.symbol).foregroundStyle(p.accent)
                    Text(p.status).font(.headline).lineLimit(1)
                    Spacer()
                    Text(p.title).font(.caption.weight(.semibold)).foregroundStyle(p.accent).lineLimit(1)
                }
                Text(p.promptText).font(.subheadline).foregroundStyle(HarkWidgetColor.secondary).lineLimit(2)
            case .shell:
                HStack(alignment: .top, spacing: 7) {
                    Text("$").font(.system(size: 13, weight: .semibold, design: .monospaced)).foregroundStyle(Color(hex: "#3FDD78"))
                    Text(p.persistentPromptText).font(.system(size: 13, design: .monospaced)).foregroundStyle(Color(hex: "#D7E4DA")).lineLimit(2)
                    Spacer()
                }
                Text("# reply required to continue").font(.system(size: 11, design: .monospaced)).foregroundStyle(Color(hex: "#4E5C52")).lineLimit(1)
            case .verdict:
                Text("“Hark” requests approval").font(.footnote.weight(.semibold)).foregroundStyle(.white)
                Text(p.persistentPromptText).font(.subheadline).foregroundStyle(Color(hex: "#EBEBF5")).lineLimit(2)
                Divider()
            case .signal:
                HStack(spacing: 7) {
                    Image(systemName: "shield.lefthalf.filled").font(.system(size: 13)).foregroundStyle(Color(hex: "#7D8087"))
                    Text("Guarded action").font(.caption.weight(.semibold)).kerning(0.6).foregroundStyle(Color(hex: "#7D8087"))
                    Spacer()
                }
                Text(p.persistentPromptText).font(.subheadline.weight(.medium)).foregroundStyle(Color(hex: "#F2F3F5")).lineLimit(2)
            }
            HarkInteractionButtons(context: context, presentation: p, theme: theme)
        }
        .foregroundStyle(HarkWidgetColor.primary)
        .padding(.horizontal, theme == .shell ? 14 : 16)
        .padding(.vertical, theme == .approval ? 14 : 13)
    }
}

private struct HarkRingGauge: View {
    let p: HarkActivityPresentation

    var body: some View {
        ZStack {
            if let progress = p.props.progress {
                Circle().stroke(Color.white.opacity(0.12), lineWidth: 7)
                Circle().trim(from: 0, to: max(0.02, progress))
                    .stroke(p.accent, style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90))
                if let percentage = p.percentage {
                    Text(percentage).font(.system(size: 11, weight: .semibold)).monospacedDigit().foregroundStyle(p.accent)
                }
            } else {
                Image(systemName: p.symbol).font(.system(size: 30)).foregroundStyle(p.accent)
            }
        }
        .frame(width: 58, height: 58)
    }
}

private struct HarkStepsPips: View {
    let progress: Double
    let accent: Color

    var body: some View {
        HStack(spacing: 5) {
            ForEach(1...5, id: \.self) { index in
                // The epsilon keeps a reported 0.4 from falling short of the second pip.
                Capsule().fill(progress + 0.0000001 >= Double(index) / 5 ? accent : Color.white.opacity(0.16)).frame(height: 5)
            }
        }
    }
}

private struct HarkExpandedLeading: View {
    let p: HarkActivityPresentation

    @ViewBuilder var body: some View {
        if p.isInteractive {
            HStack(spacing: 7) {
                Image(systemName: "sparkles").foregroundStyle(p.accent)
                Text(p.status).font(.headline).lineLimit(1)
            }
            .padding(.leading, 4)
        } else if p.style == "hero" {
            HStack(spacing: 7) {
                Image(systemName: p.symbol).font(.system(size: 14)).foregroundStyle(p.accent)
                Text(p.title.uppercased()).font(.footnote.weight(.semibold)).tracking(0.3)
                    .foregroundStyle(HarkWidgetColor.secondary).lineLimit(1)
            }
            .padding(.leading, 4)
        } else if p.style == "terminal" {
            HStack(spacing: 7) {
                Image(systemName: p.symbol).foregroundStyle(p.accent)
                Text(p.title).font(.system(size: 13, weight: .semibold, design: .monospaced)).lineLimit(1)
            }
            .padding(.leading, 4)
        } else {
            HStack(spacing: 7) {
                Image(systemName: p.symbol).foregroundStyle(p.accent)
                Text(p.title).font(.headline).lineLimit(1)
            }
            .padding(.leading, 4)
        }
    }
}

private struct HarkExpandedBottom: View {
    let context: ActivityViewContext<LiveActivityAttributes>
    let p: HarkActivityPresentation

    @ViewBuilder var body: some View {
        if p.props.interaction != nil {
            VStack(alignment: .leading, spacing: 8) {
                Text(p.promptText).font(.subheadline).foregroundStyle(HarkWidgetColor.secondary).lineLimit(2)
                HarkInteractionButtons(context: context, presentation: p, theme: .approval)
            }
            .padding(.horizontal, 4).padding(.vertical, 2)
        } else {
            progressBody
                .padding(.horizontal, 4).padding(.vertical, 2)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(p.a11ySummary)
        }
    }

    @ViewBuilder private var progressBody: some View {
        switch p.style {
        case "ring":
            HStack(spacing: 14) {
                HarkRingGauge(p: p)
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.status).font(.subheadline.weight(.semibold)).foregroundStyle(p.accent).lineLimit(1)
                    if let detail = p.detail {
                        Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(1)
                    }
                }
                Spacer()
            }
        case "hero":
            VStack(alignment: .leading, spacing: 7) {
                Text(p.status).font(.system(size: 20, weight: .bold)).foregroundStyle(HarkWidgetColor.primary).lineLimit(1)
                if let progress = p.props.progress { ProgressView(value: progress).tint(p.accent) }
            }
        case "terminal":
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 6) {
                    Text("❯").font(.system(size: 13, weight: .semibold, design: .monospaced)).foregroundStyle(p.accent)
                    Text(p.status.lowercased()).font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(HarkWidgetColor.primary).lineLimit(1)
                    Spacer()
                }
                if let detail = p.detail {
                    Text("# \(detail)").font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(HarkWidgetColor.secondary).lineLimit(1)
                }
                if let progress = p.props.progress { ProgressView(value: progress).tint(p.accent) }
            }
        case "steps":
            VStack(alignment: .leading, spacing: 8) {
                if let progress = p.props.progress { HarkStepsPips(progress: progress, accent: p.accent) }
                if let detail = p.detail {
                    Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(2)
                }
            }
        default:
            VStack(alignment: .leading, spacing: 8) {
                Text(p.status).font(.subheadline.weight(.semibold)).foregroundStyle(p.accent)
                if let detail = p.detail {
                    Text(detail).font(.footnote).foregroundStyle(HarkWidgetColor.secondary).lineLimit(2)
                }
                if let progress = p.props.progress { ProgressView(value: progress).tint(p.accent) }
            }
        }
    }
}

private struct HarkInteractionButtons: View {
    let context: ActivityViewContext<LiveActivityAttributes>
    let presentation: HarkActivityPresentation
    let theme: InteractiveTheme

    @ViewBuilder var body: some View {
        if let interaction = presentation.props.interaction,
           interaction.state == "pending",
           let interactionID = context.attributes.harkInteractionId,
           let credential = context.attributes.harkInteractionCredential,
           let deviceID = context.attributes.harkInteractionDeviceId,
           let deliveryID = context.attributes.deliveryId,
           let registrationURL = context.attributes.tokenRegistrationURL {
            HStack(spacing: 9) {
                responseButton(theme.buttonLabel(interaction.primaryLabel, primary: true), action: interaction.primaryAction, prominent: true, interactionID: interactionID, credential: credential, deviceID: deviceID, deliveryID: deliveryID, registrationURL: registrationURL)
                responseButton(theme.buttonLabel(interaction.secondaryLabel, primary: false), action: interaction.secondaryAction, prominent: false, interactionID: interactionID, credential: credential, deviceID: deviceID, deliveryID: deliveryID, registrationURL: registrationURL)
            }
        }
    }

    @ViewBuilder private func responseButton(_ label: String, action: String, prominent: Bool, interactionID: String, credential: String, deviceID: String, deliveryID: String, registrationURL: String) -> some View {
        let text = Text(label)
            .font(theme.buttonFont)
            .foregroundStyle(prominent ? theme.primaryText : theme.secondaryText)
            .frame(maxWidth: .infinity, minHeight: theme.buttonHeight)
        let intent = HarkLiveActivityResponseIntent(
            activityID: context.activityID,
            action: action,
            interactionID: interactionID,
            credential: credential,
            deviceID: deviceID,
            deliveryID: deliveryID,
            registrationURL: registrationURL
        )
        if prominent {
            Button(intent: intent) { text }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: theme.cornerRadius))
                .tint(theme.primaryTint)
        } else {
            Button(intent: intent) { text }
                .buttonStyle(.bordered)
                .buttonBorderShape(.roundedRectangle(radius: theme.cornerRadius))
                .tint(theme.secondaryTint)
        }
    }
}

private enum InteractiveTheme {
    case approval, shell, verdict, signal

    var cornerRadius: CGFloat {
        switch self { case .shell: 4; case .verdict: 10; default: 8 }
    }
    var buttonHeight: CGFloat {
        switch self { case .shell: 44; case .verdict: 48; default: 46 }
    }
    var primaryTint: Color {
        switch self {
        case .approval: .white
        case .shell: Color(hex: "#173D26")
        case .verdict: Color(hex: "#0A84FF")
        case .signal: Color(hex: "#248A3D")
        }
    }
    var primaryText: Color {
        switch self {
        case .approval: .black
        case .shell: Color(hex: "#3FDD78")
        case .verdict: .white
        case .signal: Color(hex: "#EAFBEF")
        }
    }
    var secondaryTint: Color {
        switch self {
        case .approval: Color(hex: "#98989D")
        case .shell: Color(hex: "#4E5C52")
        case .verdict: Color(hex: "#8E8E93")
        case .signal: Color(hex: "#FF453A")
        }
    }
    var secondaryText: Color {
        switch self {
        case .shell: Color(hex: "#8E9C92")
        case .signal: Color(hex: "#FF6961")
        default: Color(hex: "#EBEBF0")
        }
    }
    var buttonFont: Font {
        switch self {
        case .shell: .system(size: 12, weight: .bold, design: .monospaced)
        case .verdict: .system(size: 14, weight: .semibold)
        default: .system(size: 13, weight: .semibold)
        }
    }
    func buttonLabel(_ raw: String, primary: Bool) -> String {
        guard self == .shell else { return raw }
        return primary ? "\(raw.lowercased()) ⏎" : raw.lowercased()
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
