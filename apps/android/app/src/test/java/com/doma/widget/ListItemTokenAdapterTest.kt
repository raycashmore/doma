package com.doma.widget

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

class ListItemTokenAdapterTest {
    @Test
    fun `generated Android roles reach native list item color and dp adapter`() {
        assertEquals(Color(0xFF2E1E19), ListItemTokenAdapter.contentColor)
        assertEquals(7.0f, ListItemTokenAdapter.contentGap.value)
    }
}
