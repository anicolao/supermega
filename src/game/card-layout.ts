export type CardLayout = { capacity: number; columns: number; size: number };
/** Fit complete cards to the measured surface. Only number-marking trays paginate. */
export function fitCards({
  width,
  height,
  count,
  all = false,
  preferredColumns,
  actionSpace = 0,
  maximum = 320,
  page = 0,
}: {
  width: number;
  height: number;
  count: number;
  all?: boolean;
  preferredColumns?: number;
  actionSpace?: number;
  maximum?: number;
  page?: number;
}): CardLayout {
  const gap = 8,
    minimum = 260;
  const maxColumns = Math.max(1, Math.floor((width + gap) / (minimum + gap)));
  const maxRows = Math.max(
    1,
    Math.floor((height + gap) / (minimum + actionSpace + gap)),
  );
  const capacity = Math.max(
    1,
    all ? count : Math.min(count, maxColumns * maxRows),
  );
  const lastPage = Math.max(0, Math.ceil(count / capacity) - 1);
  const visible = Math.max(
    1,
    Math.min(
      capacity,
      count - Math.min(Math.max(0, page), lastPage) * capacity,
    ),
  );
  let best = { capacity, columns: 1, size: 0 };
  const columnsToTry = preferredColumns
    ? [Math.min(visible, preferredColumns)]
    : Array.from(
        { length: all ? visible : Math.min(maxColumns, visible) },
        (_, i) => i + 1,
      );
  for (const columns of columnsToTry) {
    const rows = Math.ceil(visible / columns);
    const size = Math.max(
      1,
      Math.floor(
        Math.min(
          (width - gap * (columns - 1)) / columns,
          (height - gap * (rows - 1)) / rows - actionSpace,
          maximum,
        ),
      ),
    );
    if (size > best.size) best = { capacity, columns, size };
  }
  return best;
}
