package com.doma.widget

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class DomaFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        WidgetRefreshWork.enqueueNow(this)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        if (message.data[INVALIDATION_TYPE_KEY] != INVALIDATION_TYPE) return

        WidgetRefreshWork.enqueueNow(this)
    }

    private companion object {
        const val INVALIDATION_TYPE_KEY = "type"
        const val INVALIDATION_TYPE = "widget_invalidated"
    }
}
