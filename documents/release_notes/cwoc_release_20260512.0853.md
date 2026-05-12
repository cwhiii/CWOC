# Release 20260512.0853

Fixed compress view showing only 4 days — added min-width:0 to .month-compress .month-day (without overflow:hidden, which breaks drag). This allows grid columns to shrink below their content width when events have white-space:nowrap.
