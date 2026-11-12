package app.tketlon.browser

import android.content.Context
import android.net.Uri
import java.util.concurrent.ConcurrentHashMap

/** Pemblokir domain sederhana. Dipanggil dari thread latar WebView, jadi semua struktur thread-safe. */
class TrackerFilter(context: Context) {
    @Volatile
    var enabled: Boolean = true
    val domains: MutableSet<String> = ConcurrentHashMap.newKeySet<String>()
    private val exceptions: MutableSet<String> = ConcurrentHashMap.newKeySet<String>()

    var loadError: String? = null
        private set

    init {
        try {
            context.assets.open("default_filters.txt").bufferedReader().useLines { lines ->
                for (line in lines) {
                    val d = line.substringBefore('#').trim().lowercase()
                    if (DOMAIN.matches(d)) domains.add(d)
                }
            }
        } catch (e: Exception) {
            loadError = e.message ?: "gagal memuat daftar"
        }
    }

    private fun walk(host: String, set: Set<String>): String? {
        var h = host.lowercase()
        while (h.contains('.')) {
            if (set.contains(h)) return h
            h = h.substringAfter('.')
        }
        return null
    }

    fun isException(topHost: String): Boolean = walk(topHost, exceptions) != null

    fun setException(host: String, on: Boolean) {
        if (on) exceptions.add(host.lowercase()) else exceptions.remove(host.lowercase())
    }

    /** Mengembalikan domain daftar yang cocok, atau null jika permintaan boleh lewat. */
    fun shouldBlock(requestUrl: String, topUrl: String?): String? {
        if (!enabled) return null
        val host = Uri.parse(requestUrl).host ?: return null
        val top = if (topUrl == null) "" else (Uri.parse(topUrl).host ?: "")
        if (top.isNotEmpty() && isException(top)) return null
        val hit = walk(host, domains) ?: return null
        if (top.isNotEmpty() && (top == hit || top.endsWith(".$hit"))) return null // first-party
        return hit
    }

    companion object {
        private val DOMAIN = Regex("^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$")
    }
}

class PrivacyStats {
    data class Snapshot(val blocked: Int, val top: List<Pair<String, Int>>, val denied: Map<String, Int>)

    private var blocked = 0
    private val byDomain = HashMap<String, Int>()
    private val denied = HashMap<String, Int>()

    @Synchronized
    fun addBlocked(domain: String) {
        blocked++
        byDomain[domain] = (byDomain[domain] ?: 0) + 1
    }

    @Synchronized
    fun addDenied(permission: String) {
        denied[permission] = (denied[permission] ?: 0) + 1
    }

    @Synchronized
    fun blockedCount(): Int = blocked

    @Synchronized
    fun reset() {
        blocked = 0
        byDomain.clear()
        denied.clear()
    }

    @Synchronized
    fun snapshot(): Snapshot = Snapshot(
        blocked,
        byDomain.entries.sortedByDescending { it.value }.take(5).map { it.key to it.value },
        HashMap(denied)
    )
}
