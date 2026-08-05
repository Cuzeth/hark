import Combine
import SwiftUI
import UIKit
import UserNotifications

@MainActor
final class AppModel: ObservableObject {
    enum Phase { case loading, signedOut, needsDevice, ready }

    @Published var phase: Phase = .loading
    @Published var user: SessionUser?
    @Published var authError: String?
    @Published var signingIn = false
    @Published var notificationStatus: UNAuthorizationStatus = .notDetermined
    @Published var criticalAlertsAllowed = false
    @Published var registrationBusy = false
    @Published var registrationError: String?
    @Published var pending: [InboxInteractionDTO] = []
    @Published var activeActivities: [InboxLiveActivityDTO] = []
    @Published var feed: [InboxActivityDTO] = []
    @Published var feedTotal = 0
    @Published var feedPage = 0
    @Published var feedFilter = "all"
    @Published var inboxLoading = false
    @Published var inboxError: String?
    @Published var registeredDevice: DeviceDTO?

    let api: APIClient
    let interactionQueue: InteractionQueue
    private let keychain = KeychainStore()
    private var observers: [NSObjectProtocol] = []
    private var refreshTask: Task<Void, Never>?
    private var retryTask: Task<Void, Never>?

    init(api: APIClient = APIClient()) {
        self.api = api
        self.interactionQueue = InteractionQueue(api: api)
        installObservers()
        if #available(iOS 17.2, *) {
            LiveActivityCoordinator.shared.start()
        }
        retryTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                await self?.interactionQueue.flush()
            }
        }
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
        refreshTask?.cancel()
        retryTask?.cancel()
    }

    func restore() async {
        await refreshPermission()
        do {
            guard let session = try await api.currentSession() else {
                keychain.remove(.sessionCookie)
                phase = .signedOut
                return
            }
            user = session
            if let token = keychain.string(for: .apnsToken) {
                await registerTokenWithServer(token, preserveReady: true)
            }
            if keychain.string(for: .deviceID) != nil {
                phase = .ready
                startInboxPolling()
                await refreshInbox()
            } else {
                phase = .needsDevice
            }
            if notificationStatus == .authorized || notificationStatus == .provisional || notificationStatus == .ephemeral {
                UIApplication.shared.registerForRemoteNotifications()
            }
            await interactionQueue.flush()
            syncLiveActivities()
        } catch {
            authError = error.localizedDescription
            phase = api.hasSessionCookie ? .signedOut : .signedOut
        }
    }

    func signIn(username: String, password: String) async {
        let username = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !username.isEmpty, !password.isEmpty else {
            authError = "Enter your username and password."
            return
        }
        signingIn = true
        authError = nil
        defer { signingIn = false }
        do {
            user = try await api.signIn(username: username, password: password)
            await refreshPermission()
            phase = keychain.string(for: .deviceID) == nil ? .needsDevice : .ready
            if phase == .ready {
                startInboxPolling()
                await refreshInbox()
            } else if notificationStatus == .authorized {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            authError = error.localizedDescription
        }
    }

    func requestNotifications() async {
        registrationError = nil
        do {
            _ = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound, .criticalAlert])
            await refreshPermission()
            if notificationStatus == .authorized || notificationStatus == .provisional {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch { registrationError = error.localizedDescription }
    }

    func registerForPush() {
        registrationBusy = true
        registrationError = nil
        UIApplication.shared.registerForRemoteNotifications()
    }

    func refreshPermission() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        notificationStatus = settings.authorizationStatus
        criticalAlertsAllowed = settings.criticalAlertSetting == .enabled
    }

    func refreshInbox() async {
        guard phase == .ready else { return }
        inboxLoading = pending.isEmpty && activeActivities.isEmpty && feed.isEmpty
        defer { inboxLoading = false }
        do {
            async let nextPending = api.listPendingInteractions()
            async let nextActive = api.listActiveActivities()
            async let nextFeed = api.activityFeed(filter: feedFilter, page: feedPage)
            let (pending, active, page) = try await (nextPending, nextActive, nextFeed)
            self.pending = pending
            self.activeActivities = active
            if page.items.isEmpty && feedPage > 0 {
                feedPage -= 1
                await refreshInbox()
                return
            }
            feed = page.items
            feedTotal = page.total
            inboxError = nil
            try? await UNUserNotificationCenter.current().setBadgeCount(pending.count)
        } catch let error as APIError where error.status == 401 {
            await forceSignedOut()
        } catch {
            inboxError = error.localizedDescription
        }
    }

    func setFeed(filter: String) async {
        feedFilter = filter
        feedPage = 0
        await refreshInbox()
    }

    func setFeed(page: Int) async {
        feedPage = max(0, page)
        await refreshInbox()
    }

    func respond(to item: InboxInteractionDTO, action: String, response: String? = nil) async {
        await interactionQueue.submit(
            interactionID: item.id,
            action: action,
            response: response,
            actionDigest: item.actionDigest
        )
        pending.removeAll { $0.id == item.id }
        feedPage = 0
        await refreshInbox()
    }

    func deleteFeedItem(_ item: InboxActivityDTO) async throws {
        try await api.deleteActivity(id: item.id)
        feed.removeAll { $0.id == item.id }
        feedTotal = max(0, feedTotal - 1)
        await refreshInbox()
    }

    func loadDeviceDetails() async {
        guard let deviceID = keychain.string(for: .deviceID) else {
            registeredDevice = nil
            return
        }
        registeredDevice = try? await api.listDevices().first { $0.id == deviceID }
    }

    func signOut() async {
        refreshTask?.cancel()
        if let token = keychain.string(for: .apnsToken) { try? await api.unregisterDevice(token: token) }
        keychain.remove(.apnsToken)
        keychain.remove(.deviceID)
        interactionQueue.clear()
        try? await UNUserNotificationCenter.current().setBadgeCount(0)
        await api.signOut()
        user = nil
        pending = []
        activeActivities = []
        feed = []
        registeredDevice = nil
        phase = .signedOut
    }

    private func forceSignedOut() async {
        keychain.remove(.sessionCookie)
        user = nil
        phase = .signedOut
        refreshTask?.cancel()
    }

    private func registerTokenWithServer(_ token: String, preserveReady: Bool = false) async {
        guard user != nil || api.hasSessionCookie else { return }
        if !preserveReady { registrationBusy = true }
        defer { registrationBusy = false }
        do {
            let id = try await api.registerDevice(token: token, name: UIDevice.current.name)
            try keychain.set(token, for: .apnsToken)
            try keychain.set(id, for: .deviceID)
            phase = .ready
            registrationError = nil
            startInboxPolling()
            await interactionQueue.flush()
            syncLiveActivities()
            await refreshInbox()
        } catch {
            if !preserveReady {
                phase = .needsDevice
                registrationError = error.localizedDescription
            }
        }
    }

    private func startInboxPolling() {
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 15_000_000_000)
                await self?.refreshInbox()
            }
        }
    }

    private func installObservers() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: .harkAPNSToken, object: nil, queue: .main) { [weak self] note in
            guard let token = note.object as? String else { return }
            Task { @MainActor in await self?.registerTokenWithServer(token) }
        })
        observers.append(center.addObserver(forName: .harkAPNSError, object: nil, queue: .main) { [weak self] note in
            Task { @MainActor in
                self?.registrationBusy = false
                self?.registrationError = (note.object as? Error)?.localizedDescription ?? "APNs registration failed."
            }
        })
        observers.append(center.addObserver(forName: .harkNotificationResponse, object: nil, queue: .main) { [weak self] note in
            guard let response = note.object as? UNNotificationResponse else { return }
            Task { @MainActor in
                await self?.interactionQueue.handle(response)
                await self?.refreshInbox()
            }
        })
        observers.append(center.addObserver(forName: .harkNotificationReceived, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in await self?.refreshInbox() }
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                await self?.refreshPermission()
                await self?.interactionQueue.flush()
                if self?.phase == .ready { await self?.refreshInbox() }
                self?.syncLiveActivities()
            }
        })
    }

    private func syncLiveActivities() {
        if #available(iOS 17.2, *) {
            LiveActivityCoordinator.shared.resync()
        }
    }
}
