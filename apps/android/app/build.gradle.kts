import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

val localProperties = Properties().apply {
  val file = rootProject.file("local.properties")
  if (file.exists()) {
    file.inputStream().use(::load)
  }
}

fun clientConfig(name: String): String =
  providers.gradleProperty(name).orNull ?: localProperties.getProperty(name).orEmpty()

android {
  namespace = "com.doma.widget"
  compileSdk = 37

  defaultConfig {
    applicationId = "com.doma.widget"
    minSdk = 24
    targetSdk = 37
    versionCode = 1
    versionName = "0.1.0"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    buildConfigField("String", "DOMA_CONVEX_URL", "\"${clientConfig("domaConvexUrl")}\"")
    buildConfigField("String", "DOMA_CLERK_PUBLISHABLE_KEY", "\"${clientConfig("domaClerkPublishableKey")}\"")
  }

  buildFeatures {
    buildConfig = true
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}

kotlin {
  jvmToolchain(17)
}

dependencies {
  implementation("androidx.core:core-ktx:1.16.0")
  implementation("androidx.activity:activity-ktx:1.10.1")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("com.clerk:clerk-android-api:1.0.36")
  implementation("dev.convex:android-convexmobile:0.8.0")
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.10.0")
}
