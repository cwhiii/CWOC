// Top-level build file for CWOC Android App
plugins {
    id("com.android.application") version "8.8.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
    id("com.google.dagger.hilt.android") version "2.51" apply false
    id("com.google.devtools.ksp") version "1.9.22-1.0.17" apply false
}

// ─── Build Error Logger ─────────────────────────────────────────────────────
// After compileDebugKotlin fails, grep the Gradle daemon log for Kotlin errors
// and write them to build-output.txt automatically.
gradle.taskGraph.afterTask {
    if (path == ":app:compileDebugKotlin" && state.failure != null) {
        val outputFile = File(rootDir, "build-output.txt")
        outputFile.writeText("Build failed: ${java.time.Instant.now()}\n\n")

        // Find and read the Gradle daemon log
        val gradleHome = File(System.getProperty("user.home"), ".gradle/daemon")
        if (gradleHome.exists()) {
            gradleHome.listFiles()?.flatMap { versionDir ->
                versionDir.listFiles()?.filter { it.name.endsWith(".out.log") }?.toList() ?: emptyList()
            }?.sortedByDescending { it.lastModified() }?.firstOrNull()?.let { logFile ->
                val errors = logFile.readLines().filter { line ->
                    line.trimStart().startsWith("e:") || line.contains("error:")
                }.takeLast(100)
                outputFile.appendText("=== Kotlin Compiler Errors ===\n")
                errors.forEach { outputFile.appendText("$it\n") }
            }
        }

        // Also capture the failure message
        outputFile.appendText("\n=== Task Failure ===\n")
        outputFile.appendText("${state.failure?.message}\n")
    }
}
