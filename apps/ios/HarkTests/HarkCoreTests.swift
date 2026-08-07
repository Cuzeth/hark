import XCTest
@testable import Hark

final class HarkCoreTests: XCTestCase {
    func testLiveActivityWirePayloadDecodesAllInteractionFields() throws {
        let json = ##"{"schemaVersion":1,"activityId":"act_1","title":"Deploy","status":"Approval needed","detail":"Production","progress":0.75,"updatedAt":"2026-08-05T14:00:00.000Z","symbol":"build","privacyMode":"standard","accentColor":"#CE2020","style":"signal","interaction":{"id":"int_1","kind":"approval","prompt":"Ship this release?","primaryLabel":"Ship","secondaryLabel":"Cancel","primaryAction":"approve","secondaryAction":"deny","state":"pending"}}"##
        let state = LiveActivityAttributes.ContentState(name: "HarkAgentActivity", props: json)

        XCTAssertEqual(state.decodedProps.activityId, "act_1")
        XCTAssertEqual(state.decodedProps.style, "signal")
        XCTAssertEqual(state.decodedProps.progress, 0.75)
        XCTAssertEqual(state.decodedProps.interaction?.primaryAction, "approve")
        XCTAssertEqual(state.decodedProps.interaction?.secondaryLabel, "Cancel")
    }

    @MainActor
    func testPushDataAcceptsDictionaryJSONStringAndTopLevelPayloads() throws {
        let body: [String: Any] = ["sourceName": "Agent", "interactionId": "int_1"]
        XCTAssertEqual(InteractionQueue.pushData(["body": body])["sourceName"] as? String, "Agent")

        let data = try JSONSerialization.data(withJSONObject: body)
        let string = try XCTUnwrap(String(data: data, encoding: .utf8))
        XCTAssertEqual(InteractionQueue.pushData(["body": string])["interactionId"] as? String, "int_1")
        XCTAssertEqual(InteractionQueue.pushData(["sourceName": "Direct"])["sourceName"] as? String, "Direct")
    }

    func testQueuedResponseRoundTripsWithoutEmbeddingDeviceIdentity() throws {
        let value = QueuedInteractionResponse(
            interactionId: "int_offline",
            input: InteractionResponseInput(action: "reply", response: "Done", actionDigest: String(repeating: "a", count: 64)),
            responseToken: String(repeating: "b", count: 43)
        )
        let decoded = try JSONDecoder.hark.decode(QueuedInteractionResponse.self, from: JSONEncoder().encode(value))
        XCTAssertEqual(decoded, value)
    }

    func testISODateParserHandlesServerFractionalDates() {
        XCTAssertNotNil(Date.harkParse("2026-08-05T14:00:00.123Z"))
        XCTAssertNotNil(Date.harkParse("2026-08-05T14:00:00Z"))
    }

    func testTapDestinationMirrorsSharedContractSchema() {
        for blocked in [
            "javascript:alert(1)",
            "data:text/html,x",
            "file:///etc/passwd",
            "blob:https://example.com/id",
            "about:blank",
        ] {
            XCTAssertNil(TapDestination.url(from: blocked), blocked)
        }
        XCTAssertNil(TapDestination.url(from: nil))
        XCTAssertNil(TapDestination.url(from: "no-scheme/path"))
        XCTAssertNil(TapDestination.url(from: "https://example.com/\(String(repeating: "a", count: 2048))"))
        for allowed in [
            "http://example.com",
            "https://example.com",
            "hark://inbox/evt_1",
            "shortcuts://run-shortcut?name=Deploy%20Finished&input=text&text=production",
        ] {
            XCTAssertNotNil(TapDestination.url(from: allowed), allowed)
        }
    }
}
