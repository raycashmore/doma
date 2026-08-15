package com.doma.widget

data class DomaConfiguration(
    val convexUrl: String,
    val clerkPublishableKey: String,
    val listsPwaUrl: String,
) {
    val isConfigured: Boolean
        get() = convexUrl.isNotBlank() && clerkPublishableKey.isNotBlank()

    companion object {
        fun fromBuildConfig(): DomaConfiguration = DomaConfiguration(
            convexUrl = BuildConfig.DOMA_CONVEX_URL,
            clerkPublishableKey = BuildConfig.DOMA_CLERK_PUBLISHABLE_KEY,
            listsPwaUrl = BuildConfig.DOMA_LISTS_PWA_URL,
        )
    }
}
