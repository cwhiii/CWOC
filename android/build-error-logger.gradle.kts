// Auto-captures Kotlin/Java compilation errors to build-output.txt
// This runs as part of every Gradle build (including Android Studio builds)

gradle.projectsEvaluated {
    val outputFile = File(rootDir, "build-output.txt")

    gradle.taskGraph.afterTask {
        if (state.failure != null) {
            outputFile.appendText("\n\n=== TASK FAILED: $path ===\n")
            outputFile.appendText("${state.failure?.message}\n")
            state.failure?.cause?.let {
                outputFile.appendText("Cause: ${it.message}\n")
            }
        }
    }
}
