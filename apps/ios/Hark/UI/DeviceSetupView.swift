import SwiftUI
import UIKit
import UserNotifications

struct DeviceSetupView: View {
    @EnvironmentObject private var model: AppModel
    @State private var confirmSignOut = false
    @State private var deletingEventID: String?
    @State private var eventError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HarkBrand()
                    Spacer()
                    Button("Sign out", role: .destructive) { confirmSignOut = true }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(HarkTheme.muted)
                }
                .frame(minHeight: 64)

                Text("Two steps and this iPhone starts receiving your webhooks.")
                    .font(.system(size: 23, weight: .semibold))
                    .tracking(-0.46)
                    .foregroundStyle(HarkTheme.ink)
                    .frame(maxWidth: 340, alignment: .leading)
                    .padding(.top, 18)
                    .padding(.bottom, 10)

                SetupStep(
                    number: "1",
                    title: "Allow notifications",
                    detail: permissionDetail,
                    complete: model.notificationsGranted,
                    button: model.notificationStatus == .denied ? "Open Settings" : "Allow notifications"
                ) {
                    if model.notificationStatus == .denied {
                        if let url = URL(string: UIApplication.openSettingsURLString) { await UIApplication.shared.open(url) }
                    } else {
                        await model.requestNotifications()
                    }
                }

                SetupStep(
                    number: "2",
                    title: "Register this iPhone",
                    detail: model.deviceRegistered
                        ? "This device is registered and ready when notifications are enabled."
                        : "Links this iPhone to your account so your services can reach it.",
                    complete: model.deviceRegistered,
                    button: model.registrationBusy ? "Registering…" : "Register iPhone",
                    disabled: !model.notificationsGranted || model.registrationBusy
                ) { model.registerForPush() }

                if let error = model.registrationError {
                    Text(error).font(.system(size: 12)).foregroundStyle(HarkTheme.danger).padding(.top, 18)
                }

                eventsSection
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 48)
        }
        .background(HarkTheme.paper.ignoresSafeArea())
        .task {
            while !Task.isCancelled {
                await model.refreshEvents()
                try? await Task.sleep(nanoseconds: 10_000_000_000)
            }
        }
        .confirmationDialog("Sign out", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await model.signOut() } }
        } message: { Text("This device will stop receiving notifications.") }
        .alert("Could not delete", isPresented: Binding(
            get: { eventError != nil },
            set: { if !$0 { eventError = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(eventError ?? "Please try again.") }
    }

    private var eventsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Recent activity").font(.system(size: 16, weight: .semibold)).foregroundStyle(HarkTheme.ink)
                Spacer()
                Button("Refresh") { Task { await model.refreshEvents() } }
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(HarkTheme.muted)
            }
            .frame(minHeight: 40)
            if model.events == nil {
                emptyLine("Loading…")
            } else if model.events?.isEmpty == true {
                emptyLine("No webhook activity yet.")
            }
            ForEach(model.events ?? []) { event in
                EventRow(event: event, deleting: deletingEventID == event.id) { delete(event) }
            }
        }
        .padding(.top, 18)
    }

    private func emptyLine(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12)).foregroundStyle(HarkTheme.soft)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 20)
            .overlay(alignment: .top) { Rectangle().fill(HarkTheme.line).frame(height: 0.5) }
    }

    private func delete(_ event: EventDTO) {
        guard deletingEventID == nil else { return }
        deletingEventID = event.id
        Task {
            do { try await model.deleteEvent(event) }
            catch { eventError = error.localizedDescription }
            deletingEventID = nil
        }
    }

    private var permissionDetail: String {
        switch model.notificationStatus {
        case .authorized, .provisional, .ephemeral: "Notifications are allowed."
        case .denied: "Notifications are turned off. Enable them for Hark in the iOS Settings app."
        default: "Hark shows each webhook as a communication notification with your service's name and avatar."
        }
    }
}

private struct EventRow: View {
    let event: EventDTO
    let deleting: Bool
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            HarkAvatar(urlString: event.imageUrl, name: event.serviceTitle, size: 32)
                .overlay(alignment: .bottomTrailing) {
                    Circle().fill(HarkTheme.paper).frame(width: 13, height: 13)
                        .overlay(Circle().fill(statusDot).frame(width: 7, height: 7))
                        .offset(x: 2, y: 2)
                }
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("\(event.serviceTitle) · \(event.title)")
                        .font(.system(size: 12, weight: .medium)).foregroundStyle(HarkTheme.ink)
                        .lineLimit(1)
                    Spacer()
                    Text(eventTime).font(.system(size: 10)).foregroundStyle(HarkTheme.soft)
                }
                Text(event.body).font(.system(size: 11)).foregroundStyle(HarkTheme.muted).lineLimit(2)
                Text(statusText).font(.system(size: 9)).foregroundStyle(HarkTheme.soft)
            }
        }
        .padding(.vertical, 10)
        .opacity(deleting ? 0.4 : 1)
        .overlay(alignment: .top) { Rectangle().fill(HarkTheme.line).frame(height: 0.5) }
        .contextMenu {
            Button(role: .destructive) { onDelete() } label: { Label("Delete from history", systemImage: "trash") }
        }
    }

    private var eventTime: String {
        guard let date = Date.harkParse(event.createdAt) else { return "" }
        return date.formatted(date: .omitted, time: .shortened)
    }

    private var statusDot: Color {
        switch event.status {
        case "accepted", "delivered": HarkTheme.accent
        case "failed": HarkTheme.danger
        case "partial": Color(red: 212/255, green: 138/255, blue: 22/255)
        default: HarkTheme.line
        }
    }

    private var statusText: String {
        switch event.status {
        case "accepted", "delivered":
            "Accepted for \(event.deliveredCount) \(event.deliveredCount == 1 ? "device" : "devices")"
        case "partial": "Partially accepted"
        case "no_devices": "No active devices"
        case "processing": "Processing"
        default: event.error.map { "Failed · \($0)" } ?? "Failed"
        }
    }
}

private struct SetupStep: View {
    let number: String
    let title: String
    let detail: String
    let complete: Bool
    let button: String
    var disabled = false
    let action: () async -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                Circle().fill(complete ? HarkTheme.accent : HarkTheme.accentSoft)
                if complete {
                    Image(systemName: "checkmark")
                        .font(.system(size: 9, weight: .semibold)).foregroundStyle(.white)
                } else {
                    Text(number).font(.system(size: 12, weight: .semibold)).foregroundStyle(HarkTheme.accent)
                }
            }
            .frame(width: 26, height: 26)
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(HarkTheme.ink)
                Text(detail).font(.system(size: 13)).foregroundStyle(HarkTheme.muted).lineSpacing(3)
                if !complete {
                    Button(button) { Task { await action() } }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 18).frame(minHeight: 42)
                        .background(HarkTheme.accent, in: Capsule())
                        .disabled(disabled).opacity(disabled ? 0.45 : 1)
                        .padding(.top, 4)
                }
            }
        }
        .padding(.vertical, 14)
        .overlay(alignment: .top) { Rectangle().fill(HarkTheme.line).frame(height: 0.5) }
    }
}
