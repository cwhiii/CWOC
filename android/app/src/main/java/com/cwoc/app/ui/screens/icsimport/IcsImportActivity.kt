package com.cwoc.app.ui.screens.icsimport

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.remote.IcsImportResponse
import com.cwoc.app.data.repository.AuthRepository
import com.cwoc.app.ui.theme.CwocTheme
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown
import com.cwoc.app.ui.theme.ParchmentBackground
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Activity that handles .ics calendar file intents.
 *
 * When the user opens a .ics file on their phone and selects CWOC from the
 * "Open with" chooser, this activity reads the file content and sends it
 * to the server's POST /api/import/ics endpoint, then displays the result.
 */
@AndroidEntryPoint
class IcsImportActivity : ComponentActivity() {

    companion object {
        private const val TAG = "IcsImport"
    }

    @Inject
    lateinit var apiService: CwocApiService

    @Inject
    lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val icsContent = readIcsFromIntent(intent)
        val isAuthenticated = authRepository.isAuthenticated()

        setContent {
            CwocTheme {
                IcsImportScreen(
                    icsContent = icsContent,
                    isAuthenticated = isAuthenticated,
                    apiService = apiService,
                    onDone = { finish() }
                )
            }
        }
    }

    /**
     * Extract .ics file content from the incoming intent.
     * Handles ACTION_VIEW (file opened directly) and ACTION_SEND (shared).
     */
    private fun readIcsFromIntent(intent: Intent): String? {
        val uri: Uri? = when (intent.action) {
            Intent.ACTION_VIEW -> intent.data
            Intent.ACTION_SEND -> {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_STREAM)
                }
            }
            else -> null
        }

        if (uri == null) {
            Log.e(TAG, "No URI found in intent: action=${intent.action}")
            return null
        }

        return try {
            contentResolver.openInputStream(uri)?.use { stream ->
                stream.bufferedReader().readText()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read .ics file from URI: $uri", e)
            null
        }
    }
}

@Composable
private fun IcsImportScreen(
    icsContent: String?,
    isAuthenticated: Boolean,
    apiService: CwocApiService,
    onDone: () -> Unit
) {
    // State: loading, success, or error
    var isLoading by remember { mutableStateOf(true) }
    var result by remember { mutableStateOf<IcsImportResponse?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // If not authenticated, show error immediately
    if (!isAuthenticated) {
        isLoading = false
        errorMessage = "Not signed in. Open CWOC and sign in first, then try again."
    }

    // If no content could be read, show error immediately
    if (icsContent == null && errorMessage == null) {
        isLoading = false
        errorMessage = "Could not read the calendar file."
    }

    // Perform the import
    LaunchedEffect(icsContent) {
        if (icsContent == null || !isAuthenticated) return@LaunchedEffect

        try {
            val response = withContext(Dispatchers.IO) {
                apiService.importIcs(mapOf("ics_content" to icsContent))
            }
            if (response.isSuccessful && response.body() != null) {
                result = response.body()
            } else {
                val errorBody = response.errorBody()?.string()
                errorMessage = "Import failed: ${response.code()} — ${errorBody ?: "Unknown error"}"
                Log.e("IcsImport", "API error: ${response.code()} $errorBody")
            }
        } catch (e: Exception) {
            errorMessage = "Network error: ${e.localizedMessage ?: "Could not reach server"}"
            Log.e("IcsImport", "Exception during ICS import", e)
        } finally {
            isLoading = false
        }
    }

    ParchmentBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            when {
                isLoading -> LoadingState()
                errorMessage != null -> ErrorState(errorMessage!!, onDone)
                result != null -> SuccessState(result!!, onDone)
            }
        }
    }
}

@Composable
private fun LoadingState() {
    Icon(
        imageVector = Icons.Default.CalendarMonth,
        contentDescription = null,
        modifier = Modifier.size(64.dp),
        tint = CwocZoneHeaderBrown
    )
    Spacer(modifier = Modifier.height(16.dp))
    Text(
        text = "Importing Calendar…",
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
        color = CwocZoneHeaderBrown
    )
    Spacer(modifier = Modifier.height(24.dp))
    CircularProgressIndicator(
        color = CwocZoneHeaderBrown,
        modifier = Modifier.size(48.dp)
    )
}

@Composable
private fun SuccessState(result: IcsImportResponse, onDone: () -> Unit) {
    Icon(
        imageVector = Icons.Default.CheckCircle,
        contentDescription = null,
        modifier = Modifier.size(64.dp),
        tint = Color(0xFF4CAF50)
    )
    Spacer(modifier = Modifier.height(16.dp))
    Text(
        text = "Import Complete",
        fontSize = 22.sp,
        fontWeight = FontWeight.Bold,
        color = CwocZoneHeaderBrown
    )
    Spacer(modifier = Modifier.height(16.dp))
    Text(
        text = "${result.imported} event${if (result.imported != 1) "s" else ""} imported",
        fontSize = 18.sp,
        color = CwocZoneHeaderBrown
    )
    if (result.skipped > 0) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "${result.skipped} skipped (duplicates)",
            fontSize = 16.sp,
            color = CwocZoneHeaderBrown.copy(alpha = 0.7f)
        )
    }
    if (result.errors.isNotEmpty()) {
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Errors:",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFFB71C1C)
        )
        result.errors.forEach { err ->
            Text(
                text = "• $err",
                fontSize = 13.sp,
                color = Color(0xFFB71C1C),
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
    Spacer(modifier = Modifier.height(32.dp))
    Button(
        onClick = onDone,
        colors = ButtonDefaults.buttonColors(
            containerColor = CwocZoneHeaderBrown
        ),
        modifier = Modifier.fillMaxWidth(0.6f)
    ) {
        Text("Done", color = Color.White, fontSize = 16.sp)
    }
}

@Composable
private fun ErrorState(message: String, onDone: () -> Unit) {
    Icon(
        imageVector = Icons.Default.Error,
        contentDescription = null,
        modifier = Modifier.size(64.dp),
        tint = Color(0xFFB71C1C)
    )
    Spacer(modifier = Modifier.height(16.dp))
    Text(
        text = "Import Failed",
        fontSize = 22.sp,
        fontWeight = FontWeight.Bold,
        color = CwocZoneHeaderBrown
    )
    Spacer(modifier = Modifier.height(16.dp))
    Text(
        text = message,
        fontSize = 15.sp,
        color = Color(0xFFB71C1C),
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth()
    )
    Spacer(modifier = Modifier.height(32.dp))
    Button(
        onClick = onDone,
        colors = ButtonDefaults.buttonColors(
            containerColor = CwocZoneHeaderBrown
        ),
        modifier = Modifier.fillMaxWidth(0.6f)
    ) {
        Text("Close", color = Color.White, fontSize = 16.sp)
    }
}
