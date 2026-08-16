package com.doma.widget

import com.google.firebase.FirebaseOptions

data class DomaFirebaseConfiguration(
    val applicationId: String,
    val projectId: String,
    val apiKey: String,
    val senderId: String,
) {
    val isConfigured: Boolean
        get() = applicationId.isNotBlank() && projectId.isNotBlank() && apiKey.isNotBlank() && senderId.isNotBlank()

    fun firebaseOptions(): FirebaseOptions = FirebaseOptions.Builder()
        .setApplicationId(applicationId)
        .setProjectId(projectId)
        .setApiKey(apiKey)
        .setGcmSenderId(senderId)
        .build()
}

data class DomaConfiguration(
    val convexUrl: String,
    val clerkPublishableKey: String,
    val listsPwaUrl: String,
    val firebase: DomaFirebaseConfiguration,
) {
    val isConfigured: Boolean
        get() = convexUrl.isNotBlank() && clerkPublishableKey.isNotBlank()

    companion object {
        fun fromBuildConfig(): DomaConfiguration = DomaConfiguration(
            convexUrl = BuildConfig.DOMA_CONVEX_URL,
            clerkPublishableKey = BuildConfig.DOMA_CLERK_PUBLISHABLE_KEY,
            listsPwaUrl = BuildConfig.DOMA_LISTS_PWA_URL,
            firebase = DomaFirebaseConfiguration(
                applicationId = BuildConfig.DOMA_FIREBASE_APPLICATION_ID,
                projectId = BuildConfig.DOMA_FIREBASE_PROJECT_ID,
                apiKey = BuildConfig.DOMA_FIREBASE_API_KEY,
                senderId = BuildConfig.DOMA_FIREBASE_SENDER_ID,
            ),
        )
    }
}
