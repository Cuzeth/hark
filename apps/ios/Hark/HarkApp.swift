//
//  HarkApp.swift
//  Hark
//
//

import SwiftUI

@main
struct HarkApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .tint(HarkTheme.accent)
        }
    }
}
