# Implementation Plan

## Overview
This spec implements a comprehensive font picker component and drop cap styling system for the CWOPOD book typesetting workflow. The font picker is a shared UI component used in both the Typeset step and Cover Builder, providing access to curated print fonts, Google Fonts catalog, user-uploaded fonts, favorites, and recently-used fonts.

## Phases

### Phase 1: Backend Foundation
**Goal:** Set up database schema, font storage, and core font bundles.

### Phase 2: Backend API  
**Goal:** Implement REST API endpoints for font management and serving.

### Phase 3: Frontend Font Picker Component
**Goal:** Create reusable Font Picker modal with all features.

### Phase 4: Typeset Step Integration
**Goal:** Integrate font picker and drop cap controls into Typeset step.

### Phase 5: Template and PDF Generation
**Goal:** Update template renderer and PDF generation to use selected fonts.

### Phase 6: Cover Builder Integration
**Goal:** Replace hardcoded font dropdowns with Font Picker in Cover Builder.

### Phase 7: Testing and Polish
**Goal:** Test, optimize, and polish the complete feature.

## Tasks

- [ ] 1. Database Schema Migration - Create Alembic migration to add typography and font management tables. [🔗 Req 14](#requirement-14-typography-data-model)
- [ ] 2. Font Storage Volume Configuration - Configure persistent Docker volume for font storage. [🔗 Req 6](#requirement-6-font-storage-and-serving-architecture)
- [ ] 3. Print Fonts Bundle - Bundle curated print-friendly fonts in the application. [🔗 Req 2](#requirement-2-print-fonts-section)
- [ ] 4. Google Fonts Catalog - Create static JSON catalog of Google Fonts metadata. [🔗 Req 3](#requirement-3-google-fonts-catalog-browsing)
- [ ] 5. Font Management API Endpoints - Implement REST API endpoints for font management. [🔗 Req 13](#requirement-13-font-backend-api)
- [ ] 6. Font Serving Endpoint - Implement endpoint to serve font files for frontend preview. [🔗 Req 6](#requirement-6-font-storage-and-serving-architecture)
- [ ] 7. Project Typography API - Update project API to handle typography settings. [🔗 Req 8](#requirement-8-typography-settings-panel) [🔗 Req 10](#requirement-10-drop-cap-color-cost-warning)
- [ ] 8. Admin Bulk Download Task - Implement Celery task for bulk Google Fonts download. [🔗 Req 7](#requirement-7-admin-bulk-font-download)
- [ ] 9. Font Picker Modal Component - Create reusable Font Picker modal component. [🔗 Req 1](#requirement-1-font-picker-component)
- [ ] 10. Font Preview and Loading - Implement dynamic font loading and preview rendering. [🔗 Req 1](#requirement-1-font-picker-component) [🔗 Req 3](#requirement-3-google-fonts-catalog-browsing)
- [ ] 11. Font Upload Interface - Implement font upload functionality. [🔗 Req 4](#requirement-4-user-font-uploads)
- [ ] 12. Favorites and Recent Management - Implement favorites and recently used functionality. [🔗 Req 5](#requirement-5-favorites-and-recently-used)
- [ ] 13. Typography Settings Panel - Add typography panel to Typeset step. [🔗 Req 8](#requirement-8-typography-settings-panel)
- [ ] 14. Drop Cap Configuration UI - Implement drop cap configuration controls. [🔗 Req 9](#requirement-9-drop-cap-configuration)
- [ ] 15. Color Cost Warning System - Implement warning for non-black drop cap colors. [🔗 Req 10](#requirement-10-drop-cap-color-cost-warning)
- [ ] 16. Template Renderer Updates - Update template renderer to accept typography settings. [🔗 Req 11](#requirement-11-typst-template-integration)
- [ ] 17. Typst Compiler Integration - Update PDF generation to use font storage. [🔗 Req 6](#requirement-6-font-storage-and-serving-architecture) [🔗 Req 11](#requirement-11-typst-template-integration)
- [ ] 18. Drop Cap Typst Implementation - Implement drop cap rendering in Typst templates. [🔗 Req 9](#requirement-9-drop-cap-configuration) [🔗 Req 11](#requirement-11-typst-template-integration)
- [ ] 19. Cover Builder Font Picker Integration - Replace hardcoded font dropdown with Font Picker. [🔗 Req 12](#requirement-12-cover-builder-font-integration)
- [ ] 20. Cover PDF Font Resolution - Update cover PDF generation to use font storage. [🔗 Req 12](#requirement-12-cover-builder-font-integration)
- [ ] 21. Backend Testing - Write tests for font management API.
- [ ] 22. Frontend Testing - Write tests for Font Picker component.
- [ ] 23. End-to-End Testing - Test complete font picker to PDF generation flow.
- [ ] 24. Performance Optimization - Optimize font loading and rendering performance.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": "wave1",
      "tasks": ["1", "2", "3", "4"]
    },
    {
      "id": "wave2", 
      "tasks": ["5", "6", "7", "8"],
      "dependsOn": ["wave1"]
    },
    {
      "id": "wave3",
      "tasks": ["9", "10", "11", "12"],
      "dependsOn": ["wave2"]
    },
    {
      "id": "wave4",
      "tasks": ["13", "14", "15"],
      "dependsOn": ["wave2", "wave3"]
    },
    {
      "id": "wave5",
      "tasks": ["16", "17", "18"],
      "dependsOn": ["wave1", "wave2"]
    },
    {
      "id": "wave6",
      "tasks": ["19", "20"],
      "dependsOn": ["wave3", "wave5"]
    },
    {
      "id": "wave7",
      "tasks": ["21", "22", "23", "24"],
      "dependsOn": ["wave4", "wave5", "wave6"]
    }
  ]
}
```

## Navigation Bubbles

Click on any requirement number below to navigate to that requirement in the requirements document:

[1](#requirement-1-font-picker-component) • [2](#requirement-2-print-fonts-section) • [3](#requirement-3-google-fonts-catalog-browsing) • [4](#requirement-4-user-font-uploads) • [5](#requirement-5-favorites-and-recently-used) • [6](#requirement-6-font-storage-and-serving-architecture) • [7](#requirement-7-admin-bulk-font-download) • [8](#requirement-8-typography-settings-panel) • [9](#requirement-9-drop-cap-configuration) • [10](#requirement-10-drop-cap-color-cost-warning) • [11](#requirement-11-typst-template-integration) • [12](#requirement-12-cover-builder-font-integration) • [13](#requirement-13-font-backend-api) • [14](#requirement-14-typography-data-model)

## Notes

- All font file operations should include extensive logging per the logging steering rule
- No software installation should be attempted (per no-install steering rule)
- Progress bars must reflect real progress, not fake timers (per no-fake-progress rule)
- Read existing code before implementing changes (per read-the-code rule)
- Tests are optional per project policy