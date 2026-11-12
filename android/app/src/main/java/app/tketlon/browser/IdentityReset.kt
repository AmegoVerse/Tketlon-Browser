package app.tketlon.browser

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewDatabase

class IdentityReset(private val ctx: Context, private val canary: Canary) {
    private val main = Handler(Looper.getMainLooper())

    /** Menghapus semua data WebView. Harus dipanggil dari thread utama. */
    fun clearAll(errors: MutableList<String>, done: () -> Unit) {
        val cm = CookieManager.getInstance()
        cm.removeAllCookies { _ ->
            main.post {
                try {
                    cm.flush()
                    WebStorage.getInstance().deleteAllData()
                    GeolocationPermissions.getInstance().clearAll()
                    WebViewDatabase.getInstance(ctx).clearHttpAuthUsernamePassword()
                    val wv = WebView(ctx)
                    wv.clearCache(true)
                    wv.clearHistory()
                    wv.clearFormData()
                    wv.destroy()
                } catch (e: Exception) {
                    errors.add("Pembersihan: ${e.message}")
                }
                done()
            }
        }
    }

    fun run(stats: PrivacyStats, filter: TrackerFilter, onDone: (String, Boolean) -> Unit) {
        val t0 = SystemClock.elapsedRealtime()
        val snap = stats.snapshot()
        val cm = CookieManager.getInstance()
        val cookiesBefore = cm.hasCookies()
        val errors = ArrayList<String>()
        var canaryResult: Canary.Result? = null
        var canaryError: String? = null

        fun finish() {
            val cookiesAfter = cm.hasCookies()
            if (cookiesAfter) errors.add("Masih ada cookie setelah penghapusan")
            val verified = errors.isEmpty() && canaryResult?.ok == true
            val text = buildReceipt(
                SystemClock.elapsedRealtime() - t0, cookiesBefore, cookiesAfter,
                snap, filter, canaryResult, canaryError, errors
            )
            onDone(text, verified)
        }

        canary.write { written, werr ->
            if (werr != null) {
                canaryError = "Menulis penanda: $werr"
                errors.add("Uji kanari tidak dapat dijalankan: $werr")
            }
            clearAll(errors) {
                if (written == null) {
                    finish()
                } else {
                    canary.check { found, cerr ->
                        if (found == null) {
                            canaryError = "Memeriksa penanda: $cerr"
                            errors.add("Uji kanari tidak dapat diselesaikan: $cerr")
                        } else {
                            val r = Canary.evaluate(written, found)
                            canaryResult = r
                            if (r.stillFound.isNotEmpty()) errors.add("Penanda masih ada: ${r.stillFound.joinToString(", ")}")
                            if (r.notTested.isNotEmpty()) errors.add("Tidak dapat diuji: ${r.notTested.joinToString(", ")}")
                        }
                        clearAll(errors) { finish() }
                    }
                }
            }
        }
    }

    private fun buildReceipt(
        ms: Long, before: Boolean, after: Boolean, snap: PrivacyStats.Snapshot,
        filter: TrackerFilter, canaryResult: Canary.Result?, canaryError: String?, errors: List<String>
    ): String {
        val sb = StringBuilder()
        sb.append("Sesi diganti (").append(ms).append(" ms)\n\n")
        sb.append("Cookie sebelum: ").append(if (before) "ada" else "tidak ada")
            .append(", sesudah: ").append(if (after) "MASIH ADA" else "tidak ada (terverifikasi)").append("\n\n")
        sb.append("Pembersihan: cookie, WebStorage, cache, riwayat, kredensial HTTP, izin lokasi\n\n")
        if (filter.loadError != null) {
            sb.append("Pemblokir pelacak: GAGAL memuat daftar (").append(filter.loadError).append(")\n")
        } else if (!filter.enabled) {
            sb.append("Pemblokir pelacak: dinonaktifkan pengguna\n")
        } else {
            sb.append("Pemblokir pelacak: ").append(snap.blocked).append(" permintaan diblokir (daftar ")
                .append(filter.domains.size).append(" domain)\n")
            if (snap.top.isNotEmpty()) {
                sb.append("Teratas: ").append(snap.top.joinToString(", ") { "${it.first} x${it.second}" }).append("\n")
            }
        }
        sb.append(
            if (snap.denied.isEmpty()) "Izin ditolak: tidak ada permintaan\n"
            else "Izin ditolak: " + snap.denied.entries.joinToString(", ") { "${it.key} x${it.value}" } + "\n"
        )
        sb.append("\n")
        if (canaryResult != null) {
            sb.append("Uji kanari (penanda ditulis lalu dihapus):\n")
            for (i in canaryResult.items) {
                val mark = if (!i.written) "[?]" else if (i.found) "[GAGAL]" else "[OK]"
                val note = if (!i.written) "tidak dapat diuji" else if (i.found) "penanda MASIH ADA" else "penanda terhapus"
                sb.append(mark).append(' ').append(i.label).append(": ").append(note).append("\n")
            }
        } else {
            sb.append("Uji kanari: TIDAK DAPAT DIJALANKAN")
            if (canaryError != null) sb.append(" (").append(canaryError).append(")")
            sb.append(". Penghapusan storage belum terverifikasi.\n")
        }
        if (errors.isNotEmpty()) {
            sb.append("\nMasalah:\n")
            for (e in errors) sb.append("- ").append(e).append("\n")
        }
        sb.append("\nCatatan: service worker tidak diuji di Android. Android WebView tidak punya profil terpisah, ")
            .append("jadi penghapusan memakai API WebView. File unduhan dan data yang sudah terkirim ke situs tidak ikut terhapus.")
        return sb.toString()
    }
}
