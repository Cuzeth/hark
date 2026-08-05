import SwiftUI

struct InboxView: View {
    @EnvironmentObject private var model: AppModel
    @State private var respondingID: String?
    @State private var replyID: String?
    @State private var reply = ""
    @State private var deletingID: String?
    @State private var actionError: String?

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        header
                        if !model.pending.isEmpty {
                            SectionHeading(title: "Needs your response", count: model.pending.count, first: true)
                            ForEach(model.pending) { item in pendingRow(item) }
                        }
                        if !model.activeActivities.isEmpty {
                            SectionHeading(title: "Active now", first: model.pending.isEmpty)
                            ForEach(model.activeActivities) { item in activeRow(item) }
                        }
                        SectionHeading(title: "Activity", first: model.pending.isEmpty && model.activeActivities.isEmpty)
                            .id("activity")
                        filterPicker
                        if model.inboxLoading {
                            ProgressView().tint(HarkTheme.accent).frame(maxWidth: .infinity).padding(.vertical, 30)
                        } else if model.feed.isEmpty {
                            Text(model.inboxError == nil ? "No activity yet." : "Couldn’t load activity. Pull to refresh.")
                                .font(.system(size: 14)).foregroundStyle(HarkTheme.muted)
                                .padding(.vertical, 28)
                        }
                        ForEach(model.feed) { item in activityRow(item) }
                        if pageCount > 1 { pager(proxy: proxy) }
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 48)
                }
                .refreshable { await model.refreshInbox() }
                .background(HarkTheme.paper)
            }
            .background(HarkTheme.paper.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: SettingsDestination.self) { _ in SettingsView() }
        }
        .alert("Could not complete action", isPresented: Binding(
            get: { actionError != nil },
            set: { if !$0 { actionError = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(actionError ?? "Please try again.") }
    }

    private var header: some View {
        HStack {
            HarkBrand()
            Spacer()
            NavigationLink(value: SettingsDestination.settings) {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 17))
                    .foregroundStyle(HarkTheme.muted)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Settings")
        }
        .frame(minHeight: 64)
    }

    private var filterPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach([
                    ("all", "All"), ("notification", "Notifications"),
                    ("live_activity", "Live Activities"), ("response", "Responses"),
                ], id: \.0) { value, label in
                    Button(label) { Task { await model.setFeed(filter: value) } }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(model.feedFilter == value ? HarkTheme.accent : HarkTheme.muted)
                        .padding(.horizontal, 14).frame(height: 34)
                        .background(model.feedFilter == value ? HarkTheme.accentSoft : Color.clear, in: Capsule())
                }
            }
            .padding(.vertical, 8)
        }
    }

    @ViewBuilder private func pendingRow(_ item: InboxInteractionDTO) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                HarkAvatar(urlString: item.sourceImageUrl, name: item.sourceName)
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(item.sourceName).font(.system(size: 13, weight: .medium)).foregroundStyle(HarkTheme.muted)
                        Spacer()
                        Text(item.createdAt.harkRelativeDate).font(.caption).foregroundStyle(HarkTheme.soft)
                    }
                    Text(item.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(HarkTheme.ink)
                    Text(item.prompt).font(.system(size: 14)).foregroundStyle(HarkTheme.muted).lineSpacing(3)
                    TimelineView(.periodic(from: .now, by: 30)) { context in
                        Text(expiryLabel(item.expiresAt, relativeTo: context.date))
                            .font(.caption)
                            .foregroundStyle(HarkTheme.soft)
                    }
                }
            }
            if item.kind == "approval" || item.kind == "yes_no" {
                let primary = item.kind == "approval" ? "approve" : "yes"
                let secondary = item.kind == "approval" ? "deny" : "no"
                HStack {
                    Button(actionLabel(item.secondaryLabel, fallback: item.kind == "approval" ? "Deny" : "No")) {
                        resolve(item, action: secondary)
                    }
                        .buttonStyle(HarkSecondaryButton())
                    Button(actionLabel(item.primaryLabel, fallback: item.kind == "approval" ? "Approve" : "Yes")) {
                        resolve(item, action: primary)
                    }
                        .buttonStyle(HarkPrimaryButton())
                }
                .disabled(respondingID != nil)
            } else if replyID == item.id {
                TextEditor(text: $reply)
                    .font(.system(size: 15))
                    .frame(minHeight: 88)
                    .padding(8)
                    .scrollContentBackground(.hidden)
                    .background(HarkTheme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(HarkTheme.line, lineWidth: 0.5))
                HStack {
                    Button("Cancel") { replyID = nil; reply = "" }.buttonStyle(HarkSecondaryButton())
                    Button("Send") { resolve(item, action: "reply", response: reply) }
                        .buttonStyle(HarkPrimaryButton())
                        .disabled(reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || respondingID != nil)
                }
            } else {
                Button { replyID = item.id } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "arrow.turn.down.left").font(.system(size: 13))
                        Text("Reply")
                    }
                }
                .buttonStyle(HarkReplyButton())
                .disabled(respondingID != nil)
            }
        }
        .padding(.vertical, 18)
        .overlay(alignment: .top) { Rectangle().fill(HarkTheme.line).frame(height: 0.5) }
    }

    private func activeRow(_ item: InboxLiveActivityDTO) -> some View {
        HStack(alignment: .top, spacing: 12) {
            HarkAvatar(urlString: item.sourceImageUrl, name: item.sourceName)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(item.props.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(HarkTheme.ink)
                    Spacer()
                    if let progress = item.props.progress {
                        Text("\(Int((progress * 100).rounded()))%")
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .foregroundStyle(HarkTheme.accent)
                    }
                }
                Text(item.props.detail ?? item.props.status).font(.system(size: 14)).foregroundStyle(HarkTheme.muted)
                if let progress = item.props.progress {
                    ProgressView(value: progress).tint(HarkTheme.accent)
                }
            }
        }
        .padding(.vertical, 18)
        .overlay(alignment: .top) { Rectangle().fill(HarkTheme.line).frame(height: 0.5) }
    }

    private func activityRow(_ item: InboxActivityDTO) -> some View {
        HStack(alignment: .top, spacing: 12) {
            HarkAvatar(urlString: item.sourceImageUrl, name: item.sourceName)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("\(item.sourceName) · \(kindLabel(item.kind))")
                        .font(.system(size: 13, weight: .medium)).foregroundStyle(HarkTheme.muted)
                        .lineLimit(1)
                    Spacer()
                    Text(item.createdAt.harkRelativeDate).font(.caption).foregroundStyle(HarkTheme.soft)
                }
                Text(item.title).font(.system(size: 15, weight: .semibold)).foregroundStyle(HarkTheme.ink)
                if let detail = item.detail { Text(detail).font(.system(size: 14)).foregroundStyle(HarkTheme.muted).lineLimit(4) }
                if let result = item.result { Text(result).font(.system(size: 13, weight: .medium)).foregroundStyle(HarkTheme.accent) }
            }
            if deletingID == item.id { ProgressView().controlSize(.small) }
        }
        .padding(.vertical, 16)
        .overlay(alignment: .top) { Rectangle().fill(HarkTheme.line).frame(height: 0.5) }
        .contextMenu {
            if let string = item.url, let url = URL(string: string) {
                Link(destination: url) { Label("Open", systemImage: "arrow.up.right.square") }
            }
            Button(role: .destructive) { remove(item) } label: { Label("Delete", systemImage: "trash") }
        }
    }

    private var pageCount: Int { max(1, Int(ceil(Double(model.feedTotal) / 20))) }

    private func pager(proxy: ScrollViewProxy) -> some View {
        HStack {
            Button { Task { await model.setFeed(page: model.feedPage - 1); proxy.scrollTo("activity", anchor: .top) } } label: {
                Image(systemName: "chevron.left").frame(width: 40, height: 40)
            }.disabled(model.feedPage == 0)
            Spacer()
            let start = model.feedPage * 20 + 1
            let end = min((model.feedPage + 1) * 20, model.feedTotal)
            Text("\(start)–\(end) of \(model.feedTotal)").font(.footnote).foregroundStyle(HarkTheme.muted)
            Spacer()
            Button { Task { await model.setFeed(page: model.feedPage + 1); proxy.scrollTo("activity", anchor: .top) } } label: {
                Image(systemName: "chevron.right").frame(width: 40, height: 40)
            }.disabled(model.feedPage >= pageCount - 1)
        }
        .foregroundStyle(HarkTheme.ink)
        .padding(.top, 18)
    }

    private func resolve(_ item: InboxInteractionDTO, action: String, response: String? = nil) {
        respondingID = item.id
        Task {
            await model.respond(to: item, action: action, response: response)
            respondingID = nil
            replyID = nil
            reply = ""
        }
    }

    private func actionLabel(_ label: String?, fallback: String) -> String {
        guard let label, !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return fallback }
        return label
    }

    private func kindLabel(_ kind: String) -> String {
        switch kind {
        case "live_activity": "Live Activity"
        case "response": "Response"
        default: "Notification"
        }
    }

    private func expiryLabel(_ value: String, relativeTo now: Date) -> String {
        guard let expiry = Date.harkParse(value) else { return "Expiry unavailable" }
        guard expiry > now else { return "Expired" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return "Expires \(formatter.localizedString(for: expiry, relativeTo: now))"
    }

    private func remove(_ item: InboxActivityDTO) {
        deletingID = item.id
        Task {
            do { try await model.deleteFeedItem(item) }
            catch { actionError = error.localizedDescription }
            deletingID = nil
        }
    }
}

private enum SettingsDestination: Hashable { case settings }

private struct SectionHeading: View {
    let title: String
    var count: Int?
    var first = false
    var body: some View {
        HStack(spacing: 8) {
            Text(title.uppercased()).font(.system(size: 12, weight: .semibold)).tracking(0.55)
            if let count {
                Text("\(count)").font(.system(size: 11, weight: .semibold)).foregroundStyle(HarkTheme.accent)
                    .padding(.horizontal, 7).frame(height: 20).background(HarkTheme.accentSoft, in: Capsule())
            }
        }
        .foregroundStyle(HarkTheme.muted)
        .padding(.top, first ? 28 : 34).padding(.bottom, 8)
    }
}

private struct HarkPrimaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 42).background(HarkTheme.accent, in: Capsule())
            .opacity(configuration.isPressed ? 0.76 : 1)
    }
}

private struct HarkSecondaryButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(size: 14, weight: .semibold)).foregroundStyle(HarkTheme.ink)
            .frame(maxWidth: .infinity, minHeight: 42).background(HarkTheme.surface, in: Capsule())
            .overlay(Capsule().stroke(HarkTheme.line, lineWidth: 0.5)).opacity(configuration.isPressed ? 0.65 : 1)
    }
}

private struct HarkReplyButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(size: 14, weight: .medium)).foregroundStyle(HarkTheme.accent)
            .frame(maxWidth: .infinity, minHeight: 42).background(HarkTheme.surface, in: Capsule())
            .overlay(Capsule().stroke(HarkTheme.line, lineWidth: 0.5)).opacity(configuration.isPressed ? 0.65 : 1)
    }
}
