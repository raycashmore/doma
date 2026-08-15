package com.doma.widget

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import java.net.URI

class WidgetLaunchActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val publicId = intent.getStringExtra(WidgetActionParameters.LIST_PUBLIC_ID)
        val slug = intent.getStringExtra(WidgetActionParameters.LIST_SLUG)
        val target = if (publicId == null || slug == null) {
            null
        } else {
            buildListPwaUrl(
                (application as DomaApplication).configuration.listsPwaUrl,
                publicId,
                slug,
            )?.let(Uri::parse)
        }

        if (target == null) {
            Toast.makeText(this, "Add the Lists PWA URL in local.properties.", Toast.LENGTH_LONG).show()
        } else {
            startActivity(Intent(Intent.ACTION_VIEW, target))
        }
        finish()
    }
}

fun buildListPwaUrl(listsPwaUrl: String, publicId: String, slug: String): String? {
    val baseUri = runCatching { URI(listsPwaUrl.trimEnd('/')) }.getOrNull() ?: return null
    if (baseUri.scheme !in setOf("http", "https") || baseUri.host.isNullOrBlank()) return null

    return runCatching {
        URI(
            baseUri.scheme,
            baseUri.rawAuthority,
            "${baseUri.rawPath.orEmpty().trimEnd('/')}/l/$publicId/$slug",
            null,
            null,
        ).toASCIIString()
    }.getOrNull()
}
