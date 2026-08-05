import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                ZStack {
                    HarkTheme.paper.ignoresSafeArea()
                    ProgressView().tint(HarkTheme.accent)
                }
            case .signedOut:
                SignInView()
            case .needsDevice:
                DeviceSetupView()
            case .ready:
                InboxView()
            }
        }
        .preferredColorScheme(.light)
        .task { if model.phase == .loading { await model.restore() } }
    }
}

#Preview {
    ContentView().environmentObject(AppModel())
}
