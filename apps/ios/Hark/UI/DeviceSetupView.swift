import SwiftUI
import UIKit
import UserNotifications

struct DeviceSetupView: View {
    @EnvironmentObject private var model: AppModel
    @State private var confirmSignOut = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HarkBrand()
                    Spacer()
                    Button("Sign out", role: .destructive) { confirmSignOut = true }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(HarkTheme.muted)
                }
                .frame(minHeight: 64)

                Text("Two steps and this iPhone starts receiving your webhooks.")
                    .font(.system(size: 32, weight: .semibold))
                    .tracking(-0.64)
                    .foregroundStyle(HarkTheme.ink)
                    .padding(.top, 52)
                    .padding(.bottom, 38)

                SetupStep(
                    number: "1",
                    title: "Allow notifications",
                    detail: permissionDetail,
                    complete: permissionGranted,
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
                    detail: "Hark sends directly through APNs. No Expo push service is involved.",
                    complete: false,
                    button: model.registrationBusy ? "Registering…" : "Register iPhone",
                    disabled: !permissionGranted || model.registrationBusy
                ) { model.registerForPush() }

                if let error = model.registrationError {
                    Text(error).font(.footnote).foregroundStyle(HarkTheme.danger).padding(.top, 18)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 48)
        }
        .background(HarkTheme.paper.ignoresSafeArea())
        .confirmationDialog("Sign out", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await model.signOut() } }
        } message: { Text("This device will stop receiving notifications.") }
    }

    private var permissionGranted: Bool {
        [.authorized, .provisional, .ephemeral].contains(model.notificationStatus)
    }
    private var permissionDetail: String {
        switch model.notificationStatus {
        case .authorized, .provisional, .ephemeral: "Notifications are allowed."
        case .denied: "Notifications are off in Settings."
        default: "Alerts, sounds, badges, and supported urgent notifications."
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
        HStack(alignment: .top, spacing: 16) {
            ZStack {
                Circle().fill(complete ? HarkTheme.accent : HarkTheme.accentSoft)
                Image(systemName: complete ? "checkmark" : "\(number).circle.fill")
                    .foregroundStyle(complete ? .white : HarkTheme.accent)
                    .font(.system(size: complete ? 14 : 22, weight: .semibold))
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(.system(size: 17, weight: .semibold)).foregroundStyle(HarkTheme.ink)
                Text(detail).font(.system(size: 14)).foregroundStyle(HarkTheme.muted).lineSpacing(3)
                if !complete {
                    Button(button) { Task { await action() } }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 18).frame(minHeight: 42)
                        .background(HarkTheme.accent, in: Capsule())
                        .disabled(disabled).opacity(disabled ? 0.45 : 1)
                        .padding(.top, 4)
                }
            }
        }
        .padding(.vertical, 22)
        .overlay(alignment: .top) { Rectangle().fill(HarkTheme.line).frame(height: 0.5) }
    }
}
