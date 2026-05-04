# Release 20260504.0903

Fixed DOM error on People page — vault icon was using insertBefore on a node that hadn't been appended to the row yet. Changed to appendChild so the icon is added in the correct order (after thumbnail, before info column).
