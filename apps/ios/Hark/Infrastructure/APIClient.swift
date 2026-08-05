import Foundation

struct APIError: LocalizedError, Equatable {
    let message: String
    let status: Int
    var errorDescription: String? { message }
    var isTerminalInteractionError: Bool { [400, 404, 409].contains(status) }
}

final class APIClient {
    let baseURL: URL
    private let session: URLSession
    private let keychain: KeychainStore

    init(baseURL: URL = HarkConfiguration.apiBaseURL, keychain: KeychainStore = KeychainStore()) {
        self.baseURL = baseURL
        self.keychain = keychain
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.timeoutIntervalForRequest = 20
        session = URLSession(configuration: configuration)
    }

    var hasSessionCookie: Bool { keychain.string(for: .sessionCookie) != nil }

    func signIn(username: String, password: String) async throws -> SessionUser {
        struct Body: Encodable { let username: String; let password: String }
        let (data, response) = try await rawRequest(
            "/api/auth/sign-in/username",
            method: "POST",
            body: Body(username: username, password: password),
            authenticated: false
        )
        try persistCookies(from: response)
        if let envelope = try? JSONDecoder.hark.decode(SignInEnvelope.self, from: data),
           let user = envelope.user { return user }
        guard let session = try await currentSession() else {
            throw APIError(message: "The server did not create a session.", status: 401)
        }
        return session
    }

    func currentSession() async throws -> SessionUser? {
        guard hasSessionCookie else { return nil }
        do {
            let (data, _) = try await rawRequest("/api/auth/get-session", authenticated: true)
            if data == Data("null".utf8) { return nil }
            return try JSONDecoder.hark.decode(SessionEnvelope.self, from: data).user
        } catch let error as APIError where error.status == 401 {
            return nil
        }
    }

    func signOut() async {
        _ = try? await rawRequest("/api/auth/sign-out", method: "POST", authenticated: true)
        keychain.remove(.sessionCookie)
    }

    func listDevices() async throws -> [DeviceDTO] {
        try await request("/api/devices", as: DeviceEnvelope.self).devices
    }

    func registerDevice(token: String, name: String?) async throws -> String {
        let input = DeviceRegisterInput(
            apnsToken: token,
            deviceName: name,
            liveActivityInteractionVersion: 1
        )
        return try await request("/api/devices", method: "POST", body: input, as: DeviceRegistrationEnvelope.self).device.id
    }

    func unregisterDevice(token: String) async throws {
        _ = try await request("/api/devices", method: "DELETE", body: DeviceUnregisterInput(apnsToken: token), as: OkayResponse.self)
    }

    func listEvents(limit: Int = 20) async throws -> [EventDTO] {
        try await request("/api/events?limit=\(limit)", as: EventsEnvelope.self).events
    }

    func listPendingInteractions() async throws -> [InboxInteractionDTO] {
        try await request("/api/interactions", as: InteractionsEnvelope.self).interactions
    }

    func listActiveActivities() async throws -> [InboxLiveActivityDTO] {
        try await request("/api/activities", as: ActivitiesEnvelope.self).activities
    }

    func activityFeed(filter: String, page: Int, pageSize: Int = 20) async throws -> ActivityFeedPageDTO {
        let safeFilter = filter.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "all"
        return try await request("/api/activity-feed?filter=\(safeFilter)&page=\(page)&pageSize=\(pageSize)", as: ActivityFeedPageDTO.self)
    }

    func deleteActivity(id: String) async throws {
        let safeID = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        _ = try await request("/api/activity-feed/\(safeID)", method: "DELETE", as: OkayResponse.self)
    }

    func respondAuthenticated(_ queued: QueuedInteractionResponse, deviceID: String) async throws {
        let safeID = queued.interactionId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? queued.interactionId
        let input = AuthenticatedInteractionResponse(
            action: queued.input.action,
            response: queued.input.response,
            actionDigest: queued.input.actionDigest,
            deviceId: deviceID
        )
        _ = try await request("/api/interactions/\(safeID)/respond", method: "POST", body: input, as: InteractionEnvelope.self)
    }

    func respondWithCredential(_ queued: QueuedInteractionResponse, deviceID: String) async throws {
        guard let token = queued.responseToken else { return }
        let safeID = queued.interactionId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? queued.interactionId
        let input = CredentialInteractionResponse(
            action: queued.input.action,
            response: queued.input.response,
            responseToken: token,
            deviceId: deviceID
        )
        _ = try await request("/api/interaction-responses/\(safeID)/respond", method: "POST", body: input, as: CredentialResponseEnvelope.self, authenticated: false)
    }

    func registerPushToStartToken(_ token: String, deviceID: String) async throws {
        _ = try await request(
            "/api/devices/live-activity/push-to-start",
            method: "POST",
            body: PushToStartTokenInput(deviceId: deviceID, pushToStartToken: token, environment: HarkConfiguration.apnsEnvironment),
            as: TokenRegistrationEnvelope.self
        )
    }

    func registerActivityUpdateToken(_ token: String, activityID: String?, deviceID: String) async throws {
        _ = try await request(
            "/api/devices/live-activity/update-token",
            method: "POST",
            body: ActivityUpdateTokenInput(deviceId: deviceID, updateToken: token, nativeActivityId: activityID, environment: HarkConfiguration.apnsEnvironment),
            as: TokenRegistrationEnvelope.self
        )
    }

    private func request<Response: Decodable>(
        _ path: String,
        method: String = "GET",
        as type: Response.Type,
        authenticated: Bool = true
    ) async throws -> Response {
        let (data, _) = try await rawRequest(path, method: method, authenticated: authenticated)
        do { return try JSONDecoder.hark.decode(Response.self, from: data) }
        catch { throw APIError(message: "The server returned an unreadable response.", status: -1) }
    }

    private func request<Body: Encodable, Response: Decodable>(
        _ path: String,
        method: String,
        body: Body,
        as type: Response.Type,
        authenticated: Bool = true
    ) async throws -> Response {
        let (data, _) = try await rawRequest(path, method: method, body: body, authenticated: authenticated)
        do { return try JSONDecoder.hark.decode(Response.self, from: data) }
        catch { throw APIError(message: "The server returned an unreadable response.", status: -1) }
    }

    private func rawRequest(
        _ path: String,
        method: String = "GET",
        authenticated: Bool
    ) async throws -> (Data, HTTPURLResponse) {
        try await rawRequest(path, method: method, bodyData: nil, authenticated: authenticated)
    }

    private func rawRequest<Body: Encodable>(
        _ path: String,
        method: String,
        body: Body,
        authenticated: Bool
    ) async throws -> (Data, HTTPURLResponse) {
        try await rawRequest(path, method: method, bodyData: try JSONEncoder().encode(body), authenticated: authenticated)
    }

    private func rawRequest(
        _ path: String,
        method: String,
        bodyData: Data?,
        authenticated: Bool
    ) async throws -> (Data, HTTPURLResponse) {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIError(message: "Invalid server URL.", status: -1)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = bodyData
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("hark://", forHTTPHeaderField: "Origin")
        request.setValue("hark://", forHTTPHeaderField: "expo-origin")
        request.setValue("true", forHTTPHeaderField: "x-skip-oauth-proxy")
        if authenticated, let cookie = keychain.string(for: .sessionCookie) {
            request.setValue(cookie, forHTTPHeaderField: "Cookie")
        }

        let (data, rawResponse) = try await session.data(for: request)
        guard let response = rawResponse as? HTTPURLResponse else {
            throw APIError(message: "No response from the server.", status: -1)
        }
        guard (200..<300).contains(response.statusCode) else {
            let server = try? JSONDecoder.hark.decode(ServerErrorEnvelope.self, from: data)
            throw APIError(message: server?.error ?? "Request failed (\(response.statusCode)).", status: response.statusCode)
        }
        try persistCookiesIfPresent(from: response)
        return (data, response)
    }

    private func persistCookies(from response: HTTPURLResponse) throws {
        guard let header = cookieHeader(from: response) else {
            throw APIError(message: "The server did not return a session cookie.", status: 401)
        }
        try keychain.set(header, for: .sessionCookie)
    }

    private func persistCookiesIfPresent(from response: HTTPURLResponse) throws {
        guard let header = cookieHeader(from: response) else { return }
        try keychain.set(header, for: .sessionCookie)
    }

    private func cookieHeader(from response: HTTPURLResponse) -> String? {
        let fields = response.allHeaderFields.reduce(into: [String: String]()) { result, pair in
            result[String(describing: pair.key)] = String(describing: pair.value)
        }
        let cookies = HTTPCookie.cookies(withResponseHeaderFields: fields, for: baseURL)
        guard !cookies.isEmpty else { return nil }
        return HTTPCookie.requestHeaderFields(with: cookies)["Cookie"]
            ?? cookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
    }
}

private struct ServerErrorEnvelope: Decodable { let error: String }
private struct InteractionEnvelope: Decodable { let interaction: InteractionDTO }
private struct CredentialResponseEnvelope: Decodable { let ok: Bool; let status: String }
private struct TokenRegistrationEnvelope: Decodable {
    let deviceId: String?
    let activityId: String?
    let updatedAt: String?
}
