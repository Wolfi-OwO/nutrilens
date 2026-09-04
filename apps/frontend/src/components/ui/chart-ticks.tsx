// An XAxis tick for a FULL-BLEED recharts chart.
//
// Werkbank runs two charts to their tile's own edges (the dashboard's 7-day
// sparkline and /progress's weight area). Recharts centres every tick label on
// its data point, so on a bled chart the first and last labels straddle the
// SVG boundary and get cut: on a real 1440px capture the sparkline rendered
// "Aug." instead of "28. Aug." and "3. Se" instead of "3. Sept.". Both ends,
// both themes.
//
// The fix is purely an anchor change — clamp the outermost labels to `start`
// and `end` so they hang inward from the edge instead of straddling it. The
// plot area, the fill and the bleed are all untouched, which is why this is
// preferred over adding chart margin (that would cancel the bleed outright).
//
// Recharts passes `index` and `visibleTicksCount` to a custom tick element; it
// does NOT type them on the element you hand to `tick=`, hence the optional
// props. `dy` matches recharts' own default tick offset for a bottom axis.
export function EdgeTick(props: {
    x?: number
    y?: number
    index?: number
    visibleTicksCount?: number
    payload?: { value?: string | number }
}) {
    const { x = 0, y = 0, index = 0, visibleTicksCount = 0, payload } = props
    const isFirst = index === 0
    const isLast = visibleTicksCount > 0 && index === visibleTicksCount - 1
    const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
    // Nudge the clamped labels off the very edge so they do not sit on the
    // tile's own border line.
    const dx = isFirst ? 2 : isLast ? -2 : 0

    return (
        <text
            x={x + dx}
            y={y}
            dy={10}
            textAnchor={anchor}
            fill="var(--muted-foreground)"
            fontSize={11}
            fontFamily="var(--font-sans)"
        >
            {payload?.value}
        </text>
    )
}
