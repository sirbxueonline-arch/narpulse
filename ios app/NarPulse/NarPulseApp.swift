import SwiftUI
import MapKit
import Observation
import Foundation
import UIKit
import PhotosUI

@main
struct NarPulseApp: App {
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .preferredColorScheme(.dark)
                .task {
                    await store.refresh()
                }
                .onOpenURL { url in
                    Task { await store.handleAuthDeepLink(url) }
                }
        }
    }
}

struct AuthSession: Codable, Equatable {
    let accessToken: String
    let refreshToken: String?
    let userId: String
    let email: String
}

enum AppError: LocalizedError {
    case notConfigured
    case notSignedIn
    case server(String)
    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Supabase URL/açar tənzimlənməyib."
        case .notSignedIn: return "Daxil olmalısınız."
        case .server(let msg): return msg
        }
    }
}

@Observable
final class AppStore {
    var outages: [Outage] = MockData.outages
    var locations: [ServiceLocation] = MockData.locations
    var waits: [WaitCheckin] = MockData.waits
    var pins: [SafetyPin] = MockData.pins
    var isLoading = false
    var lastUpdated: Date?
    var offlineMessage: String?
    var session: AuthSession? {
        didSet { persistSession() }
    }

    private let service = NarPulseService()
    private let sessionKey = "narpulse.session.v1"

    init() {
        if let data = UserDefaults.standard.data(forKey: sessionKey),
           let s = try? JSONDecoder().decode(AuthSession.self, from: data) {
            self.session = s
        }
    }

    private func persistSession() {
        if let s = session, let data = try? JSONEncoder().encode(s) {
            UserDefaults.standard.set(data, forKey: sessionKey)
        } else {
            UserDefaults.standard.removeObject(forKey: sessionKey)
        }
    }

    @MainActor
    func sendOtp(email: String) async throws {
        try await service.sendOtp(email: email)
    }

    @MainActor
    func verifyOtp(email: String, token: String) async throws {
        self.session = try await service.verifyOtp(email: email, token: token)
    }

    @MainActor
    func signOut() {
        self.session = nil
    }

    /// Handles `narpulse://login-callback` deep links from the magic-link email.
    /// Supports BOTH the implicit-flow URL fragment (tokens directly) AND the
    /// token_hash query param. Either way the user lands signed in.
    @MainActor
    func handleAuthDeepLink(_ url: URL) async {
        guard url.scheme == "narpulse" else { return }

        // 1. Implicit flow: `narpulse://login-callback#access_token=...&refresh_token=...`
        if let fragment = url.fragment, !fragment.isEmpty {
            let pairs = Self.parseURLEncoded(fragment)
            if let access = pairs["access_token"] {
                let refresh = pairs["refresh_token"]
                if let session = await service.sessionFromImplicitFragment(
                    accessToken: access,
                    refreshToken: refresh
                ) {
                    self.session = session
                    return
                }
            }
            if let errDesc = pairs["error_description"] {
                offlineMessage = errDesc
                return
            }
        }

        // 2. token_hash flow: `narpulse://login-callback?token_hash=...&type=magiclink`
        if let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let items = comps.queryItems {
            if let tokenHash = items.first(where: { $0.name == "token_hash" })?.value {
                do {
                    self.session = try await service.verifyMagicLink(tokenHash: tokenHash)
                    return
                } catch {
                    offlineMessage = error.localizedDescription
                }
            }
            if let errDesc = items.first(where: { $0.name == "error_description" })?.value {
                offlineMessage = errDesc
            }
        }
    }

    private static func parseURLEncoded(_ s: String) -> [String: String] {
        var out: [String: String] = [:]
        for pair in s.split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
            guard kv.count == 2 else { continue }
            let key = kv[0].removingPercentEncoding ?? kv[0]
            let val = kv[1].removingPercentEncoding ?? kv[1]
            out[key] = val
        }
        return out
    }

    @MainActor
    func submitWait(locationId: UUID, minutes: Int) async throws {
        guard let session else { throw AppError.notSignedIn }
        let checkin = try await service.submitWait(session: session, locationId: locationId, minutes: minutes)
        waits.insert(checkin, at: 0)
    }

    @MainActor
    func submitPin(
        lat: Double,
        lng: Double,
        category: SafetyCategory,
        description: String,
        photoData: Data? = nil,
        photoContentType: String? = nil
    ) async throws {
        guard let session else { throw AppError.notSignedIn }
        var photoURL: URL?
        if let data = photoData, let ct = photoContentType {
            photoURL = try await service.uploadSafetyPhoto(
                session: session,
                imageData: data,
                contentType: ct
            )
        }
        let pin = try await service.submitPin(
            session: session,
            lat: lat,
            lng: lng,
            category: category,
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            photoURL: photoURL
        )
        pins.insert(pin, at: 0)
    }

    @MainActor
    func upvotePin(pinId: UUID) async throws {
        guard let session else { throw AppError.notSignedIn }
        try await service.upvotePin(session: session, pinId: pinId)
        if let idx = pins.firstIndex(where: { $0.id == pinId }) {
            pins[idx].upvotes += 1
        }
    }

    @MainActor
    func submitOutage(
        utility: Utility,
        status: OutageStatus,
        areaName: String,
        lat: Double,
        lng: Double,
        radiusM: Int,
        estimatedEnd: Date?,
        description: String
    ) async throws {
        guard let session else { throw AppError.notSignedIn }
        let outage = try await service.submitOutage(
            session: session,
            utility: utility,
            status: status,
            areaName: areaName,
            lat: lat,
            lng: lng,
            radiusM: radiusM,
            estimatedEnd: estimatedEnd,
            description: description.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        outages.insert(outage, at: 0)
    }

    var activeOutages: [Outage] {
        outages.filter { $0.status == .active }
    }

    var plannedOutages: [Outage] {
        outages.filter { $0.status == .planned }
    }

    var queueSummaries: [QueueSummary] {
        locations.map { location in
            let locationWaits = waits.filter { $0.locationId == location.id }
            return QueueSummary(location: location, medianMinutes: Self.median(locationWaits.map(\.waitMinutes)), lastReport: locationWaits.max(by: { $0.reportedAt < $1.reportedAt }))
        }
        .sorted { ($0.medianMinutes ?? -1) > ($1.medianMinutes ?? -1) }
    }

    @MainActor
    func refresh() async {
        isLoading = true
        offlineMessage = nil
        do {
            async let fetchedOutages = service.fetchOutages()
            async let fetchedLocations = service.fetchServiceLocations()
            async let fetchedWaits = service.fetchRecentWaits()
            async let fetchedPins = service.fetchSafetyPins()
            outages = try await fetchedOutages
            locations = try await fetchedLocations
            waits = try await fetchedWaits
            pins = try await fetchedPins
            lastUpdated = Date()
        } catch {
            offlineMessage = "Bağlantı yoxdur - saxlanılan demo məlumatı göstərilir"
        }
        isLoading = false
    }

    private static func median(_ values: [Int]) -> Int? {
        guard !values.isEmpty else { return nil }
        let sorted = values.sorted()
        let middle = sorted.count / 2
        if sorted.count.isMultiple(of: 2) {
            return (sorted[middle - 1] + sorted[middle]) / 2
        }
        return sorted[middle]
    }
}

struct RootView: View {
    @Environment(AppStore.self) private var store
    @State private var selectedTab: AppTab = .home
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false

    var body: some View {
        ZStack {
            Color.npBg.ignoresSafeArea()
            if hasSeenOnboarding {
                TabView(selection: $selectedTab) {
                    HomeView(selectedTab: $selectedTab)
                        .tabItem { Label("Əsas", systemImage: "house.fill") }
                        .tag(AppTab.home)
                    OutagesView()
                        .tabItem { Label("Kəsintilər", systemImage: "drop.fill") }
                        .tag(AppTab.outages)
                    WaitTimesView()
                        .tabItem { Label("Növbələr", systemImage: "clock.fill") }
                        .tag(AppTab.waits)
                    SafetyView()
                        .tabItem { Label("Təhlükəsizlik", systemImage: "exclamationmark.triangle.fill") }
                        .tag(AppTab.safety)
                    AccountView()
                        .tabItem { Label("Hesab", systemImage: "person.crop.circle.fill") }
                        .tag(AppTab.account)
                }
                .tint(.npAccent2)
            } else {
                OnboardingView {
                    hasSeenOnboarding = true
                }
            }
        }
        .overlay(alignment: .top) {
            if let message = store.offlineMessage {
                Text(message)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.npText)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(.npSurface2, in: Capsule())
                    .overlay(Capsule().stroke(.npBorder))
                    .padding(.top, 8)
            }
        }
    }
}

enum AppTab {
    case home
    case outages
    case waits
    case safety
    case account
}

struct HomeView: View {
    @Environment(AppStore.self) private var store
    @Binding var selectedTab: AppTab

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    HeaderBlock(
                        title: "Salam, Nərimanov",
                        subtitle: "Rayonun nəbzi canlı yenilənir",
                        badge: store.isLoading ? "Yenilənir" : "Canlı"
                    )

                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Hazırda")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.npMuted)
                                    .textCase(.uppercase)
                                Text("\(store.activeOutages.count) aktiv kəsinti")
                                    .font(.system(.title2, design: .rounded).weight(.heavy))
                            }
                            Spacer()
                            LiveDot()
                        }
                        MiniDistrictMap(outages: store.activeOutages, pins: Array(store.pins.prefix(5)))
                    }
                    .npCard()

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                        MetricTile(title: "Kəsintilər", value: store.activeOutages.count, icon: "drop.fill", color: .npAccent2) {
                            selectedTab = .outages
                        }
                        MetricTile(title: "Növbələr", value: store.queueSummaries.filter { $0.medianMinutes != nil }.count, icon: "clock.fill", color: .npWarning) {
                            selectedTab = .waits
                        }
                        MetricTile(title: "Pin-lər", value: store.pins.count, icon: "exclamationmark.triangle.fill", color: .npSuccess) {
                            selectedTab = .safety
                        }
                    }

                    SectionHeader(title: "Son hadisələr", actionTitle: "Hamısı") {
                        selectedTab = .outages
                    }

                    VStack(spacing: 10) {
                        ForEach(Array((store.activeOutages + store.plannedOutages).prefix(3))) { outage in
                            OutageCard(outage: outage)
                        }
                    }
                }
                .padding(16)
            }
            .background(Color.npBg)
            .refreshable { await store.refresh() }
        }
    }
}

struct OutagesView: View {
    @Environment(AppStore.self) private var store
    @State private var filter: Utility?
    @State private var selectedOutage: Outage?
    @State private var position = MapCameraPosition.region(MKCoordinateRegion.narimanov)
    @State private var showAddOutage = false
    @State private var currentCenter = MKCoordinateRegion.narimanov.center

    private var visibleOutages: [Outage] {
        (store.activeOutages + store.plannedOutages).filter { outage in
            filter == nil || outage.utility == filter
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Map(position: $position) {
                    ForEach(visibleOutages) { outage in
                        Annotation(outage.areaName, coordinate: outage.coordinate) {
                            OutageMarker(outage: outage)
                                .onTapGesture { selectedOutage = outage }
                        }
                    }
                }
                .mapStyle(.standard(elevation: .realistic))
                .onMapCameraChange { context in
                    currentCenter = context.region.center
                }
                .frame(height: 330)
                .overlay(alignment: .topLeading) {
                    UtilityFilter(selected: $filter)
                        .padding(12)
                }

                List {
                    ForEach(visibleOutages) { outage in
                        Button {
                            selectedOutage = outage
                            position = .region(MKCoordinateRegion(center: outage.coordinate, span: MKCoordinateSpan(latitudeDelta: 0.015, longitudeDelta: 0.015)))
                        } label: {
                            OutageCard(outage: outage)
                        }
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(Color.npBg)
                .refreshable { await store.refresh() }
            }
            .navigationTitle("Kəsintilər")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddOutage = true
                    } label: {
                        Label("Əlavə et", systemImage: "plus.circle.fill")
                            .foregroundStyle(.npAccent2)
                    }
                }
            }
            .sheet(item: $selectedOutage) { outage in
                OutageDetailSheet(outage: outage)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showAddOutage) {
                AddOutageView(coordinate: currentCenter)
                    .presentationDetents([.large])
            }
        }
    }
}

struct WaitTimesView: View {
    @Environment(AppStore.self) private var store
    @State private var selectedSummary: QueueSummary?
    @State private var reportSummary: QueueSummary?
    @State private var reportMinutes = 15

    var body: some View {
        NavigationStack {
            List {
                ForEach(store.queueSummaries) { summary in
                    Button {
                        selectedSummary = summary
                    } label: {
                        QueueCard(summary: summary) {
                            reportSummary = summary
                            reportMinutes = summary.medianMinutes ?? 15
                        }
                    }
                    .buttonStyle(.plain)
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.npBg)
            .refreshable { await store.refresh() }
            .navigationTitle("Növbələr")
            .sheet(item: $selectedSummary) { summary in
                QueueDetailView(summary: summary)
                    .presentationDetents([.medium])
            }
            .sheet(item: $reportSummary) { summary in
                ReportWaitView(summary: summary, minutes: $reportMinutes)
                    .presentationDetents([.medium])
            }
        }
    }
}

struct SafetyView: View {
    @Environment(AppStore.self) private var store
    @State private var selectedPin: SafetyPin?
    @State private var showAddPin = false
    @State private var position = MapCameraPosition.region(MKCoordinateRegion.narimanov)
    @State private var currentCenter = MKCoordinateRegion.narimanov.center

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Map(position: $position) {
                    ForEach(store.pins) { pin in
                        Annotation(pin.category.label, coordinate: pin.coordinate) {
                            SafetyMarker(pin: pin)
                                .onTapGesture { selectedPin = pin }
                        }
                    }
                }
                .mapStyle(.standard(elevation: .realistic))
                .onMapCameraChange { context in
                    currentCenter = context.region.center
                }
                .ignoresSafeArea(edges: .bottom)

                // Crosshair so users know the pin lands at the visible center
                Image(systemName: "plus.viewfinder")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(.npAccent.opacity(0.85))
                    .shadow(color: .black.opacity(0.4), radius: 4, y: 1)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .allowsHitTesting(false)

                Button {
                    showAddPin = true
                } label: {
                    Label("Pin əlavə et", systemImage: "plus")
                        .font(.headline)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 14)
                        .background(Color.npAccent, in: Capsule())
                        .foregroundStyle(.white)
                        .shadow(color: .npAccent.opacity(0.35), radius: 14, y: 8)
                }
                .padding(18)
            }
            .navigationTitle("Təhlükəsizlik")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $selectedPin) { pin in
                SafetyPinDetailView(pin: pin)
                    .presentationDetents([.medium])
            }
            .sheet(isPresented: $showAddPin) {
                AddSafetyPinView(coordinate: currentCenter)
                    .presentationDetents([.large])
            }
        }
    }
}

struct AccountView: View {
    @Environment(AppStore.self) private var store
    @State private var email = ""
    @State private var code = ""
    @State private var awaitingCode = false
    @State private var sending = false
    @State private var verifying = false
    @State private var status: AccountStatus?
    @State private var notificationsEnabled = true

    enum AccountStatus: Equatable {
        case info(String)
        case error(String)
        var text: String {
            switch self {
            case .info(let s), .error(let s): return s
            }
        }
        var isError: Bool {
            if case .error = self { return true }
            return false
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    if let session = store.session {
                        signedInCard(session: session)
                    } else {
                        signInCard
                    }

                    SettingRow(icon: "mappin.and.ellipse", title: "Rayon", value: "Nərimanov")
                    SettingRow(icon: "globe", title: "Dil", value: "AZ / EN")
                    Toggle(isOn: $notificationsEnabled) {
                        Label("Bildirişlər", systemImage: "bell.fill")
                    }
                    .toggleStyle(.switch)
                    .padding(16)
                    .background(Color.npSurface, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.npBorder))
                }
                .padding(16)
            }
            .background(Color.npBg)
            .navigationTitle("Hesab")
        }
    }

    private var signInCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 54))
                .foregroundStyle(.npAccent2)
            Text(awaitingCode ? "Kodu daxil et" : "E-poçt ilə daxil ol")
                .font(.title3.weight(.heavy))
            Text(awaitingCode
                 ? "\(email) ünvanına 6 rəqəmli kod göndərdik."
                 : "Hesabat vermək və pin əlavə etmək üçün e-poçtunuza 6 rəqəmli kod göndərəcəyik.")
                .font(.subheadline)
                .foregroundStyle(.npMuted)
                .multilineTextAlignment(.center)

            if !awaitingCode {
                TextField("siz@example.com", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocorrectionDisabled(true)
                    .padding(12)
                    .background(Color.npSurface2, in: RoundedRectangle(cornerRadius: 12))
                Button {
                    Task { await sendCode() }
                } label: {
                    HStack {
                        if sending { ProgressView().tint(.white) }
                        Text("Kod göndər")
                    }
                }
                .disabled(sending || !isValidEmail(email))
                .buttonStyle(PrimaryButtonStyle())
                Text("E-poçtda 6 rəqəmli kod **və ya** link alacaqsınız. Linki bu cihazdan açsanız avtomatik daxil olacaqsınız.")
                    .font(.caption)
                    .foregroundStyle(.npMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 4)
            } else {
                OTPCodeField(code: $code) {
                    Task { await verify() }
                }
                Button {
                    Task { await verify() }
                } label: {
                    HStack {
                        if verifying { ProgressView().tint(.white) }
                        Text("Təsdiqlə")
                    }
                }
                .disabled(verifying || code.count < 6)
                .buttonStyle(PrimaryButtonStyle())
                Button("E-poçtu dəyiş") {
                    awaitingCode = false
                    code = ""
                    status = nil
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.npMuted)
            }

            if let status {
                Text(status.text)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(status.isError ? .npAccent2 : .npSuccess)
                    .padding(.horizontal, 4)
            }
        }
        .npCard()
    }

    private func signedInCard(session: AuthSession) -> some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.npText)
                    .frame(width: 64, height: 64)
                Text(String(session.email.first ?? "?").uppercased())
                    .font(.system(.title, design: .rounded).weight(.heavy))
                    .foregroundStyle(.npBg)
            }
            Text(session.email)
                .font(.headline)
            Text("Resident")
                .font(.caption.weight(.bold))
                .foregroundStyle(.npMuted)
                .textCase(.uppercase)
            Button(role: .destructive) {
                store.signOut()
                email = ""
                code = ""
                awaitingCode = false
                status = .info("Çıxış edildi")
            } label: {
                Label("Çıxış", systemImage: "rectangle.portrait.and.arrow.right")
            }
            .buttonStyle(SecondaryButtonStyle())
        }
        .npCard()
    }

    private func isValidEmail(_ s: String) -> Bool {
        let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.contains("@") && trimmed.contains(".") && trimmed.count >= 5
    }

    @MainActor
    private func sendCode() async {
        sending = true
        status = nil
        defer { sending = false }
        do {
            try await store.sendOtp(email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
            awaitingCode = true
            status = .info("Kod göndərildi. Poçtunuzu yoxlayın.")
        } catch {
            status = .error(error.localizedDescription)
        }
    }

    @MainActor
    private func verify() async {
        verifying = true
        status = nil
        defer { verifying = false }
        do {
            try await store.verifyOtp(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                token: code.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            awaitingCode = false
            code = ""
        } catch {
            status = .error(error.localizedDescription)
        }
    }
}

/// 6-digit one-time-code input rendered as 6 tiles.
/// An invisible TextField drives the keyboard + system OTP autofill;
/// the tiles are pure presentation that mirror its current value.
struct OTPCodeField: View {
    @Binding var code: String
    let length: Int = 6
    let onComplete: () -> Void

    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            // Hidden source of truth — drives the keyboard + iOS OTP autofill.
            TextField("", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focused)
                .foregroundColor(.clear)
                .accentColor(.clear)
                .tint(.clear)
                .frame(width: 1, height: 1)
                .opacity(0.01)
                .onChange(of: code) { _, new in
                    // Sanitize to digits only, cap at length, auto-submit at length.
                    let digits = String(new.filter(\.isNumber).prefix(length))
                    if digits != new { code = digits }
                    if digits.count == length {
                        focused = false
                        onComplete()
                    }
                }

            HStack(spacing: 10) {
                ForEach(0..<length, id: \.self) { idx in
                    OTPTile(
                        character: characterAt(idx),
                        isActive: idx == code.count && focused,
                        isFilled: idx < code.count
                    )
                    .onTapGesture { focused = true }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .onAppear { focused = true }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Altı rəqəmli kod")
        .accessibilityValue(code)
    }

    private func characterAt(_ i: Int) -> String? {
        guard i < code.count else { return nil }
        let idx = code.index(code.startIndex, offsetBy: i)
        return String(code[idx])
    }
}

private struct OTPTile: View {
    let character: String?
    let isActive: Bool
    let isFilled: Bool

    @State private var blink = false

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.npSurface2)
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(
                    isActive ? Color.npAccent : (isFilled ? Color.npBorder : Color.npBorder.opacity(0.6)),
                    lineWidth: isActive ? 2 : 1
                )
            if let character {
                Text(character)
                    .font(.system(size: 26, weight: .heavy, design: .monospaced))
                    .foregroundStyle(.npText)
            } else if isActive {
                // blinking caret
                Capsule()
                    .fill(Color.npAccent)
                    .frame(width: 2, height: 24)
                    .opacity(blink ? 0 : 1)
                    .onAppear {
                        withAnimation(.easeInOut(duration: 0.55).repeatForever(autoreverses: true)) {
                            blink.toggle()
                        }
                    }
            }
        }
        .frame(width: 48, height: 58)
        .shadow(color: isActive ? Color.npAccent.opacity(0.25) : .clear, radius: 8, y: 2)
        .animation(.easeOut(duration: 0.15), value: isActive)
    }
}

struct OnboardingView: View {
    let finish: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            TabView {
                OnboardingCard(icon: "dot.radiowaves.left.and.right", title: "Kəsintiləri canlı gör", message: "Su, işıq və qaz bildirişləri xəritədə və siyahıda eyni anda yenilənir.")
                OnboardingCard(icon: "clock.badge.checkmark", title: "Növbəni əvvəlcədən bil", message: "Sakin hesabatları ilə ASAN, poçt və poliklinika gözləmə vaxtını gör.")
                OnboardingCard(icon: "exclamationmark.triangle.fill", title: "Təhlükəli nöqtəni bildir", message: "Şəkil, kateqoriya və məkanla RİH komandasına aydın siqnal göndər.")
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

            Button("Başla", action: finish)
                .buttonStyle(PrimaryButtonStyle())
                .padding(16)
        }
        .background(Color.npBg)
    }
}

struct HeaderBlock: View {
    let title: String
    let subtitle: String
    let badge: String

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(.title, design: .rounded).weight(.heavy))
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.npMuted)
            }
            Spacer()
            Text(badge)
                .font(.caption.weight(.bold))
                .foregroundStyle(.npSuccess)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.npSuccess.opacity(0.12), in: Capsule())
        }
    }
}

struct MetricTile: View {
    let title: String
    let value: Int
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Text("\(value)")
                    .font(.system(.title2, design: .rounded).weight(.heavy))
                    .foregroundStyle(.npText)
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.npMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color.npSurface, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.npBorder))
        }
        .buttonStyle(.plain)
    }
}

struct SectionHeader: View {
    let title: String
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        HStack {
            Text(title)
                .font(.headline.weight(.heavy))
            Spacer()
            Button(actionTitle, action: action)
                .font(.caption.weight(.bold))
                .foregroundStyle(.npAccent2)
        }
    }
}

struct MiniDistrictMap: View {
    let outages: [Outage]
    let pins: [SafetyPin]

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 22)
                .fill(Color.npSurface2)
            GridLines()
                .stroke(Color.npBorder.opacity(0.55), lineWidth: 1)
            RoundedRectangle(cornerRadius: 80)
                .stroke(Color.npMuted.opacity(0.22), lineWidth: 1)
                .frame(width: 250, height: 145)
                .rotationEffect(.degrees(-8))
            ForEach(outages) { outage in
                MapPulseDot(coordinate: outage.coordinate, color: outage.status == .planned ? .npWarning : .npAccent2, pulses: outage.status == .active)
            }
            ForEach(pins) { pin in
                MapPulseDot(coordinate: pin.coordinate, color: .npSuccess, pulses: false)
            }
            Text("Nərimanov")
                .font(.caption2.weight(.heavy))
                .foregroundStyle(.npMuted)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.npBg.opacity(0.85), in: Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .padding(12)
        }
        .frame(height: 190)
    }
}

struct GridLines: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        stride(from: rect.minX, through: rect.maxX, by: 34).forEach { x in
            path.move(to: CGPoint(x: x, y: rect.minY))
            path.addLine(to: CGPoint(x: x, y: rect.maxY))
        }
        stride(from: rect.minY, through: rect.maxY, by: 34).forEach { y in
            path.move(to: CGPoint(x: rect.minX, y: y))
            path.addLine(to: CGPoint(x: rect.maxX, y: y))
        }
        return path
    }
}

struct MapPulseDot: View {
    let coordinate: CLLocationCoordinate2D
    let color: Color
    let pulses: Bool

    var body: some View {
        GeometryReader { proxy in
            let point = pointForCoordinate(coordinate, size: proxy.size)
            ZStack {
                if pulses {
                    Circle()
                        .fill(color.opacity(0.45))
                        .frame(width: 26, height: 26)
                        .scaleEffect(1.15)
                        .animation(.easeOut(duration: 1.4).repeatForever(autoreverses: false), value: pulses)
                }
                Circle()
                    .fill(color)
                    .frame(width: 13, height: 13)
                    .overlay(Circle().stroke(.white, lineWidth: 2))
            }
            .position(point)
        }
    }

    private func pointForCoordinate(_ coordinate: CLLocationCoordinate2D, size: CGSize) -> CGPoint {
        let lngRange = 49.842...49.876
        let latRange = 40.397...40.418
        let x = ((coordinate.longitude - lngRange.lowerBound) / (lngRange.upperBound - lngRange.lowerBound)) * size.width
        let y = (1 - ((coordinate.latitude - latRange.lowerBound) / (latRange.upperBound - latRange.lowerBound))) * size.height
        return CGPoint(x: min(max(x, 24), size.width - 24), y: min(max(y, 24), size.height - 24))
    }
}

struct OutageMarker: View {
    let outage: Outage

    var body: some View {
        ZStack {
            if outage.status == .active {
                Circle()
                    .fill(Color.npAccent2.opacity(0.28))
                    .frame(width: 42, height: 42)
            }
            Image(systemName: outage.utility.iconName)
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(outage.status == .planned ? Color.npWarning : Color.npAccent, in: Circle())
                .overlay(Circle().stroke(.white, lineWidth: 2))
        }
    }
}

struct SafetyMarker: View {
    let pin: SafetyPin

    var body: some View {
        Image(systemName: pin.category.iconName)
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
            .frame(width: 31, height: 31)
            .background(Color.npAccent, in: Circle())
            .overlay(Circle().stroke(.white, lineWidth: 2))
    }
}

struct UtilityFilter: View {
    @Binding var selected: Utility?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(title: "Hamısı", icon: "square.grid.2x2.fill", isSelected: selected == nil) { selected = nil }
                ForEach(Utility.allCases) { utility in
                    FilterChip(title: utility.label, icon: utility.iconName, isSelected: selected == utility) { selected = utility }
                }
            }
        }
    }
}

struct FilterChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.bold))
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(isSelected ? Color.npAccent : Color.npSurface.opacity(0.92), in: Capsule())
                .foregroundStyle(isSelected ? .white : Color.npText)
                .overlay(Capsule().stroke(isSelected ? Color.npAccent : Color.npBorder))
        }
        .buttonStyle(.plain)
    }
}

struct OutageCard: View {
    let outage: Outage

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: outage.utility.iconName)
                .foregroundStyle(outage.utility.color)
                .frame(width: 40, height: 40)
                .background(outage.utility.color.opacity(0.14), in: RoundedRectangle(cornerRadius: 13))
            VStack(alignment: .leading, spacing: 6) {
                Text(outage.areaName)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.npText)
                HStack(spacing: 8) {
                    StatusBadge(status: outage.status)
                    Text(outage.startedAt, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.npMuted)
                }
                if let estimatedEnd = outage.estimatedEnd, outage.status != .resolved {
                    Text("Təxmini bitmə: \(estimatedEnd.formatted(date: .omitted, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(.npMuted)
                }
            }
            Spacer()
        }
        .padding(14)
        .background(Color.npSurface, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.npBorder))
    }
}

struct StatusBadge: View {
    let status: OutageStatus

    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.heavy))
            .textCase(.uppercase)
            .foregroundStyle(status.color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(status.color.opacity(0.14), in: Capsule())
    }
}

struct QueueCard: View {
    let summary: QueueSummary
    let report: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: summary.location.kind.iconName)
                .foregroundStyle(.npWarning)
                .frame(width: 40, height: 40)
                .background(Color.npWarning.opacity(0.14), in: RoundedRectangle(cornerRadius: 13))
            VStack(alignment: .leading, spacing: 6) {
                Text(summary.location.name)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.npText)
                Text(summary.location.address ?? summary.location.kind.label)
                    .font(.caption)
                    .foregroundStyle(.npMuted)
                    .lineLimit(1)
                if let lastReport = summary.lastReport {
                    Text("Son hesabat: \(lastReport.reportedAt, style: .relative)")
                        .font(.caption2)
                        .foregroundStyle(.npMuted)
                }
            }
            Spacer()
            VStack(spacing: 8) {
                Text(summary.medianMinutes.map { "\($0)" } ?? "-")
                    .font(.system(.title3, design: .rounded).weight(.heavy))
                    .foregroundStyle(summary.waitColor)
                Button("Hesabat") { report() }
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.npAccent2)
            }
        }
        .padding(14)
        .background(Color.npSurface, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.npBorder))
    }
}

struct QueueDetailView: View {
    let summary: QueueSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Capsule().fill(Color.npBorder).frame(width: 44, height: 5).frame(maxWidth: .infinity)
            Text(summary.location.name)
                .font(.title2.weight(.heavy))
            Text(summary.location.address ?? summary.location.kind.label)
                .foregroundStyle(.npMuted)
            HStack {
                StatPill(title: "Median", value: summary.medianMinutes.map { "\($0) dəq" } ?? "-", color: summary.waitColor)
                StatPill(title: "Tip", value: summary.location.kind.label, color: .npWarning)
            }
            Spacer()
        }
        .padding(20)
        .background(Color.npBg)
    }
}

struct ReportWaitView: View {
    let summary: QueueSummary
    @Binding var minutes: Int
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var submitting = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Capsule().fill(Color.npBorder).frame(width: 44, height: 5).frame(maxWidth: .infinity)
            Text("Gözləmə müddətini bildir")
                .font(.title3.weight(.heavy))
            Text(summary.location.name)
                .foregroundStyle(.npMuted)
            Text("\(minutes) dəq")
                .font(.system(size: 54, weight: .heavy, design: .rounded))
                .frame(maxWidth: .infinity)
            Slider(value: Binding(get: { Double(minutes) }, set: { minutes = Int($0) }), in: 0...120, step: 5)
                .tint(.npAccent2)

            if store.session == nil {
                Text("Hesabat vermək üçün Hesab tabından daxil olun.")
                    .font(.footnote)
                    .foregroundStyle(.npMuted)
                    .padding(12)
                    .frame(maxWidth: .infinity)
                    .background(Color.npSurface2, in: RoundedRectangle(cornerRadius: 12))
            }
            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.npAccent2)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.npAccent.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
            }

            Button {
                Task { await submit() }
            } label: {
                HStack {
                    if submitting { ProgressView().tint(.white) }
                    Text("Göndər")
                }
            }
            .disabled(submitting || store.session == nil)
            .buttonStyle(PrimaryButtonStyle())
            Spacer()
        }
        .padding(20)
        .background(Color.npBg)
    }

    @MainActor
    private func submit() async {
        errorMessage = nil
        submitting = true
        defer { submitting = false }
        do {
            try await store.submitWait(locationId: summary.location.id, minutes: minutes)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dismiss()
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = error.localizedDescription
        }
    }
}

struct OutageDetailSheet: View {
    let outage: Outage

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Capsule().fill(Color.npBorder).frame(width: 44, height: 5).frame(maxWidth: .infinity)
            HStack {
                Image(systemName: outage.utility.iconName)
                    .foregroundStyle(outage.utility.color)
                    .frame(width: 44, height: 44)
                    .background(outage.utility.color.opacity(0.14), in: RoundedRectangle(cornerRadius: 14))
                VStack(alignment: .leading) {
                    Text(outage.utility.label)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(outage.utility.color)
                    Text(outage.areaName)
                        .font(.title3.weight(.heavy))
                }
            }
            StatusBadge(status: outage.status)
            Text(outage.description ?? "Əlavə məlumat yoxdur.")
                .foregroundStyle(.npText)
            if let estimatedEnd = outage.estimatedEnd {
                StatPill(title: "Təxmini bitmə", value: estimatedEnd.formatted(date: .omitted, time: .shortened), color: .npWarning)
            }
            Button("Hesabat səhvdir") {}
                .buttonStyle(SecondaryButtonStyle())
            Spacer()
        }
        .padding(20)
        .background(Color.npBg)
    }
}

struct SafetyPinDetailView: View {
    let pin: SafetyPin
    @Environment(AppStore.self) private var store
    @State private var voted = false
    @State private var votes: Int
    @State private var submitting = false
    @State private var errorMessage: String?

    init(pin: SafetyPin) {
        self.pin = pin
        _votes = State(initialValue: pin.upvotes)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Capsule().fill(Color.npBorder).frame(width: 44, height: 5).frame(maxWidth: .infinity)
            HStack {
                Image(systemName: pin.category.iconName)
                    .foregroundStyle(.npAccent2)
                    .frame(width: 44, height: 44)
                    .background(Color.npAccent.opacity(0.14), in: RoundedRectangle(cornerRadius: 14))
                VStack(alignment: .leading) {
                    Text(pin.category.label)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.npAccent2)
                    Text(pin.status.label)
                        .font(.title3.weight(.heavy))
                }
                Spacer()
                Text("\(votes)")
                    .font(.title2.weight(.heavy))
                    .foregroundStyle(.npText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.npSurface2, in: Capsule())
            }
            if let photoURL = pin.photoURL {
                AsyncImage(url: photoURL) { phase in
                    switch phase {
                    case .empty:
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color.npSurface2)
                            .frame(height: 180)
                            .overlay(ProgressView())
                    case .success(let image):
                        image.resizable().scaledToFill()
                            .frame(maxWidth: .infinity, maxHeight: 200)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    case .failure:
                        EmptyView()
                    @unknown default:
                        EmptyView()
                    }
                }
            }
            Text(pin.description ?? "Təsvir yoxdur.")
                .foregroundStyle(.npText)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.npAccent2)
            }

            Button {
                Task { await upvote() }
            } label: {
                HStack {
                    if submitting { ProgressView().tint(.white) }
                    Label(voted ? "Səs verdiniz" : "Mən də gördüm", systemImage: "hand.thumbsup.fill")
                }
            }
            .disabled(voted || submitting || store.session == nil)
            .buttonStyle(PrimaryButtonStyle())

            if store.session == nil {
                Text("Səs vermək üçün Hesab tabından daxil olun.")
                    .font(.footnote)
                    .foregroundStyle(.npMuted)
            }
            Spacer()
        }
        .padding(20)
        .background(Color.npBg)
    }

    @MainActor
    private func upvote() async {
        errorMessage = nil
        submitting = true
        defer { submitting = false }
        do {
            try await store.upvotePin(pinId: pin.id)
            voted = true
            votes += 1
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = error.localizedDescription
        }
    }
}

struct AddSafetyPinView: View {
    let coordinate: CLLocationCoordinate2D
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var category: SafetyCategory = .crossing
    @State private var description = ""
    @State private var submitting = false
    @State private var errorMessage: String?
    @State private var photoItem: PhotosPickerItem?
    @State private var photoData: Data?
    @State private var photoContentType: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Kateqoriya", selection: $category) {
                        ForEach(SafetyCategory.allCases) { category in
                            Label(category.label, systemImage: category.iconName).tag(category)
                        }
                    }
                    TextField("Nə təhlükəlidir?", text: $description, axis: .vertical)
                        .lineLimit(4, reservesSpace: true)
                } header: {
                    Text("Məlumat")
                } footer: {
                    Text("Yer: \(String(format: "%.4f", coordinate.latitude)), \(String(format: "%.4f", coordinate.longitude))")
                        .foregroundStyle(.npMuted)
                }

                Section("Şəkil (istəyə bağlı)") {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        if let photoData, let uiImage = UIImage(data: photoData) {
                            HStack(spacing: 12) {
                                Image(uiImage: uiImage)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 72, height: 72)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Şəkil seçildi")
                                        .font(.subheadline.weight(.semibold))
                                    Text("\(photoData.count / 1024) KB · dəyişdirmək üçün toxun")
                                        .font(.caption)
                                        .foregroundStyle(.npMuted)
                                }
                                Spacer()
                            }
                        } else {
                            Label("Foto əlavə et", systemImage: "photo.on.rectangle.angled")
                        }
                    }
                    if photoData != nil {
                        Button(role: .destructive) {
                            photoData = nil
                            photoItem = nil
                            photoContentType = nil
                        } label: {
                            Label("Şəkli sil", systemImage: "trash")
                        }
                    }
                }

                if store.session == nil {
                    Section {
                        Text("Pin əlavə etmək üçün Hesab tabından daxil olun.")
                            .font(.footnote)
                            .foregroundStyle(.npMuted)
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.npAccent2)
                    }
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            if submitting { ProgressView() }
                            Label("Pin əlavə et", systemImage: "paperplane.fill")
                        }
                    }
                    .disabled(submitting || store.session == nil)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.npBg)
            .navigationTitle("Yeni pin")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Ləğv et") { dismiss() }
                }
            }
            .onChange(of: photoItem) { _, newValue in
                guard let newValue else { return }
                Task { await loadPhoto(newValue) }
            }
        }
    }

    @MainActor
    private func loadPhoto(_ item: PhotosPickerItem) async {
        if let data = try? await item.loadTransferable(type: Data.self) {
            // Try to detect content type from the supported types; fall back to jpeg.
            let ct = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
            photoData = data
            photoContentType = ct
        }
    }

    @MainActor
    private func submit() async {
        errorMessage = nil
        submitting = true
        defer { submitting = false }
        do {
            try await store.submitPin(
                lat: coordinate.latitude,
                lng: coordinate.longitude,
                category: category,
                description: description,
                photoData: photoData,
                photoContentType: photoContentType
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dismiss()
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = error.localizedDescription
        }
    }
}

struct AddOutageView: View {
    let coordinate: CLLocationCoordinate2D
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store
    @State private var utility: Utility = .water
    @State private var status: OutageStatus = .active
    @State private var areaName: String = ""
    @State private var radiusMeters: Double = 350
    @State private var hasEta: Bool = true
    @State private var estimatedEnd: Date = Date().addingTimeInterval(60 * 60 * 2)
    @State private var description: String = ""
    @State private var submitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Növ") {
                    Picker("Növ", selection: $utility) {
                        ForEach(Utility.allCases) { u in
                            Label(u.label, systemImage: u.iconName).tag(u)
                        }
                    }
                    .pickerStyle(.segmented)
                    Picker("Status", selection: $status) {
                        Text("Aktiv").tag(OutageStatus.active)
                        Text("Planlı").tag(OutageStatus.planned)
                    }
                    .pickerStyle(.segmented)
                }
                Section("Yer") {
                    TextField("Ərazi (məs: 8 Noyabr küç., 12-24)", text: $areaName)
                    HStack {
                        Text("Radius")
                        Spacer()
                        Text("\(Int(radiusMeters)) m")
                            .foregroundStyle(.npMuted)
                            .font(.system(.body, design: .monospaced))
                    }
                    Slider(value: $radiusMeters, in: 100...1500, step: 50)
                        .tint(.npAccent2)
                    Text("Koordinat: \(String(format: "%.4f", coordinate.latitude)), \(String(format: "%.4f", coordinate.longitude))")
                        .font(.footnote)
                        .foregroundStyle(.npMuted)
                }
                Section("Vaxt") {
                    Toggle("Təxmini bitmə var", isOn: $hasEta)
                    if hasEta {
                        DatePicker("Bitmə", selection: $estimatedEnd, in: Date()...)
                    }
                }
                Section("Təsvir") {
                    TextField("Nə baş verir?", text: $description, axis: .vertical)
                        .lineLimit(4, reservesSpace: true)
                }
                if store.session == nil {
                    Section {
                        Text("Daxil olmaq tələb olunur. Yalnız RİH admin hesabı kəsinti əlavə edə bilər (RLS qaydaları).")
                            .font(.footnote)
                            .foregroundStyle(.npMuted)
                    }
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.npAccent2)
                    }
                }
                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            if submitting { ProgressView() }
                            Label("Kəsinti əlavə et", systemImage: "paperplane.fill")
                        }
                    }
                    .disabled(submitting || store.session == nil || areaName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.npBg)
            .navigationTitle("Yeni kəsinti")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Ləğv et") { dismiss() }
                }
            }
        }
    }

    @MainActor
    private func submit() async {
        errorMessage = nil
        submitting = true
        defer { submitting = false }
        do {
            try await store.submitOutage(
                utility: utility,
                status: status,
                areaName: areaName.trimmingCharacters(in: .whitespacesAndNewlines),
                lat: coordinate.latitude,
                lng: coordinate.longitude,
                radiusM: Int(radiusMeters),
                estimatedEnd: hasEta ? estimatedEnd : nil,
                description: description
            )
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            dismiss()
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = error.localizedDescription
        }
    }
}

struct OnboardingCard: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: icon)
                .font(.system(size: 54))
                .foregroundStyle(.npAccent2)
                .frame(width: 104, height: 104)
                .background(Color.npSurface, in: RoundedRectangle(cornerRadius: 28))
                .overlay(RoundedRectangle(cornerRadius: 28).stroke(Color.npBorder))
            Text(title)
                .font(.system(.title, design: .rounded).weight(.heavy))
                .multilineTextAlignment(.center)
            Text(message)
                .font(.body)
                .foregroundStyle(.npMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Spacer()
        }
        .padding(20)
    }
}

struct SettingRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack {
            Label(title, systemImage: icon)
            Spacer()
            Text(value)
                .foregroundStyle(.npMuted)
        }
        .padding(16)
        .background(Color.npSurface, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.npBorder))
    }
}

struct StatPill: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(.npMuted)
            Text(value)
                .font(.headline.weight(.heavy))
                .foregroundStyle(color)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.npSurface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.npBorder))
    }
}

struct LiveDot: View {
    var body: some View {
        ZStack {
            Circle().fill(Color.npAccent2.opacity(0.3)).frame(width: 24, height: 24)
            Circle().fill(Color.npAccent2).frame(width: 10, height: 10)
        }
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(Color.npAccent, in: RoundedRectangle(cornerRadius: 14))
            .foregroundStyle(.white)
            .opacity(configuration.isPressed ? 0.82 : 1)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(Color.npSurface2, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.npBorder))
            .foregroundStyle(.npText)
            .opacity(configuration.isPressed ? 0.82 : 1)
    }
}

extension View {
    func npCard() -> some View {
        padding(16)
            .background(Color.npSurface, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.npBorder))
    }
}

extension Color {
    static let npBg = Color(red: 0.039, green: 0.055, blue: 0.102)
    static let npSurface = Color(red: 0.067, green: 0.090, blue: 0.165)
    static let npSurface2 = Color(red: 0.102, green: 0.129, blue: 0.220)
    static let npBorder = Color(red: 0.145, green: 0.176, blue: 0.271)
    static let npText = Color(red: 0.961, green: 0.961, blue: 0.941)
    static let npMuted = Color(red: 0.545, green: 0.576, blue: 0.659)
    static let npAccent = Color(red: 0.784, green: 0.063, blue: 0.180)
    static let npAccent2 = Color(red: 0.902, green: 0.224, blue: 0.314)
    static let npSuccess = Color(red: 0.247, green: 0.714, blue: 0.545)
    static let npWarning = Color(red: 0.949, green: 0.706, blue: 0.255)
}

// Enables the `.npText` etc. shorthand inside `foregroundStyle(_:)`, `fill(_:)`
// and any other ShapeStyle-typed parameter.
extension ShapeStyle where Self == Color {
    static var npBg: Color { .npBg }
    static var npSurface: Color { .npSurface }
    static var npSurface2: Color { .npSurface2 }
    static var npBorder: Color { .npBorder }
    static var npText: Color { .npText }
    static var npMuted: Color { .npMuted }
    static var npAccent: Color { .npAccent }
    static var npAccent2: Color { .npAccent2 }
    static var npSuccess: Color { .npSuccess }
    static var npWarning: Color { .npWarning }
}

extension MKCoordinateRegion {
    static let narimanov = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 40.4073, longitude: 49.8612),
        span: MKCoordinateSpan(latitudeDelta: 0.035, longitudeDelta: 0.045)
    )
}

struct QueueSummary: Identifiable {
    var id: UUID { location.id }
    let location: ServiceLocation
    let medianMinutes: Int?
    let lastReport: WaitCheckin?

    var waitColor: Color {
        guard let medianMinutes else { return .npMuted }
        if medianMinutes >= 25 { return .npAccent2 }
        if medianMinutes >= 12 { return .npWarning }
        return .npSuccess
    }
}

struct Outage: Identifiable, Codable, Hashable {
    let id: UUID
    let utility: Utility
    let status: OutageStatus
    let areaName: String
    let centerLat: Double
    let centerLng: Double
    let radiusM: Int
    let startedAt: Date
    let estimatedEnd: Date?
    let resolvedAt: Date?
    let source: String?
    let sourceURL: URL?
    let description: String?
    let createdAt: Date

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: centerLat, longitude: centerLng)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case utility
        case status
        case areaName = "area_name"
        case centerLat = "center_lat"
        case centerLng = "center_lng"
        case radiusM = "radius_m"
        case startedAt = "started_at"
        case estimatedEnd = "estimated_end"
        case resolvedAt = "resolved_at"
        case source
        case sourceURL = "source_url"
        case description
        case createdAt = "created_at"
    }
}

enum Utility: String, Codable, CaseIterable, Identifiable, Hashable {
    case water
    case electricity
    case gas

    var id: String { rawValue }

    var label: String {
        switch self {
        case .water: "Su"
        case .electricity: "İşıq"
        case .gas: "Qaz"
        }
    }

    var iconName: String {
        switch self {
        case .water: "drop.fill"
        case .electricity: "bolt.fill"
        case .gas: "flame.fill"
        }
    }

    var color: Color {
        switch self {
        case .water: .blue
        case .electricity: .npWarning
        case .gas: .npAccent2
        }
    }
}

enum OutageStatus: String, Codable, Hashable {
    case planned
    case active
    case resolved

    var label: String {
        switch self {
        case .planned: "Planlı"
        case .active: "Aktiv"
        case .resolved: "Həll edildi"
        }
    }

    var color: Color {
        switch self {
        case .planned: .npWarning
        case .active: .npAccent2
        case .resolved: .npSuccess
        }
    }
}

struct ServiceLocation: Identifiable, Codable, Hashable {
    let id: UUID
    let name: String
    let kind: ServiceKind
    let lat: Double
    let lng: Double
    let address: String?
    let opensAt: String?
    let closesAt: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case kind
        case lat
        case lng
        case address
        case opensAt = "opens_at"
        case closesAt = "closes_at"
    }
}

enum ServiceKind: String, Codable, Hashable {
    case asan
    case poliklinika
    case post
    case rih
    case bank

    var label: String {
        switch self {
        case .asan: "ASAN Xidmət"
        case .poliklinika: "Poliklinika"
        case .post: "Poçt"
        case .rih: "RİH"
        case .bank: "Bank"
        }
    }

    var iconName: String {
        switch self {
        case .asan: "building.2.fill"
        case .poliklinika: "cross.case.fill"
        case .post: "envelope.fill"
        case .rih: "building.columns.fill"
        case .bank: "creditcard.fill"
        }
    }
}

struct WaitCheckin: Identifiable, Codable, Hashable {
    let id: UUID
    let locationId: UUID
    let userId: UUID?
    let waitMinutes: Int
    let reportedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case locationId = "location_id"
        case userId = "user_id"
        case waitMinutes = "wait_minutes"
        case reportedAt = "reported_at"
    }
}

struct SafetyPin: Identifiable, Codable, Hashable {
    let id: UUID
    let userId: UUID?
    let lat: Double
    let lng: Double
    let category: SafetyCategory
    let description: String?
    let photoURL: URL?
    var upvotes: Int
    let status: SafetyStatus
    let createdAt: Date

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case lat
        case lng
        case category
        case description
        case photoURL = "photo_url"
        case upvotes
        case status
        case createdAt = "created_at"
    }
}

enum SafetyCategory: String, Codable, CaseIterable, Identifiable, Hashable {
    case crossing
    case lighting
    case traffic
    case sidewalk
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .crossing: "Piyada keçidi"
        case .lighting: "İşıqlandırma"
        case .traffic: "Nəqliyyat"
        case .sidewalk: "Səki"
        case .other: "Digər"
        }
    }

    var iconName: String {
        switch self {
        case .crossing: "figure.walk"
        case .lighting: "lightbulb.fill"
        case .traffic: "car.fill"
        case .sidewalk: "map.fill"
        case .other: "exclamationmark.triangle.fill"
        }
    }
}

enum SafetyStatus: String, Codable, Hashable {
    case pending
    case reviewed
    case resolved

    var label: String {
        switch self {
        case .pending: "Gözləyir"
        case .reviewed: "Baxılıb"
        case .resolved: "Həll edildi"
        }
    }
}

actor NarPulseService {
    private let baseURL: URL?
    private let anonKey: String
    private let decoder: JSONDecoder

    init() {
        let info = Bundle.main.infoDictionary ?? [:]
        let urlString = (info["SUPABASE_URL"] as? String) ?? ""
        self.baseURL = URL(string: urlString)
        self.anonKey = (info["SUPABASE_ANON_KEY"] as? String) ?? ""
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let rawValue = try container.decode(String.self)
            if let date = ISO8601DateFormatter.withFractionalSeconds.date(from: rawValue) ?? ISO8601DateFormatter.standard.date(from: rawValue) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date")
        }
        self.decoder = decoder
    }

    func fetchOutages() async throws -> [Outage] {
        try await fetch("outages", query: "select=*&order=started_at.desc", fallback: MockData.outages)
    }

    func fetchServiceLocations() async throws -> [ServiceLocation] {
        try await fetch("service_locations", query: "select=*&order=name.asc", fallback: MockData.locations)
    }

    func fetchRecentWaits() async throws -> [WaitCheckin] {
        let since = ISO8601DateFormatter.standard.string(from: Date().addingTimeInterval(-3600))
        return try await fetch("wait_checkins", query: "select=*&reported_at=gte.\(since)&order=reported_at.desc", fallback: MockData.waits)
    }

    func fetchSafetyPins() async throws -> [SafetyPin] {
        try await fetch("safety_pins", query: "select=*&order=upvotes.desc", fallback: MockData.pins)
    }

    private func fetch<T: Decodable>(_ table: String, query: String, fallback: [T]) async throws -> [T] {
        guard let baseURL, !anonKey.isEmpty else { return fallback }
        let urlString = "\(baseURL.absoluteString)/rest/v1/\(table)?\(query)"
        guard let url = URL(string: urlString) else { return fallback }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return fallback
        }
        return try decoder.decode([T].self, from: data)
    }

    // MARK: - Auth

    static let magicLinkRedirect = "narpulse://login-callback"

    func sendOtp(email: String) async throws {
        guard let baseURL, !anonKey.isEmpty else { throw AppError.notConfigured }
        let url = baseURL.appendingPathComponent("auth/v1/otp")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // email_redirect_to makes the magic link in the email open the iOS app
        // via the narpulse:// URL scheme. Works alongside the 6-digit code:
        // user can either type the code OR tap the link from their phone's
        // mail client — both end up signed in.
        let body: [String: Any] = [
            "email": email,
            "create_user": true,
            "email_redirect_to": Self.magicLinkRedirect
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AppError.server(Self.errorMessage(from: data, fallback: "Kod göndərilmədi"))
        }
    }

    /// Magic-link click flow (token_hash from the URL Supabase redirects to).
    func verifyMagicLink(tokenHash: String) async throws -> AuthSession {
        guard let baseURL, !anonKey.isEmpty else { throw AppError.notConfigured }
        let url = baseURL.appendingPathComponent("auth/v1/verify")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["token_hash": tokenHash, "type": "magiclink"]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AppError.server(Self.errorMessage(from: data, fallback: "Link etibarsızdır"))
        }
        struct VerifyResponse: Decodable {
            let access_token: String
            let refresh_token: String?
            let user: VerifyUser
        }
        struct VerifyUser: Decodable {
            let id: String
            let email: String?
        }
        let decoded = try JSONDecoder().decode(VerifyResponse.self, from: data)
        return AuthSession(
            accessToken: decoded.access_token,
            refreshToken: decoded.refresh_token,
            userId: decoded.user.id,
            email: decoded.user.email ?? ""
        )
    }

    /// Implicit-flow (tokens already present in URL hash) — JWT-decode the
    /// access token to recover userId + email instead of round-tripping.
    func sessionFromImplicitFragment(accessToken: String, refreshToken: String?) -> AuthSession? {
        let parts = accessToken.split(separator: ".")
        guard parts.count >= 2,
              let payloadData = Self.base64URLDecode(String(parts[1])),
              let json = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any]
        else { return nil }
        let userId = (json["sub"] as? String) ?? ""
        let email = (json["email"] as? String) ?? ""
        guard !userId.isEmpty else { return nil }
        return AuthSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            userId: userId,
            email: email
        )
    }

    private static func base64URLDecode(_ s: String) -> Data? {
        var str = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        // pad to a multiple of 4
        let padding = (4 - str.count % 4) % 4
        str += String(repeating: "=", count: padding)
        return Data(base64Encoded: str)
    }

    func verifyOtp(email: String, token: String) async throws -> AuthSession {
        guard let baseURL, !anonKey.isEmpty else { throw AppError.notConfigured }
        let url = baseURL.appendingPathComponent("auth/v1/verify")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["email": email, "token": token, "type": "email"]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AppError.server(Self.errorMessage(from: data, fallback: "Kod yanlışdır"))
        }
        struct VerifyResponse: Decodable {
            let access_token: String
            let refresh_token: String?
            let user: VerifyUser
        }
        struct VerifyUser: Decodable {
            let id: String
            let email: String?
        }
        let decoded = try JSONDecoder().decode(VerifyResponse.self, from: data)
        return AuthSession(
            accessToken: decoded.access_token,
            refreshToken: decoded.refresh_token,
            userId: decoded.user.id,
            email: decoded.user.email ?? email
        )
    }

    // MARK: - Writes

    func submitWait(session: AuthSession, locationId: UUID, minutes: Int) async throws -> WaitCheckin {
        guard let baseURL, !anonKey.isEmpty else { throw AppError.notConfigured }
        let url = baseURL.appendingPathComponent("rest/v1/wait_checkins")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=representation", forHTTPHeaderField: "Prefer")
        let body: [String: Any] = [
            "location_id": locationId.uuidString.lowercased(),
            "wait_minutes": minutes,
            "user_id": session.userId
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AppError.server(Self.errorMessage(from: data, fallback: "Hesabat saxlanmadı"))
        }
        let arr = try decoder.decode([WaitCheckin].self, from: data)
        guard let first = arr.first else { throw AppError.server("Boş cavab") }
        return first
    }

    func upvotePin(session: AuthSession, pinId: UUID) async throws {
        guard let baseURL, !anonKey.isEmpty else { throw AppError.notConfigured }
        let url = baseURL.appendingPathComponent("rest/v1/pin_votes")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Don't return rows — server-side trigger handles incrementing upvotes.
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        let body: [String: Any] = [
            "pin_id": pinId.uuidString.lowercased(),
            "user_id": session.userId
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let msg = Self.errorMessage(from: data, fallback: "Səs verilmədi")
            // Duplicate primary key (pin_id, user_id) = already voted.
            if msg.localizedCaseInsensitiveContains("duplicate") ||
               msg.localizedCaseInsensitiveContains("23505") {
                throw AppError.server("Artıq səs vermisiniz.")
            }
            throw AppError.server(msg)
        }
    }

    func uploadSafetyPhoto(session: AuthSession, imageData: Data, contentType: String) async throws -> URL {
        guard let baseURL, !anonKey.isEmpty else { throw AppError.notConfigured }
        let filename = "\(UUID().uuidString.lowercased()).\(contentType.split(separator: "/").last ?? "jpg")"
        let path = "\(session.userId)/\(filename)"
        let url = baseURL.appendingPathComponent("storage/v1/object/safety-photos/\(path)")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        req.setValue("3600", forHTTPHeaderField: "Cache-Control")
        req.httpBody = imageData
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AppError.server(Self.errorMessage(from: data, fallback: "Şəkil yüklənmədi"))
        }
        // Bucket is public, return a stable public URL.
        let publicURL = baseURL
            .appendingPathComponent("storage/v1/object/public/safety-photos/\(path)")
        return publicURL
    }

    func submitOutage(
        session: AuthSession,
        utility: Utility,
        status: OutageStatus,
        areaName: String,
        lat: Double,
        lng: Double,
        radiusM: Int,
        estimatedEnd: Date?,
        description: String
    ) async throws -> Outage {
        guard let baseURL, !anonKey.isEmpty else { throw AppError.notConfigured }
        let url = baseURL.appendingPathComponent("rest/v1/outages")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=representation", forHTTPHeaderField: "Prefer")
        var body: [String: Any] = [
            "utility": utility.rawValue,
            "status": status.rawValue,
            "area_name": areaName,
            "center_lat": lat,
            "center_lng": lng,
            "radius_m": radiusM,
            "source": "manual"
        ]
        if let estimatedEnd {
            body["estimated_end"] = ISO8601DateFormatter.standard.string(from: estimatedEnd)
        }
        if !description.isEmpty {
            body["description"] = description
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let raw = Self.errorMessage(from: data, fallback: "Kəsinti saxlanmadı")
            // RLS rejects non-admins with a row-level violation. Map to a friendly hint.
            if raw.localizedCaseInsensitiveContains("row-level") ||
               raw.localizedCaseInsensitiveContains("policy") ||
               raw.localizedCaseInsensitiveContains("403") {
                throw AppError.server("Yalnız RİH admin hesabı kəsinti əlavə edə bilər.")
            }
            throw AppError.server(raw)
        }
        let arr = try decoder.decode([Outage].self, from: data)
        guard let first = arr.first else { throw AppError.server("Boş cavab") }
        return first
    }

    func submitPin(
        session: AuthSession,
        lat: Double,
        lng: Double,
        category: SafetyCategory,
        description: String,
        photoURL: URL?
    ) async throws -> SafetyPin {
        guard let baseURL, !anonKey.isEmpty else { throw AppError.notConfigured }
        let url = baseURL.appendingPathComponent("rest/v1/safety_pins")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=representation", forHTTPHeaderField: "Prefer")
        var body: [String: Any] = [
            "lat": lat,
            "lng": lng,
            "category": category.rawValue,
            "user_id": session.userId
        ]
        if !description.isEmpty {
            body["description"] = description
        }
        if let photoURL {
            body["photo_url"] = photoURL.absoluteString
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AppError.server(Self.errorMessage(from: data, fallback: "Pin saxlanmadı"))
        }
        let arr = try decoder.decode([SafetyPin].self, from: data)
        guard let first = arr.first else { throw AppError.server("Boş cavab") }
        return first
    }

    private static func errorMessage(from data: Data, fallback: String) -> String {
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let msg = obj["msg"] as? String { return msg }
            if let msg = obj["message"] as? String { return msg }
            if let err = obj["error_description"] as? String { return err }
            if let err = obj["error"] as? String { return err }
        }
        if let text = String(data: data, encoding: .utf8), !text.isEmpty {
            return text.prefix(160).description
        }
        return fallback
    }
}

extension ISO8601DateFormatter {
    static let standard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

enum MockData {
    static let outages: [Outage] = [
        Outage(id: UUID(), utility: .water, status: .active, areaName: "8 Noyabr küç., 12-24 evlər", centerLat: 40.4101, centerLng: 49.8612, radiusM: 350, startedAt: .now.addingTimeInterval(-5100), estimatedEnd: .now.addingTimeInterval(7200), resolvedAt: nil, source: "azersu", sourceURL: nil, description: "Magistral xəttdə qəza təmiri. Su təchizatı müvəqqəti dayandırılıb.", createdAt: .now.addingTimeInterval(-5100)),
        Outage(id: UUID(), utility: .electricity, status: .active, areaName: "Ziya Bünyadov pr., metro yaxınlığı", centerLat: 40.4053, centerLng: 49.8587, radiusM: 420, startedAt: .now.addingTimeInterval(-2280), estimatedEnd: .now.addingTimeInterval(4680), resolvedAt: nil, source: "azerisiq", sourceURL: nil, description: "Transformator yarımstansiyasında qəza. Briqada yerdədir.", createdAt: .now.addingTimeInterval(-2280)),
        Outage(id: UUID(), utility: .gas, status: .active, areaName: "Ağa Nemətulla küç., 18 saylı bina", centerLat: 40.4012, centerLng: 49.8551, radiusM: 220, startedAt: .now.addingTimeInterval(-720), estimatedEnd: .now.addingTimeInterval(10800), resolvedAt: nil, source: "socar", sourceURL: nil, description: "Qaz sızıntısı barəsində bildirim. Sahə blokiranır.", createdAt: .now.addingTimeInterval(-720)),
        Outage(id: UUID(), utility: .water, status: .planned, areaName: "Tələbə qəsəbəsi, 3-cü mikrorayon", centerLat: 40.4163, centerLng: 49.8688, radiusM: 600, startedAt: .now.addingTimeInterval(50400), estimatedEnd: .now.addingTimeInterval(72000), resolvedAt: nil, source: "azersu", sourceURL: nil, description: "Planlı texniki iş. Sabah 08:00-14:00 arası su olmayacaq.", createdAt: .now.addingTimeInterval(-10800))
    ]

    static let locations: [ServiceLocation] = [
        ServiceLocation(id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!, name: "ASAN Xidmət Mərkəzi No 1", kind: .asan, lat: 40.4087, lng: 49.8554, address: "Nərimanov, Atatürk pr. 90", opensAt: "09:00", closesAt: "20:00"),
        ServiceLocation(id: UUID(uuidString: "00000000-0000-0000-0000-000000000002")!, name: "Nərimanov Rayon İcra Hakimiyyəti", kind: .rih, lat: 40.4068, lng: 49.8612, address: "Ağa Nemətulla 4", opensAt: "09:00", closesAt: "18:00"),
        ServiceLocation(id: UUID(uuidString: "00000000-0000-0000-0000-000000000003")!, name: "1 saylı Şəhər Poliklinikası", kind: .poliklinika, lat: 40.4124, lng: 49.8651, address: "8 Noyabr 14", opensAt: "08:00", closesAt: "20:00"),
        ServiceLocation(id: UUID(uuidString: "00000000-0000-0000-0000-000000000004")!, name: "Nərimanov Poçt Şöbəsi No 1", kind: .post, lat: 40.4061, lng: 49.8595, address: "Ağa Nemətulla 12", opensAt: "09:00", closesAt: "18:00")
    ]

    static let waits: [WaitCheckin] = [
        WaitCheckin(id: UUID(), locationId: locations[0].id, userId: nil, waitMinutes: 12, reportedAt: .now.addingTimeInterval(-900)),
        WaitCheckin(id: UUID(), locationId: locations[0].id, userId: nil, waitMinutes: 18, reportedAt: .now.addingTimeInterval(-1800)),
        WaitCheckin(id: UUID(), locationId: locations[2].id, userId: nil, waitMinutes: 35, reportedAt: .now.addingTimeInterval(-1200)),
        WaitCheckin(id: UUID(), locationId: locations[3].id, userId: nil, waitMinutes: 8, reportedAt: .now.addingTimeInterval(-600))
    ]

    static let pins: [SafetyPin] = [
        SafetyPin(id: UUID(), userId: nil, lat: 40.4096, lng: 49.8623, category: .lighting, description: "Atatürk prospektində piyada keçidi qaranlıq qalır.", photoURL: nil, upvotes: 14, status: .pending, createdAt: .now.addingTimeInterval(-172800)),
        SafetyPin(id: UUID(), userId: nil, lat: 40.4042, lng: 49.8589, category: .crossing, description: "Piyada keçidində xətlər silinib, sürücülər görmür.", photoURL: nil, upvotes: 22, status: .pending, createdAt: .now.addingTimeInterval(-259200)),
        SafetyPin(id: UUID(), userId: nil, lat: 40.4127, lng: 49.8665, category: .traffic, description: "İşıqfor xarabdır, axşamlar təhlükəlidir.", photoURL: nil, upvotes: 31, status: .reviewed, createdAt: .now.addingTimeInterval(-432000))
    ]
}
