package com.doma.widget

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class WidgetListSelection(
    val appWidgetId: Int,
    val listPublicId: String,
)

@Serializable
data class WidgetSnapshotItem(
    val id: String,
    val title: String,
)

@Serializable
data class WidgetSnapshotList(
    val publicId: String,
    val name: String,
    val slug: String,
)

@Serializable
data class WidgetSnapshot(
    val list: WidgetSnapshotList,
    val activeItems: List<WidgetSnapshotItem>,
    val refreshedAt: Long,
)

@Serializable
data class WidgetSnapshotProjection(
    val list: WidgetSnapshotList,
    val activeItems: List<WidgetSnapshotItem>,
)

fun WidgetSnapshotProjection.toStoredSnapshot(refreshedAt: Long): WidgetSnapshot = WidgetSnapshot(
    list = list,
    activeItems = activeItems,
    refreshedAt = refreshedAt,
)

@Serializable
private data class WidgetState(
    val installationId: String,
    val selections: List<WidgetListSelection> = emptyList(),
    val snapshots: List<WidgetSnapshot> = emptyList(),
    val unavailableWidgetIds: List<Int> = emptyList(),
)

class WidgetStateStore(context: Context) {
    private val applicationContext = context.applicationContext
    private val stateFile = AtomicFile(applicationContext.filesDir.resolve("widget-state.bin"))
    private val json = Json { ignoreUnknownKeys = false }

    @Synchronized
    fun installationId(): String {
        val state = readState() ?: WidgetState(installationId = UUID.randomUUID().toString())
        writeState(state)
        return state.installationId
    }

    @Synchronized
    fun readSelections(): List<WidgetListSelection> = readState()?.selections.orEmpty()

    @Synchronized
    fun readSelection(appWidgetId: Int): WidgetListSelection? =
        readState()?.selections?.firstOrNull { selection -> selection.appWidgetId == appWidgetId }

    @Synchronized
    fun isUnavailable(appWidgetId: Int): Boolean =
        readState()?.unavailableWidgetIds?.contains(appWidgetId) == true

    @Synchronized
    fun readSnapshot(listPublicId: String): WidgetSnapshot? =
        readState()?.snapshots?.firstOrNull { snapshot -> snapshot.list.publicId == listPublicId }

    @Synchronized
    fun selectList(selection: WidgetListSelection) {
        val state = stateOrNew()
        val selections = selectWidgetList(state.selections, selection)
        writeState(
            state.copy(
                selections = selections,
                unavailableWidgetIds = state.unavailableWidgetIds.filterNot { id -> id == selection.appWidgetId },
            ),
        )
    }

    @Synchronized
    fun saveSnapshot(snapshot: WidgetSnapshot) {
        val state = stateOrNew()
        val snapshots = state.snapshots.filterNot { item -> item.list.publicId == snapshot.list.publicId } + snapshot
        writeState(state.copy(snapshots = snapshots))
    }

    @Synchronized
    fun clearWidget(appWidgetId: Int) {
        val state = readState() ?: return
        val selection = state.selections.firstOrNull { item -> item.appWidgetId == appWidgetId }
        val selections = removeWidgetList(state.selections, appWidgetId)
        val snapshots = if (selection == null || selections.any { it.listPublicId == selection.listPublicId }) {
            state.snapshots
        } else {
            state.snapshots.filterNot { item -> item.list.publicId == selection.listPublicId }
        }
        writeState(
            state.copy(
                selections = selections,
                snapshots = snapshots,
                unavailableWidgetIds = state.unavailableWidgetIds.filterNot { id -> id == appWidgetId },
            ),
        )
    }

    @Synchronized
    fun clearUnavailableList(listPublicId: String) {
        val state = readState() ?: return
        val unavailableWidgets = state.selections
            .filter { selection -> selection.listPublicId == listPublicId }
            .map { selection -> selection.appWidgetId }
        writeState(
            state.copy(
                selections = state.selections.filterNot { selection -> selection.listPublicId == listPublicId },
                snapshots = state.snapshots.filterNot { snapshot -> snapshot.list.publicId == listPublicId },
                unavailableWidgetIds = (state.unavailableWidgetIds + unavailableWidgets).distinct(),
            ),
        )
    }

    @Synchronized
    fun clear() {
        stateFile.delete()
    }

    private fun stateOrNew(): WidgetState = readState() ?: WidgetState(installationId = UUID.randomUUID().toString())

    private fun readState(): WidgetState? = runCatching {
        if (!stateFile.baseFile.exists()) return null
        val encrypted = stateFile.openRead().use { stream -> stream.readBytes() }
        json.decodeFromString<WidgetState>(decrypt(encrypted))
    }.getOrNull()

    private fun writeState(state: WidgetState) {
        val stream = stateFile.startWrite()
        try {
            stream.write(encrypt(json.encodeToString(state)))
            stateFile.finishWrite(stream)
        } catch (exception: Exception) {
            stateFile.failWrite(stream)
            throw exception
        }
    }

    private fun encrypt(value: String): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
        return cipher.iv + cipher.doFinal(value.encodeToByteArray())
    }

    private fun decrypt(value: ByteArray): String {
        require(value.size > IV_SIZE_BYTES) { "Encrypted widget state is invalid" }
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            encryptionKey(),
            GCMParameterSpec(TAG_SIZE_BITS, value.copyOfRange(0, IV_SIZE_BYTES)),
        )
        return cipher.doFinal(value.copyOfRange(IV_SIZE_BYTES, value.size)).decodeToString()
    }

    private fun encryptionKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        val existingKey = keyStore.getKey(KEY_ALIAS, null)
        if (existingKey is SecretKey) return existingKey

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        keyGenerator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return keyGenerator.generateKey()
    }

    private companion object {
        const val KEY_ALIAS = "doma_widget_state"
        const val KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_SIZE_BYTES = 12
        const val TAG_SIZE_BITS = 128
    }
}
