## 20260511.2046

Fixed the point-in-time time picker not loading the current field value when clicked. The picker now correctly reads the stored time from `dataset.time` instead of defaulting to noon. Also fixed the save path to read from `dataset.time` ensuring 12-hour formatted display text doesn't corrupt the saved ISO timestamp.
