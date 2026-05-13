# Release 20260512.1007

Fixed "Show on Calendar" toggle not persisting when deselected. The Pydantic MultiValueEntry model was missing the show_on_calendar field, so Pydantic silently stripped it during request validation. Added the field as Optional[bool] = None to the model.
