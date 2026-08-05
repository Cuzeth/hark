import SwiftUI
import UIKit
import UserNotifications

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var confirmSignOut = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Button { dismiss() } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                        .foregroundStyle(HarkTheme.ink).accessibilityLabel("Back")
                    Spacer()
                    Text("Settings").font(.system(size: 17, weight: .semibold))
                    Spacer()
                    Color.clear.frame(width: 44, height: 44)
                }.frame(minHeight: 64)

                section("Device")
                settingsRow(icon: "bell.fill", label: "Notifications", value: permissionValue, opensSettings: model.notificationStatus == .denied)
                settingsRow(icon: "bell.badge.fill", label: "Critical alerts", value: model.criticalAlertsAllowed ? "Allowed" : "Off", opensSettings: !model.criticalAlertsAllowed)
                Text("Critical alerts sound even when this iPhone is muted or in a Focus. They are meant for genuine emergencies only and are not a substitute for contacting local emergency services.")
                    .font(.system(size: 12)).foregroundStyle(HarkTheme.muted).lineSpacing(3).padding(.vertical, 8)
                settingsRow(icon: "iphone", label: "This iPhone", value: model.registeredDevice == nil ? "Not registered" : "Registered")
                settingsRow(icon: "waveform.path.ecg", label: "Live Activities", value: model.registeredDevice?.liveActivitiesCapable == true ? "Available" : "Not available")

                section("Account")
                settingsRow(icon: "person.fill", label: "Signed in as", value: model.user?.email ?? "")
                Button("Sign out") { confirmSignOut = true }
                    .font(.system(size: 14, weight: .medium)).foregroundStyle(HarkTheme.ink)
                    .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                    .overlay(alignment: .top) { Rectangle().fill(HarkTheme.line).frame(height: 0.5) }
            }
            .padding(.horizontal, 24).padding(.bottom, 48)
        }
        .background(HarkTheme.paper.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await model.refreshPermission(); await model.loadDeviceDetails() }
        .confirmationDialog("Sign out", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await model.signOut(); dismiss() } }
        } message: { Text("This device will stop receiving notifications.") }
    }

    private var permissionValue: String {
        [.authorized, .provisional, .ephemeral].contains(model.notificationStatus) ? "Allowed" : "Off"
    }

    private func section(_ title: String) -> some View {
        Text(title.uppercased()).font(.system(size: 12, weight: .semibold)).tracking(0.55)
            .foregroundStyle(HarkTheme.muted).padding(.top, 30).padding(.bottom, 8)
    }

    private func settingsRow(icon: String, label: String, value: String, opensSettings: Bool = false) -> some View {
        Button {
            guard opensSettings, let url = URL(string: UIApplication.openSettingsURLString) else { return }
            Task { await UIApplication.shared.open(url) }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: icon).font(.system(size: 15)).foregroundStyle(HarkTheme.accent)
                    .frame(width: 30, height: 30).background(HarkTheme.accentSoft, in: Circle())
                Text(label).font(.system(size: 14, weight: .medium)).foregroundStyle(HarkTheme.ink)
                Spacer()
                Text(value).font(.system(size: 13)).foregroundStyle(HarkTheme.soft).lineLimit(1)
                if opensSettings { Image(systemName: "chevron.right").font(.caption).foregroundStyle(HarkTheme.soft) }
            }
            .frame(minHeight: 58)
            .overlay(alignment: .top) { Rectangle().fill(HarkTheme.line).frame(height: 0.5) }
        }
        .buttonStyle(.plain).disabled(!opensSettings)
    }
}
