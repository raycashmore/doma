import SwiftUI

extension View {
  /// A cream sheet under the dark header, as on the web, with the large serif title on the header.
  /// The title moves into the navigation bar once the sheet scrolls. It is drawn here, not by the
  /// bar: iOS draws the bar's large title inside the scrolling content, where the sheet would hide it.
  func domaHeaderedSheet(title: Text, corners: DomaSheetCorners = .top) -> some View {
    modifier(DomaHeaderedSheet(title: title, corners: corners))
  }
}

private struct DomaHeaderedSheet: ViewModifier {
  let title: Text
  let corners: DomaSheetCorners
  @State private var isScrolled = false

  func body(content: Content) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      if !isScrolled {
        title
          .domaFont(.display)
          .foregroundStyle(DomaColor.warmTextOnDark)
          .accessibilityAddTraits(.isHeader)
          .padding(.horizontal, 20)
          .padding(.top, 4)
          .padding(.bottom, 14)
          .transition(.opacity.combined(with: .move(edge: .top)))
      }
      content
        .scrollContentBackground(.hidden)
        .background(DomaColor.warmBgCardSoft.ignoresSafeArea(edges: .bottom))
        // Content scrolls under the sheet's rounded top, not under the header.
        .mask { corners.shape.ignoresSafeArea(edges: .bottom) }
        .scrollEdgeEffectHidden(true, for: .top)
    }
    // Collapses a little way in and opens again only at the top, so it does not flicker in between.
    // A list that would fit once the title moved away keeps it, or letting go would snap it back.
    .onScrollGeometryChange(for: HeaderScroll.self) { geometry in
      HeaderScroll(
        offset: geometry.contentOffset.y + geometry.contentInsets.top,
        overflow: geometry.contentSize.height + geometry.contentInsets.top + geometry.contentInsets.bottom
          - geometry.containerSize.height
      )
    } action: { _, position in
      let scrolled = isScrolled ? position.offset > 0 : position.offset > 24 && position.overflow > 96
      if scrolled != isScrolled {
        withAnimation(.snappy(duration: 0.25)) { isScrolled = scrolled }
      }
    }
    .toolbarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .principal) {
        title
          .domaFont(.displayInline)
          .foregroundStyle(DomaColor.warmTextOnDark)
          .opacity(isScrolled ? 1 : 0)
          .accessibilityHidden(!isScrolled)
      }
    }
    .domaDarkHeader()
  }
}

private struct HeaderScroll: Equatable {
  let offset: CGFloat
  /// How far the content runs past the visible area.
  let overflow: CGFloat
}
