import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.plugin.compose")
  id("org.jetbrains.kotlin.plugin.serialization")
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
    minSdk = 26
    targetSdk = 37
    versionCode = 1
    versionName = "0.1.0"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    buildConfigField("String", "DOMA_CONVEX_URL", "\"${clientConfig("domaConvexUrl")}\"")
    buildConfigField("String", "DOMA_CLERK_PUBLISHABLE_KEY", "\"${clientConfig("domaClerkPublishableKey")}\"")
    buildConfigField("String", "DOMA_LISTS_PWA_URL", "\"${clientConfig("domaListsPwaUrl")}\"")
    buildConfigField("String", "DOMA_FIREBASE_APPLICATION_ID", "\"${clientConfig("domaFirebaseApplicationId")}\"")
    buildConfigField("String", "DOMA_FIREBASE_PROJECT_ID", "\"${clientConfig("domaFirebaseProjectId")}\"")
    buildConfigField("String", "DOMA_FIREBASE_API_KEY", "\"${clientConfig("domaFirebaseApiKey")}\"")
    buildConfigField("String", "DOMA_FIREBASE_SENDER_ID", "\"${clientConfig("domaFirebaseSenderId")}\"")
  }

  buildFeatures {
    buildConfig = true
    compose = true
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.16.0")
  implementation("androidx.activity:activity-ktx:1.10.1")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("androidx.glance:glance-appwidget:1.1.1")
  implementation("androidx.work:work-runtime-ktx:2.10.1")
  implementation("com.clerk:clerk-android-api:1.0.36")
  implementation("dev.convex:android-convexmobile:0.8.0")
  implementation("com.google.firebase:firebase-messaging:24.1.2")
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.10.0")
  testImplementation("junit:junit:4.13.2")
}
