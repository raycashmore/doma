package com.doma.widget

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.glance.appwidget.GlanceAppWidgetManager
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.network.serialization.shortErrorMessageOrNull
import com.clerk.api.signin.SignIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import androidx.lifecycle.lifecycleScope

class WidgetConfigurationActivity : ComponentActivity() {
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private lateinit var progress: ProgressBar
    private lateinit var domaApplication: DomaApplication
    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)

        appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        domaApplication = application as DomaApplication
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(48, 64, 48, 48)
        }
        setContentView(content)
        showStartingState()
    }

    private fun showStartingState() {
        content.removeAllViews()
        addTitle("Choose a Doma list")
        status = addStatus("Checking your Doma session…")
        progress = ProgressBar(this).also(content::addView)

        lifecycleScope.launch {
            if (!domaApplication.configuration.isConfigured) {
                showError("Add Doma client configuration to local.properties.")
                return@launch
            }

            if (!Clerk.isInitialized.value && Clerk.initializationError.value != null) {
                Clerk.reinitialize()
            }
            val initializationError = awaitClerkInitialization()
            if (initializationError != null) {
                showError(
                    "Doma sign-in could not start. Enable Clerk Native API in the Clerk Dashboard, then try again.",
                )
                return@launch
            }

            if (Clerk.activeSession == null || domaApplication.convexClient.loginFromCache().isFailure) {
                showSignIn()
            } else {
                loadLists()
            }
        }
    }

    private suspend fun awaitClerkInitialization(): Throwable? =
        combine(Clerk.isInitialized, Clerk.initializationError) { initialized, error -> initialized to error }
            .first { (initialized, error) -> initialized || error != null }
            .second

    private fun showSignIn(message: String? = null) {
        content.removeAllViews()
        addTitle("Sign in to Doma")
        addStatus(message ?: "Use an approved Google account to choose the list for this widget.")
        addButton("Continue with Google") {
            signInWithGoogle()
        }
    }

    private fun signInWithGoogle() {
        content.removeAllViews()
        addTitle("Sign in to Doma")
        status = addStatus("Opening Google sign-in…")
        progress = ProgressBar(this).also(content::addView)

        lifecycleScope.launch {
            val result = runCatching {
                SignIn.authenticateWithGoogleOneTap(transferable = false)
            }.getOrElse { error ->
                showSignIn(googleSignInErrorMessage(error))
                return@launch
            }

            when (result) {
                is ClerkResult.Success -> {
                    val sessionId = result.value.signIn?.createdSessionId ?: result.value.signUp?.createdSessionId
                    if (sessionId == null) {
                        showSignIn("Google did not complete a Doma session. Try again.")
                        return@launch
                    }
                    when (val activeSession = Clerk.auth.setActive(sessionId)) {
                        is ClerkResult.Success -> {
                            if (domaApplication.convexClient.loginFromCache().isSuccess) {
                                loadLists()
                            } else {
                                showSignIn("Doma could not verify this account with Convex.")
                            }
                        }

                        is ClerkResult.Failure -> showSignIn(activeSession.shortErrorMessageOrNull())
                    }
                }

                is ClerkResult.Failure -> showSignIn(result.shortErrorMessageOrNull())
            }
        }
    }

    private fun loadLists() {
        content.removeAllViews()
        addTitle("Choose a Doma list")
        status = addStatus("Loading visible lists…")
        progress = ProgressBar(this).also(content::addView)

        lifecycleScope.launch {
            domaApplication.widgetSnapshotRepository.visibleLists().fold(
                onSuccess = { lists -> showListChoices(lists) },
                onFailure = { showError("Could not load your Doma lists. Check your connection and try again.") },
            )
        }
    }

    private fun showListChoices(lists: List<WidgetVisibleList>) {
        content.removeAllViews()
        addTitle("Choose a Doma list")
        if (lists.isEmpty()) {
            addStatus("No visible lists are available for this account.")
            return
        }
        addStatus("Each widget can show a different list.")
        lists.forEach { list ->
            addButton(list.name) {
                chooseList(list)
            }
        }
    }

    private fun chooseList(list: WidgetVisibleList) {
        content.removeAllViews()
        addTitle("Setting up ${list.name}")
        status = addStatus("Saving the latest active items…")
        progress = ProgressBar(this).also(content::addView)

        lifecycleScope.launch {
            domaApplication.widgetStateStore.selectList(WidgetListSelection(appWidgetId, list.publicId))
            when (domaApplication.widgetSnapshotRepository.refreshList(list.publicId)) {
                SnapshotRefreshResult.Unavailable -> {
                    updateAllWidgets()
                    showError("List unavailable. Choose another list.")
                }

                SnapshotRefreshResult.TransientFailure -> {
                    if (domaApplication.widgetStateStore.readSnapshot(list.publicId) == null) {
                        showError("Could not load the latest list items. Check your connection and try again.")
                    } else {
                        updateWidget()
                        finishConfiguration()
                    }
                }

                is SnapshotRefreshResult.Available -> {
                    updateWidget()
                    finishConfiguration()
                }
            }
        }
    }

    private suspend fun updateWidget() {
        val glanceId = GlanceAppWidgetManager(this).getGlanceIdBy(appWidgetId)
        DomaListWidget().update(this, glanceId)
    }

    private suspend fun updateAllWidgets() {
        val manager = GlanceAppWidgetManager(this)
        manager.getGlanceIds(DomaListWidget::class.java).forEach { glanceId ->
            DomaListWidget().update(this, glanceId)
        }
    }

    private fun finishConfiguration() {
        WidgetRefreshWork.enqueueNow(this)
        setResult(
            RESULT_OK,
            Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId),
        )
        finish()
    }

    private fun showError(message: String) {
        content.removeAllViews()
        addTitle("Doma widget")
        addStatus(message)
        addButton("Try again") { showStartingState() }
    }

    private fun addTitle(text: String) {
        content.addView(
            TextView(this).apply {
                this.text = text
                textSize = 24f
            },
        )
    }

    private fun addStatus(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 16f
        setPadding(0, 24, 0, 24)
        content.addView(this)
    }

    private fun addButton(text: String, onClick: (View) -> Unit) {
        content.addView(Button(this).apply {
            this.text = text
            setOnClickListener(onClick)
        })
    }
}

fun googleSignInErrorMessage(error: Throwable): String =
    if (error.message?.contains("Google One Tap Client ID") == true) {
        "Google sign-in is not configured for this Clerk environment."
    } else {
        "Google sign-in could not start. Try again."
    }
