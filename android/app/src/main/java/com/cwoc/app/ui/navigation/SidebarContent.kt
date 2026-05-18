package com.cwoc.app.ui.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Help
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown

/**
 * Sidebar drawer content for the ModalNavigationDrawer.
 *
 * Contains navigation links (Settings, Contacts, Trash, Help, Weather, Map),
 * a "New Chit" button, and placeholder slots for filter/sort controls.
 * When the Email tab is active, shows email-specific controls (folder radios,
 * account checkboxes, "Check Mail" button, unread-at-top toggle).
 */
@Composable
fun SidebarContent(
    onNavigate: (Screen) -> Unit,
    onNewChit: () -> Unit,
    onClose: () -> Unit,
    selectedTab: CCaptnTab? = null,
    isAdmin: Boolean = true,
    emailFolder: String = "inbox",
    onEmailFolderChange: (String) -> Unit = {},
    emailAccounts: List<String> = emptyList(),
    selectedAccounts: List<String> = emptyList(),
    onAccountToggle: (String) -> Unit = {},
    unreadAtTop: Boolean = false,
    onUnreadAtTopChange: (Boolean) -> Unit = {},
    onCheckMail: () -> Unit = {},
    filterContent: @Composable () -> Unit = {},
    sortContent: @Composable () -> Unit = {},
    modifier: Modifier = Modifier
) {
    ModalDrawerSheet(modifier = modifier) {
        val scrollState = rememberScrollState()

        Column(
            modifier = Modifier
                .verticalScroll(scrollState)
                .padding(vertical = 12.dp)
        ) {
            // BB5: CWOC Logo at top of sidebar
            androidx.compose.foundation.Image(
                painter = androidx.compose.ui.res.painterResource(id = com.cwoc.app.R.drawable.cwoc_logo),
                contentDescription = "CWOC Logo",
                modifier = Modifier
                    .size(48.dp)
                    .padding(bottom = 8.dp)
                    .align(Alignment.CenterHorizontally)
            )

            // "New Chit" button
            Button(
                onClick = {
                    onNewChit()
                    onClose()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.padding(end = 8.dp)
                )
                Text("New Chit")
            }

            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(modifier = Modifier.height(8.dp))

            // Navigation links
            SidebarNavItem(
                label = "Omni View",
                icon = Icons.Default.Dashboard,
                onClick = {
                    onNavigate(Screen.OmniView)
                    onClose()
                }
            )
            SidebarNavItem(
                label = "Search",
                icon = Icons.Default.Search,
                onClick = {
                    onNavigate(Screen.Search)
                    onClose()
                }
            )
            SidebarNavItem(
                label = "Settings",
                icon = Icons.Default.Settings,
                onClick = {
                    onNavigate(Screen.Settings)
                    onClose()
                }
            )
            SidebarNavItem(
                label = "Contacts",
                icon = Icons.Default.Contacts,
                onClick = {
                    onNavigate(Screen.Contacts)
                    onClose()
                }
            )
            SidebarNavItem(
                label = "Trash",
                icon = Icons.Default.Delete,
                onClick = {
                    onNavigate(Screen.Trash)
                    onClose()
                }
            )
            SidebarNavItem(
                label = "Help",
                icon = Icons.Default.Help,
                onClick = {
                    onNavigate(Screen.Help)
                    onClose()
                }
            )
            SidebarNavItem(
                label = "Weather",
                icon = Icons.Default.Cloud,
                onClick = {
                    onNavigate(Screen.Weather)
                    onClose()
                }
            )
            SidebarNavItem(
                label = "Map",
                icon = Icons.Default.Map,
                onClick = {
                    onNavigate(Screen.Map)
                    onClose()
                }
            )
            // Z1: Audit Log link (BB5)
            SidebarNavItem(
                label = "Audit Log",
                icon = Icons.Default.Help,
                onClick = {
                    onNavigate(Screen.AuditLog)
                    onClose()
                }
            )
            // Z2: Custom Objects link (BB5)
            SidebarNavItem(
                label = "Custom Objects",
                icon = Icons.Default.Settings,
                onClick = {
                    onNavigate(Screen.CustomObjects)
                    onClose()
                }
            )
            // Z3: Rules Manager link
            SidebarNavItem(
                label = "Rules",
                icon = Icons.Default.Settings,
                onClick = {
                    onNavigate(Screen.RulesManager)
                    onClose()
                }
            )
            // Z3: User Admin link (admin-only)
            if (isAdmin) {
                SidebarNavItem(
                    label = "User Admin",
                    icon = Icons.Default.People,
                    onClick = {
                        onNavigate(Screen.UserAdmin)
                        onClose()
                    }
                )
            }
            // Attachments browser link
            SidebarNavItem(
                label = "Attachments",
                icon = Icons.Default.AttachFile,
                onClick = {
                    onNavigate(Screen.Attachments)
                    onClose()
                }
            )

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(modifier = Modifier.height(8.dp))

            // Email sidebar controls (visible when Email tab is active)
            if (selectedTab == CCaptnTab.Email) {
                EmailSidebarControls(
                    currentFolder = emailFolder,
                    onFolderChange = onEmailFolderChange,
                    accounts = emailAccounts,
                    selectedAccounts = selectedAccounts,
                    onAccountToggle = onAccountToggle,
                    unreadAtTop = unreadAtTop,
                    onUnreadAtTopChange = onUnreadAtTopChange,
                    onCheckMail = onCheckMail
                )

                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                Spacer(modifier = Modifier.height(8.dp))
            }

            // Filter controls placeholder slot
            filterContent()

            // Sort controls placeholder slot
            sortContent()
        }
    }
}

/**
 * A single navigation item in the sidebar drawer.
 */
@Composable
private fun SidebarNavItem(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    NavigationDrawerItem(
        label = { Text(label) },
        icon = {
            Icon(
                imageVector = icon,
                contentDescription = label
            )
        },
        selected = false,
        onClick = onClick,
        modifier = Modifier.padding(horizontal = 12.dp)
    )
}

/**
 * Email-specific sidebar controls shown when the Email tab is active.
 * Includes folder radio buttons, account checkboxes, "Check Mail" button,
 * and unread-at-top toggle.
 */
@Composable
private fun EmailSidebarControls(
    currentFolder: String,
    onFolderChange: (String) -> Unit,
    accounts: List<String>,
    selectedAccounts: List<String>,
    onAccountToggle: (String) -> Unit,
    unreadAtTop: Boolean,
    onUnreadAtTopChange: (Boolean) -> Unit,
    onCheckMail: () -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        // Section header
        Text(
            text = "Email",
            style = MaterialTheme.typography.titleSmall,
            color = CwocZoneHeaderBrown,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        // Folder radio buttons
        Text(
            text = "Folder",
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(bottom = 4.dp)
        )
        val folders = listOf(
            "inbox" to "Inbox",
            "sent" to "Sent",
            "drafts" to "Drafts",
            "scheduled" to "Scheduled",
            "trash" to "Trash",
            "archived" to "Archived"
        )
        folders.forEach { (value, label) ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                RadioButton(
                    selected = currentFolder == value,
                    onClick = { onFolderChange(value) }
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Account checkboxes (only shown when multiple accounts exist)
        if (accounts.size > 1) {
            Text(
                text = "Accounts",
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            accounts.forEach { account ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Checkbox(
                        checked = selectedAccounts.contains(account),
                        onCheckedChange = { onAccountToggle(account) }
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = account,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
        }

        // Unread-at-top toggle
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "Unread at top",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f)
            )
            Switch(
                checked = unreadAtTop,
                onCheckedChange = onUnreadAtTopChange
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // "Check Mail" button
        Button(
            onClick = onCheckMail,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = CwocZoneHeaderBrown
            )
        ) {
            Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = null,
                modifier = Modifier.padding(end = 8.dp)
            )
            Text("Check Mail")
        }
    }
}
