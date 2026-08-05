import SwiftUI

enum HarkTheme {
    static let paper = Color(red: 250/255, green: 250/255, blue: 249/255)
    static let surface = Color.white
    static let ink = Color(red: 23/255, green: 23/255, blue: 19/255)
    static let muted = Color(red: 107/255, green: 106/255, blue: 99/255)
    static let soft = Color(red: 163/255, green: 161/255, blue: 153/255)
    static let line = Color(red: 231/255, green: 229/255, blue: 224/255)
    static let accent = Color(red: 206/255, green: 32/255, blue: 32/255)
    static let accentSoft = Color(red: 246/255, green: 231/255, blue: 229/255)
    static let danger = Color(red: 201/255, green: 59/255, blue: 44/255)
}

struct HarkBrand: View {
    var body: some View {
        HStack(spacing: 9) {
            Circle().fill(HarkTheme.accent).frame(width: 10, height: 10)
            Text("Hark").font(.system(size: 18, weight: .semibold)).tracking(-0.36)
        }
        .foregroundStyle(HarkTheme.ink)
        .accessibilityElement(children: .combine)
    }
}

struct HarkAvatar: View {
    let urlString: String?
    let name: String
    var size: CGFloat = 38

    var body: some View {
        ZStack {
            Circle().fill(HarkTheme.accentSoft)
            Text(String(name.prefix(1)).uppercased())
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundStyle(HarkTheme.accent)
            if let value = urlString, let url = URL(string: value) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: { Color.clear }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
}

extension String {
    var harkRelativeDate: String {
        guard let date = Date.harkParse(self) else { return self }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
