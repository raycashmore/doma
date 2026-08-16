package com.doma.widget

import dev.convex.android.ConvexClientWithAuth

object DomaConvexClient {
    fun create(configuration: DomaConfiguration): ConvexClientWithAuth<String> {
        require(configuration.isConfigured) { "Doma Android companion is not configured" }

        return ConvexClientWithAuth(
            deploymentUrl = configuration.convexUrl,
            authProvider = DomaClerkConvexAuthProvider(),
        )
    }
}
