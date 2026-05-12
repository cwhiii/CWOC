# Release 20260512.0748

Fixed month drag & drop: (1) Target date now parsed as local midnight instead of UTC midnight, fixing the 0.75-day offset that caused incorrect time shifts. (2) Switched from PUT (full chit) to PATCH /fields (only date fields), fixing the 422 validation errors caused by serialized JSON fields being sent back as objects.
