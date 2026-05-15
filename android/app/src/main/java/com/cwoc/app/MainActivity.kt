package com.cwoc.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.cwoc.app.data.repository.AuthEvent
import com.cwoc.app.data.repository.AuthRepository
import com.cwoc.app.data.sync.SyncWorker
import com.cwoc.app.ui.navigation.BottomNavBar
import com.cwoc.app.ui.navigation.CwocNavGraph
import com.cwoc.app.ui.navigation.Screen
import com.cwoc.app.ui.theme.CwocTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CwocApp(authRepository = authRepository)
        }
    }
}

@Composable
private fun CwocApp(authRepository: AuthRepository) {
    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val context = LocalContext.current

    // Determine initial auth state
    val isAuthenticated = authRepository.isAuthenticated()

    // Listen for token revocation events and navigate to login
    LaunchedEffect(Unit) {
        authRepository.authEvents.collect { event ->
            when (event) {
                is AuthEvent.TokenRevoked -> {
                    // Show "Session expired" message
                    snackbarHostState.showSnackbar("Session expired. Please log in again.")
                    // Navigate to login, clearing the back stack
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            }
        }
    }

    // Enqueue SyncWorker periodic sync when navigating away from login (i.e., after successful login)
    LaunchedEffect(currentRoute) {
        if (currentRoute != null && currentRoute != Screen.Login.route) {
            SyncWorker.enqueue(context)
        }
    }

    CwocTheme {
        Scaffold(
            snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
            bottomBar = {
                // Hide bottom nav on login screen
                if (currentRoute != null && currentRoute != Screen.Login.route) {
                    BottomNavBar(navController = navController)
                }
            }
        ) { innerPadding ->
            CwocNavGraph(
                navController = navController,
                isAuthenticated = isAuthenticated,
                modifier = Modifier.padding(innerPadding)
            )
        }
    }
}
