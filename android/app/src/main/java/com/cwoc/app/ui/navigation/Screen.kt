package com.cwoc.app.ui.navigation

/**
 * Sealed class defining all navigation routes in the app.
 */
sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Debug : Screen("debug")
    data object Tasks : Screen("tasks")
    data object Notes : Screen("notes")
    data object Calendar : Screen("calendar")
    data object Checklists : Screen("checklists")
    data object Alarms : Screen("alarms")
    data object Projects : Screen("projects")
    data object Indicators : Screen("indicators")
    data object Map : Screen("map")
    data object Contacts : Screen("contacts")
    data object Settings : Screen("settings") {
        /** Route template with query parameters for composable definition. */
        const val ROUTE_WITH_ARGS = "settings?tab={tab}&section={section}"

        fun createRoute(tab: String? = null, section: String? = null): String {
            val params = mutableListOf<String>()
            if (tab != null) params.add("tab=$tab")
            if (section != null) params.add("section=$section")
            return if (params.isEmpty()) "settings" else "settings?${params.joinToString("&")}"
        }
    }
    data object Trash : Screen("trash")
    data object Search : Screen("search")
    data object Help : Screen("help")
    data object Weather : Screen("weather")
    data object OmniView : Screen("omni")
    data object Notebook : Screen("notebook")
    data object Notifications : Screen("notifications")

    // Z1-Z4: Missing pages
    data object AuditLog : Screen("audit-log?entity_type={entityType}&entity_id={entityId}") {
        fun createRoute(entityType: String? = null, entityId: String? = null): String {
            return "audit-log?entity_type=${entityType ?: ""}&entity_id=${entityId ?: ""}"
        }
    }
    data object CustomObjects : Screen("custom-objects")
    data object RulesManager : Screen("rules-manager")
    data object UserAdmin : Screen("user-admin")
    data object AdminChits : Screen("admin-chits")
    data object ContactTrash : Screen("contact-trash")
    // CC: Email client
    data object Email : Screen("email")
    // Attachments browser
    data object Attachments : Screen("attachments")
    // Kiosk mode
    data object Kiosk : Screen("kiosk?tags={tags}") {
        fun createRoute(selectedTags: List<String>): String {
            val tagsParam = selectedTags.joinToString(",")
            return "kiosk?tags=$tagsParam"
        }
    }

    data object RuleEditor : Screen("rule-editor/{ruleId}") {
        const val NEW_RULE_ID = "new"
        fun createRoute(ruleId: String) = "rule-editor/$ruleId"
    }

    data object Editor : Screen("editor/{chitId}?start={start}&end={end}") {
        const val NEW_CHIT_ID = "new"
        fun createRoute(chitId: String) = "editor/$chitId"
        fun createRouteWithPrefill(start: String, end: String) = "editor/new?start=$start&end=$end"
    }

    data object ContactEditor : Screen("contact-editor/{contactId}?userId={userId}") {
        const val NEW_CONTACT_ID = "new"
        fun createRoute(contactId: String) = "contact-editor/$contactId"
        fun createProfileRoute(userId: String) = "contact-editor/profile?userId=$userId"
    }
}
