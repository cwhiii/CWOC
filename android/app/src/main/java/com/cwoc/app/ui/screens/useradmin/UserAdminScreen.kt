package com.cwoc.app.ui.screens.useradmin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.PersonOff
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)
private val InactiveGray = Color(0xFF9E9E9E)

// ─── Main Screen ────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserAdminScreen(
    onNavigateBack: () -> Unit,
    viewModel: UserAdminViewModel = hiltViewModel()
) {
    val users by viewModel.users.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val actionMessage by viewModel.actionMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    // Dialog state
    var showCreateDialog by remember { mutableStateOf(false) }
    var editingUser by remember { mutableStateOf<UserItem?>(null) }

    // Show snackbar for action messages
    LaunchedEffect(actionMessage) {
        actionMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearActionMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("User Admin") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = ParchmentBrown,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "New User")
            }
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when {
                isLoading -> LoadingState()
                error != null -> ErrorState(
                    message = error!!,
                    onRetry = { viewModel.loadUsers() }
                )
                users.isEmpty() -> EmptyState()
                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item { Spacer(modifier = Modifier.height(4.dp)) }
                        items(users, key = { it.id }) { user ->
                            UserCard(
                                user = user,
                                currentUserId = viewModel.currentUserId,
                                onClick = { editingUser = user }
                            )
                        }
                        item { Spacer(modifier = Modifier.height(80.dp)) }
                    }
                }
            }
        }
    }

    // Create user dialog
    if (showCreateDialog) {
        CreateUserDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = { username, displayName, password, email, isAdmin ->
                viewModel.createUser(username, displayName, password, email, isAdmin)
                showCreateDialog = false
            }
        )
    }

    // Edit user dialog
    editingUser?.let { user ->
        EditUserDialog(
            user = user,
            currentUserId = viewModel.currentUserId,
            onDismiss = { editingUser = null },
            onSave = { username, displayName, email, isAdmin ->
                viewModel.updateUser(user.id, username, displayName, email, isAdmin)
                editingUser = null
            },
            onDeactivate = {
                viewModel.deactivateUser(user.id)
                editingUser = null
            },
            onReactivate = {
                viewModel.reactivateUser(user.id)
                editingUser = null
            },
            onResetPassword = { newPassword ->
                viewModel.resetPassword(user.id, newPassword)
                editingUser = null
            }
        )
    }
}

// ─── User Card ──────────────────────────────────────────────────────────────────

@Composable
private fun UserCard(
    user: UserItem,
    currentUserId: String,
    onClick: () -> Unit
) {
    val isCurrentUser = user.id == currentUserId
    val textColor = if (user.isActive) ParchmentText else InactiveGray

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (user.isActive)
                MaterialTheme.colorScheme.surface
            else
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Profile image
            AsyncImage(
                model = user.profileImageUrl,
                contentDescription = "Profile",
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
            )

            Column(modifier = Modifier.weight(1f)) {
            // Top row: username + role badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = user.username,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = textColor
                    )
                    if (isCurrentUser) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = ParchmentBrown.copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "You",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = ParchmentBrown,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (!user.isActive) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = InactiveGray.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = "Inactive",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = InactiveGray,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    RoleBadge(isAdmin = user.isAdmin, isActive = user.isActive)
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Display name
            if (!user.displayName.isNullOrBlank()) {
                Text(
                    text = user.displayName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = textColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Email
            if (!user.email.isNullOrBlank()) {
                Text(
                    text = user.email,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (user.isActive)
                        MaterialTheme.colorScheme.onSurfaceVariant
                    else
                        InactiveGray,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Created date
            if (!user.createdDatetime.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Created: ${formatDate(user.createdDatetime)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (user.isActive)
                        MaterialTheme.colorScheme.onSurfaceVariant
                    else
                        InactiveGray
                )
            }
            } // end inner Column
        } // end Row
    }
}

@Composable
private fun RoleBadge(isAdmin: Boolean, isActive: Boolean) {
    val (backgroundColor, textColor, label) = if (isAdmin) {
        Triple(
            if (isActive) ParchmentBrown else InactiveGray,
            Color.White,
            "Admin"
        )
    } else {
        Triple(
            if (isActive) MaterialTheme.colorScheme.surfaceVariant else InactiveGray.copy(alpha = 0.3f),
            if (isActive) MaterialTheme.colorScheme.onSurfaceVariant else InactiveGray,
            "User"
        )
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = backgroundColor
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            fontWeight = FontWeight.Bold
        )
    }
}

// ─── Create User Dialog ─────────────────────────────────────────────────────────

@Composable
private fun CreateUserDialog(
    onDismiss: () -> Unit,
    onCreate: (username: String, displayName: String, password: String, email: String, isAdmin: Boolean) -> Unit
) {
    var username by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var isAdmin by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New User", color = ParchmentText) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it },
                    label = { Text("Display Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Admin", color = ParchmentText)
                    Switch(
                        checked = isAdmin,
                        onCheckedChange = { isAdmin = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = ParchmentBrown
                        )
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onCreate(username, displayName, password, email, isAdmin) },
                enabled = username.isNotBlank() && password.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = ParchmentBrown)
            }
        }
    )
}

// ─── Edit User Dialog ───────────────────────────────────────────────────────────

@Composable
private fun EditUserDialog(
    user: UserItem,
    currentUserId: String,
    onDismiss: () -> Unit,
    onSave: (username: String, displayName: String, email: String, isAdmin: Boolean) -> Unit,
    onDeactivate: () -> Unit,
    onReactivate: () -> Unit,
    onResetPassword: (newPassword: String) -> Unit
) {
    var username by remember { mutableStateOf(user.username) }
    var displayName by remember { mutableStateOf(user.displayName ?: "") }
    var email by remember { mutableStateOf(user.email ?: "") }
    var isAdmin by remember { mutableStateOf(user.isAdmin) }
    var showResetPassword by remember { mutableStateOf(false) }
    var newPassword by remember { mutableStateOf("") }
    var showDeactivateConfirm by remember { mutableStateOf(false) }

    val isSelf = user.id == currentUserId

    if (showResetPassword) {
        AlertDialog(
            onDismissRequest = { showResetPassword = false },
            title = { Text("Reset Password", color = ParchmentText) },
            text = {
                Column {
                    Text(
                        text = "Set a new password for ${user.username}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        label = { Text("New Password") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onResetPassword(newPassword)
                        showResetPassword = false
                    },
                    enabled = newPassword.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
                ) {
                    Text("Reset")
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetPassword = false }) {
                    Text("Cancel", color = ParchmentBrown)
                }
            }
        )
        return
    }

    if (showDeactivateConfirm) {
        AlertDialog(
            onDismissRequest = { showDeactivateConfirm = false },
            title = { Text("Deactivate User", color = ParchmentText) },
            text = {
                Text("Are you sure you want to deactivate ${user.username}? They will no longer be able to log in.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        onDeactivate()
                        showDeactivateConfirm = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC62828))
                ) {
                    Text("Deactivate")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeactivateConfirm = false }) {
                    Text("Cancel", color = ParchmentBrown)
                }
            }
        )
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit User", color = ParchmentText) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it },
                    label = { Text("Display Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Admin", color = ParchmentText)
                    Switch(
                        checked = isAdmin,
                        onCheckedChange = { isAdmin = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = ParchmentBrown
                        )
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Reset Password button
                OutlinedButton(
                    onClick = { showResetPassword = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Reset Password", color = ParchmentBrown)
                }

                // Deactivate / Reactivate button
                if (!isSelf) {
                    if (user.isActive) {
                        OutlinedButton(
                            onClick = { showDeactivateConfirm = true },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = Color(0xFFC62828)
                            )
                        ) {
                            Icon(
                                Icons.Default.PersonOff,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Deactivate User")
                        }
                    } else {
                        OutlinedButton(
                            onClick = {
                                onReactivate()
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = Color(0xFF2E7D32)
                            )
                        ) {
                            Icon(
                                Icons.Default.PersonAdd,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Reactivate User")
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(username, displayName, email, isAdmin) },
                enabled = username.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = ParchmentBrown)
            }
        }
    )
}

// ─── State Composables ──────────────────────────────────────────────────────────

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(color = ParchmentBrown)
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(containerColor = ParchmentBrown)
            ) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun EmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No users found",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Create a new user with the + button",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

private fun formatDate(dateStr: String): String {
    return try {
        val inputFormat = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
        inputFormat.timeZone = java.util.TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(dateStr)
            ?: java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.parse(dateStr)
            ?: return dateStr

        val outputFormat = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US)
        outputFormat.timeZone = java.util.TimeZone.getDefault()
        outputFormat.format(date)
    } catch (e: Exception) {
        dateStr
    }
}
