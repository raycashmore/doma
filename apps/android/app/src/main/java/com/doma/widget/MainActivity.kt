package com.doma.widget

import android.os.Bundle
import android.widget.TextView
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val application = application as DomaApplication
        setContentView(
            TextView(this).apply {
                text = if (application.configuration.isConfigured) {
                    "Doma Android companion is ready for sign-in."
                } else {
                    "Add Doma client configuration to local.properties."
                }
            },
        )
    }
}
