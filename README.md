# Kotlin APK Web Builder (starter)

A self-hostable web interface for building Android APKs from an Android/Gradle project ZIP.

## Important limitation
A `.kt` file alone is not a complete Android app. The builder expects a ZIP containing a valid Android Gradle project (including `settings.gradle`/`settings.gradle.kts`, a module `build.gradle`/`build.gradle.kts`, `AndroidManifest.xml`, and source files). This starter does not magically convert arbitrary Kotlin code into an app.

## Requirements
- Docker installed on the host
- Node.js 20+
- Internet access on first build so Gradle can download dependencies
- A valid Android Gradle project

## Run locally
1. Install Docker and Node.js on a computer/server (not just inside a normal browser).
2. In this folder run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.
5. Upload a ZIP of your Android project and press Build APK.

The backend runs each build in a disposable Docker container with CPU/memory/time limits. Review and harden this before exposing it publicly.

## Security notes
- Do not expose this starter directly to the public internet without authentication, rate limits, quotas, reverse-proxy TLS, and stronger sandboxing.
- Never run uploaded Gradle projects directly on the host. This starter uses Docker isolation, but Docker itself is a powerful boundary; for multi-user production use a dedicated build worker/VM per job.
- Uploaded projects can execute Gradle build scripts. Only build projects you trust.
- APKs are unsigned debug builds unless the project configures signing. Debug APKs can generally be installed after allowing installation from that source.
