package app.tketlon.browser

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

class Bridge(private val onReport: (String) -> Unit) {
    @JavascriptInterface
    fun report(json: String) {
        onReport(json)
    }
}

/**
 * Uji kanari: menulis penanda uji ke penyimpanan WebView, lalu (setelah dihapus) memeriksa apakah masih ada.
 * Jenis yang tidak dapat ditulis dilaporkan "tidak dapat diuji", bukan dianggap berhasil.
 */
class Canary(private val ctx: Context) {
    data class Item(val key: String, val label: String, val written: Boolean, val found: Boolean)
    data class Result(val items: List<Item>, val stillFound: List<String>, val notTested: List<String>) {
        val ok: Boolean get() = stillFound.isEmpty() && notTested.isEmpty()
    }

    private val main = Handler(Looper.getMainLooper())

    fun write(cb: (Map<String, Boolean>?, String?) -> Unit) = runScript(WRITE_JS, cb)
    fun check(cb: (Map<String, Boolean>?, String?) -> Unit) = runScript(CHECK_JS, cb)

    @SuppressLint("SetJavaScriptEnabled")
    private fun runScript(script: String, cb: (Map<String, Boolean>?, String?) -> Unit) {
        val wv = WebView(ctx)
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        var finished = false
        var started = false
        var timeout: Runnable? = null

        fun finish(res: Map<String, Boolean>?, err: String?) {
            if (finished) return
            finished = true
            timeout?.let { main.removeCallbacks(it) }
            wv.destroy()
            cb(res, err)
        }

        wv.addJavascriptInterface(Bridge { json ->
            main.post {
                try {
                    val obj = JSONObject(json)
                    val m = HashMap<String, Boolean>()
                    for ((k, _) in KEYS) m[k] = obj.optBoolean(k, false)
                    finish(m, null)
                } catch (e: Exception) {
                    finish(null, "balasan tidak valid")
                }
            }
        }, "TK")

        wv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                if (!started) {
                    started = true
                    view?.evaluateJavascript(script, null)
                }
            }
        }

        timeout = Runnable { finish(null, "waktu habis") }
        main.postDelayed(timeout!!, 12000)
        wv.loadDataWithBaseURL(BASE_URL, "<!doctype html><title>kanari</title>", "text/html", "utf-8", null)
    }

    companion object {
        const val BASE_URL = "https://canary.tketlon.invalid/"
        val KEYS = listOf(
            "cookie" to "Cookie",
            "localStorage" to "localStorage",
            "indexedDB" to "IndexedDB",
            "cacheStorage" to "Cache Storage"
        )

        fun evaluate(written: Map<String, Boolean>, found: Map<String, Boolean>): Result {
            val items = KEYS.map { (k, label) ->
                Item(k, label, written[k] == true, found[k] == true)
            }
            return Result(
                items,
                items.filter { it.written && it.found }.map { it.label },
                items.filter { !it.written }.map { it.label }
            )
        }

        private const val WRITE_JS = """(async () => {
  const r = {};
  try { document.cookie = 'tk_canary=1; path=/; max-age=86400'; r.cookie = document.cookie.includes('tk_canary'); } catch (e) { r.cookie = false; }
  try { localStorage.setItem('tk_canary', '1'); r.localStorage = localStorage.getItem('tk_canary') === '1'; } catch (e) { r.localStorage = false; }
  try {
    await new Promise((res, rej) => {
      const q = indexedDB.open('tk_canary', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('s');
      q.onsuccess = () => {
        const db = q.result; const tx = db.transaction('s', 'readwrite');
        tx.objectStore('s').put('1', 'k');
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
      q.onerror = () => rej(q.error);
    });
    r.indexedDB = true;
  } catch (e) { r.indexedDB = false; }
  try { const c = await caches.open('tk_canary'); await c.put('/tk_canary', new Response('1')); r.cacheStorage = await caches.has('tk_canary'); } catch (e) { r.cacheStorage = false; }
  TK.report(JSON.stringify(r));
})()"""

        private const val CHECK_JS = """(async () => {
  const f = {};
  try { f.cookie = document.cookie.includes('tk_canary'); } catch (e) { f.cookie = false; }
  try { f.localStorage = localStorage.getItem('tk_canary') !== null; } catch (e) { f.localStorage = false; }
  try {
    f.indexedDB = await new Promise((res) => {
      let existed = true;
      const q = indexedDB.open('tk_canary');
      q.onupgradeneeded = () => { existed = false; };
      q.onsuccess = () => {
        const db = q.result; const has = db.objectStoreNames.contains('s'); db.close();
        if (!existed) indexedDB.deleteDatabase('tk_canary');
        res(has);
      };
      q.onerror = () => res(false);
    });
  } catch (e) { f.indexedDB = false; }
  try { f.cacheStorage = await caches.has('tk_canary'); } catch (e) { f.cacheStorage = false; }
  TK.report(JSON.stringify(f));
})()"""
    }
}
