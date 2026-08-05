import Foundation
import Security

enum KeychainKey: String {
    case sessionCookie = "hark.auth.cookie"
    case cachedUser = "hark.auth.user"
    case apnsToken = "hark.device.apnsToken"
    case deviceID = "hark.device.serverId"
    case interactionQueue = "hark.interaction.responseQueue.v1"
}

struct KeychainStore: Sendable {
    private let service = "dev.abdeen.hark"

    func string(for key: KeychainKey) -> String? {
        guard let data = data(for: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func data(for key: KeychainKey) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    func set(_ value: String, for key: KeychainKey) throws {
        try set(Data(value.utf8), for: key)
    }

    func set(_ data: Data, for key: KeychainKey) throws {
        let identity: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let updateStatus = SecItemUpdate(identity as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var insert = identity
            attributes.forEach { insert[$0.key] = $0.value }
            let status = SecItemAdd(insert as CFDictionary, nil)
            guard status == errSecSuccess else { throw KeychainError.status(status) }
        } else if updateStatus != errSecSuccess {
            throw KeychainError.status(updateStatus)
        }
    }

    func remove(_ key: KeychainKey) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

enum KeychainError: LocalizedError {
    case status(OSStatus)
    var errorDescription: String? {
        switch self { case .status(let status): "Keychain error (\(status))" }
    }
}
