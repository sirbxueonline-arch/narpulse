import SwiftUI
import MapKit
import Observation
import Foundation
import UIKit

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

    private let service = NarPulseService()

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
            }
            .navigationTitle("Kəsintilər")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $selectedOutage) { outage in
                OutageDetailSheet(outage: outage)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
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
                .ignoresSafeArea(edges: .bottom)

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
                AddSafetyPinView()
                    .presentationDetents([.large])
            }
        }
    }
}

struct AccountView: View {
    @State private var email = ""
    @State private var notificationsEnabled = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    VStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.badge.checkmark")
                            .font(.system(size: 54))
                            .foregroundStyle(.npAccent2)
                        Text("Magic link ilə daxil ol")
                            .font(.title3.weight(.heavy))
                        Text("Hesabat vermək və pin əlavə etmək üçün e-poçt linki al.")
                            .font(.subheadline)
                            .foregroundStyle(.npMuted)
                            .multilineTextAlignment(.center)
                        TextField("siz@example.com", text: $email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .padding(12)
                            .background(Color.npSurface2, in: RoundedRectangle(cornerRadius: 12))
                        Button("Link göndər") {}
                            .buttonStyle(PrimaryButtonStyle())
                    }
                    .npCard()

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
}

struct OnboardingView: View {
    let finish: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            TabView {
                OnboardingCard(icon: "dot.radiowaves.left.and.right", title: "Kəsintiləri canlı gör", body: "Su, işıq və qaz bildirişləri xəritədə və siyahıda eyni anda yenilənir.")
                OnboardingCard(icon: "clock.badge.checkmark", title: "Növbəni əvvəlcədən bil", body: "Sakin hesabatları ilə ASAN, poçt və poliklinika gözləmə vaxtını gör.")
                OnboardingCard(icon: "exclamationmark.triangle.fill", title: "Təhlükəli nöqtəni bildir", body: "Şəkil, kateqoriya və məkanla RİH komandasına aydın siqnal göndər.")
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
            Button("Göndər") {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                dismiss()
            }
            .buttonStyle(PrimaryButtonStyle())
            Spacer()
        }
        .padding(20)
        .background(Color.npBg)
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
    @State private var voted = false

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
            }
            Text(pin.description ?? "Təsvir yoxdur.")
            Button {
                voted = true
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } label: {
                Label(voted ? "Səs verdiniz" : "Mən də gördüm", systemImage: "hand.thumbsup.fill")
            }
            .buttonStyle(PrimaryButtonStyle())
            Spacer()
        }
        .padding(20)
        .background(Color.npBg)
    }
}

struct AddSafetyPinView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var category: SafetyCategory = .crossing
    @State private var description = ""

    var body: some View {
        NavigationStack {
            Form {
                Picker("Kateqoriya", selection: $category) {
                    ForEach(SafetyCategory.allCases) { category in
                        Label(category.label, systemImage: category.iconName).tag(category)
                    }
                }
                TextField("Nə təhlükəlidir?", text: $description, axis: .vertical)
                    .lineLimit(4, reservesSpace: true)
                Button {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    dismiss()
                } label: {
                    Label("Pin əlavə et", systemImage: "paperplane.fill")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.npBg)
            .navigationTitle("Yeni pin")
        }
    }
}

struct OnboardingCard: View {
    let icon: String
    let title: String
    let body: String

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
            Text(body)
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
