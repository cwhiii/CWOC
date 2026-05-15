package com.cwoc.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val CwocColorScheme = lightColorScheme(
    primary = CwocPrimary,
    onPrimary = CwocOnPrimary,
    primaryContainer = CwocPrimaryContainer,
    onPrimaryContainer = CwocOnPrimaryContainer,
    secondary = CwocSecondary,
    onSecondary = CwocOnSecondary,
    secondaryContainer = CwocSecondaryContainer,
    onSecondaryContainer = CwocOnSecondaryContainer,
    tertiary = CwocTertiary,
    onTertiary = CwocOnTertiary,
    tertiaryContainer = CwocTertiaryContainer,
    onTertiaryContainer = CwocOnTertiaryContainer,
    background = CwocBackground,
    onBackground = CwocOnBackground,
    surface = CwocSurface,
    onSurface = CwocOnSurface,
    onSurfaceVariant = CwocOnSurfaceVariant,
    surfaceVariant = CwocSurfaceVariant,
    outline = CwocOutline,
    outlineVariant = CwocOutlineVariant,
    error = CwocError,
    onError = CwocOnError,
    errorContainer = CwocErrorContainer,
    onErrorContainer = CwocOnErrorContainer,
    inverseSurface = CwocInverseSurface,
    inverseOnSurface = CwocInverseOnSurface,
    inversePrimary = CwocInversePrimary,
    surfaceTint = CwocSurfaceTint,
    scrim = CwocScrim
)

@Composable
fun CwocTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = CwocColorScheme,
        typography = CwocTypography,
        shapes = CwocShapes,
        content = content
    )
}
