interface SelectablePopupRow {
  active?: boolean
  keyboardActive?: boolean
}

/** Builders return unselected rows; selection changes never mutate delivered snapshots. */
export function createPopupContentRowCache<Row extends SelectablePopupRow>(
  selectionKey: keyof SelectablePopupRow
) {
  let dependencies: readonly unknown[] | null = null
  let rows: Row[] = []
  let selectedIndex = -1

  return {
    getRows(
      nextDependencies: readonly unknown[],
      buildRows: () => Row[],
      activeIndex = -1
    ): Row[] {
      if (
        !dependencies ||
        dependencies.length !== nextDependencies.length ||
        dependencies.some((value, index) => !Object.is(value, nextDependencies[index]))
      ) {
        rows = buildRows()
        dependencies = nextDependencies
        selectedIndex = -1
      }

      const nextIndex = Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < rows.length
        ? activeIndex
        : -1
      if (nextIndex !== selectedIndex) {
        const nextRows = rows.slice()
        if (selectedIndex >= 0) {
          nextRows[selectedIndex] = { ...rows[selectedIndex], [selectionKey]: false }
        }
        if (nextIndex >= 0) {
          nextRows[nextIndex] = { ...rows[nextIndex], [selectionKey]: true }
        }
        rows = nextRows
        selectedIndex = nextIndex
      }

      return rows
    },
    clear(): void {
      dependencies = null
      rows = []
      selectedIndex = -1
    }
  }
}
