package com.doma.widget

import android.content.Context
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.session.GetTokenOptions
import dev.convex.android.AuthProvider

class DomaClerkConvexAuthProvider : AuthProvider<String> {
    private var onIdToken: ((String?) -> Unit)? = null

    override suspend fun login(context: Context, onIdToken: (String?) -> Unit): Result<String> =
        authenticate(onIdToken)

    override suspend fun loginFromCache(onIdToken: (String?) -> Unit): Result<String> =
        authenticate(onIdToken)

    override suspend fun logout(context: Context): Result<Void?> {
        onIdToken?.invoke(null)
        onIdToken = null

        if (Clerk.activeSession == null) return Result.success(null)
        return when (val result = Clerk.auth.signOut()) {
            is ClerkResult.Success -> Result.success(null)
            is ClerkResult.Failure -> Result.failure(result.throwable ?: IllegalStateException("Clerk sign-out failed"))
        }
    }

    override fun extractIdToken(authResult: String): String = authResult

    private suspend fun authenticate(onIdToken: (String?) -> Unit): Result<String> {
        this.onIdToken = onIdToken
        return when (
            val result = Clerk.auth.getToken(
                GetTokenOptions(template = CONVEX_JWT_TEMPLATE, skipCache = true),
            )
        ) {
            is ClerkResult.Success -> {
                onIdToken(result.value)
                Result.success(result.value)
            }

            is ClerkResult.Failure -> {
                onIdToken(null)
                Result.failure(result.throwable ?: IllegalStateException("Clerk token retrieval failed"))
            }
        }
    }

    private companion object {
        const val CONVEX_JWT_TEMPLATE = "convex"
    }
}
