package app.tketlon.browser

import java.net.URI
import java.net.URLEncoder

object UrlUtil {
    private val blockedSchemes =
        Regex("^(javascript|file|data|vbscript|blob|about|chrome|content|intent|view-source):", RegexOption.IGNORE_CASE)
    private val httpPrefix = Regex("^https?://", RegexOption.IGNORE_CASE)
    private val hostPattern = Regex("^[^\\s.]+(\\.[^\\s.]+)*\\.[a-z]{2,}$", RegexOption.IGNORE_CASE)
    private const val SEARCH = "https://www.google.com/search?q="

    /** Mengubah input address bar menjadi URL http(s), atau null jika ditolak. */
    fun normalize(raw: String): String? {
        val input = raw.trim()
        if (input.isEmpty() || blockedSchemes.containsMatchIn(input)) return null
        if (httpPrefix.containsMatchIn(input)) return parseHttp(input)
        if (input.none { it.isWhitespace() } && looksLikeHost(input)) return parseHttp("https://$input")
        return SEARCH + URLEncoder.encode(input, "UTF-8")
    }

    fun isAllowedNav(url: String): Boolean = parseHttp(url) != null

    private fun looksLikeHost(s: String): Boolean {
        val host = s.split('/', '?', '#')[0].substringBefore(':')
        return host == "localhost" || hostPattern.matches(host)
    }

    private fun parseHttp(s: String): String? = try {
        val u = URI(s)
        if ((u.scheme == "http" || u.scheme == "https") && !u.host.isNullOrEmpty()) s else null
    } catch (e: Exception) {
        null
    }
}
