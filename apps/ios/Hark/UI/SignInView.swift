import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var model: AppModel
    @State private var username = ""
    @State private var password = ""
    @FocusState private var focus: Field?
    private enum Field { case username, password }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HarkBrand().frame(minHeight: 64)
            Spacer()
            VStack(alignment: .leading, spacing: 20) {
                Text("Sign in")
                    .font(.system(size: 40, weight: .semibold))
                    .tracking(-0.8)
                    .foregroundStyle(HarkTheme.ink)
                Text("A private instance. Use the account credentials for this server.")
                    .font(.system(size: 16))
                    .foregroundStyle(HarkTheme.muted)
                    .lineSpacing(5)
                    .frame(maxWidth: 330, alignment: .leading)
            }
            Spacer()
            VStack(spacing: 10) {
                TextField("Username", text: $username)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .focused($focus, equals: .username)
                    .onSubmit { focus = .password }
                    .harkInput()
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .submitLabel(.go)
                    .focused($focus, equals: .password)
                    .onSubmit { Task { await submit() } }
                    .harkInput()
                Button { Task { await submit() } } label: {
                    Group {
                        if model.signingIn { ProgressView().tint(.white) }
                        else { Text("Sign in").fontWeight(.medium) }
                    }
                    .frame(maxWidth: .infinity, minHeight: 52)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.white)
                .background(HarkTheme.accent, in: Capsule())
                .disabled(model.signingIn)
                if let error = model.authError {
                    Text(error).font(.footnote).foregroundStyle(HarkTheme.danger).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.bottom, 16)
        }
        .padding(.horizontal, 24)
        .background(HarkTheme.paper.ignoresSafeArea())
    }

    private func submit() async {
        focus = nil
        await model.signIn(username: username, password: password)
    }
}

private extension View {
    func harkInput() -> some View {
        self
            .font(.system(size: 16))
            .padding(.horizontal, 20)
            .frame(minHeight: 52)
            .background(HarkTheme.surface, in: Capsule())
            .overlay(Capsule().stroke(HarkTheme.line, lineWidth: 0.5))
            .foregroundStyle(HarkTheme.ink)
    }
}
