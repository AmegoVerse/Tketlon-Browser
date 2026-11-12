package app.tketlon.browser

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.os.Environment
import android.text.InputType
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.Toast
import java.io.ByteArrayInputStream

class MainActivity : Activity() {
    private val bg = Color.parseColor("#0a1020")
    private val panel = Color.parseColor("#111a30")
    private val textColor = Color.parseColor("#e7ecf8")
    private val mutedColor = Color.parseColor("#8a97b5")

    private lateinit var filter: TrackerFilter
    private lateinit var resetter: IdentityReset
    private val stats = PrivacyStats()

    private val tabs = ArrayList<Tab>()
    private var currentIndex = -1
    private var resetting = false

    private lateinit var content: FrameLayout
    private lateinit var address: EditText
    private lateinit var tabsBtn: Button
    private lateinit var reloadBtn: Button
    private lateinit var backBtn: Button
    private lateinit var fwdBtn: Button

    private var customView: View? = null
    private var customCallback: WebChromeClient.CustomViewCallback? = null

    inner class Tab(val webView: WebView) {
        var title: String = ""
        var loading: Boolean = false

        @Volatile
        var topUrl: String? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = bg
        window.navigationBarColor = bg
        filter = TrackerFilter(this)
        resetter = IdentityReset(this, Canary(this))
        buildUi()
        // Sesi sementara: data WebView sisa dari pemakaian sebelumnya dihapus saat aplikasi dibuka.
        resetter.clearAll(ArrayList()) { newTab(null) }
    }

    // ---------------------------------------------------------------- UI

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    private fun flatButton(label: String, onClick: () -> Unit): Button = Button(this).apply {
        text = label
        isAllCaps = false
        setTextColor(textColor)
        setBackgroundColor(Color.TRANSPARENT)
        minWidth = 0
        minimumWidth = 0
        setPadding(0, 0, 0, 0)
        textSize = 18f
        layoutParams = LinearLayout.LayoutParams(dp(38), dp(44))
        setOnClickListener { onClick() }
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bg)
        }
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(panel)
            setPadding(dp(4), 0, dp(4), 0)
        }
        backBtn = flatButton("\u2190") { currentTab()?.webView?.let { if (it.canGoBack()) it.goBack() } }
        fwdBtn = flatButton("\u2192") { currentTab()?.webView?.let { if (it.canGoForward()) it.goForward() } }
        reloadBtn = flatButton("\u21BB") {
            currentTab()?.webView?.let { if (currentTab()?.loading == true) it.stopLoading() else it.reload() }
        }
        address = EditText(this).apply {
            setSingleLine()
            hint = "Cari atau ketik alamat"
            setTextColor(textColor)
            setHintTextColor(mutedColor)
            textSize = 14f
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            imeOptions = EditorInfo.IME_ACTION_GO
            background = GradientDrawable().apply {
                setColor(bg)
                cornerRadius = dp(19).toFloat()
                setStroke(dp(1), Color.parseColor("#2a3a63"))
            }
            setPadding(dp(14), 0, dp(14), 0)
            layoutParams = LinearLayout.LayoutParams(0, dp(38), 1f).apply { setMargins(dp(4), 0, dp(4), 0) }
            setOnEditorActionListener { v, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_GO) {
                    navigate(v.text.toString())
                    hideKeyboard()
                    v.clearFocus()
                    true
                } else {
                    false
                }
            }
            setOnFocusChangeListener { v, hasFocus -> if (hasFocus) (v as EditText).selectAll() }
        }
        tabsBtn = flatButton("1") { showTabsDialog() }
        val menuBtn = flatButton("\u22EE") { }
        menuBtn.setOnClickListener { showMenu(menuBtn) }

        bar.addView(backBtn)
        bar.addView(fwdBtn)
        bar.addView(reloadBtn)
        bar.addView(address)
        bar.addView(tabsBtn)
        bar.addView(menuBtn)
        root.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)))

        content = FrameLayout(this)
        root.addView(content, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun hideKeyboard() {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(address.windowToken, 0)
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    private fun refreshUi() {
        tabsBtn.text = tabs.size.toString()
        val t = currentTab()
        backBtn.alpha = if (t?.webView?.canGoBack() == true) 1f else 0.35f
        fwdBtn.alpha = if (t?.webView?.canGoForward() == true) 1f else 0.35f
        reloadBtn.text = if (t?.loading == true) "\u2715" else "\u21BB"
        if (!address.hasFocus()) {
            val u = t?.webView?.url ?: ""
            address.setText(if (u.startsWith("file:")) "" else u)
        }
    }

    // ---------------------------------------------------------------- Tabs

    private fun currentTab(): Tab? = tabs.getOrNull(currentIndex)

    @SuppressLint("SetJavaScriptEnabled")
    private fun newTab(url: String?) {
        val wv = WebView(this)
        val tab = Tab(wv)
        wv.setBackgroundColor(bg)
        with(wv.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            setGeolocationEnabled(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = WebSettings.getDefaultUserAgent(this@MainActivity)
                .replace("; wv", "").replace(" Version/4.0", "")
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, false)
        wv.webViewClient = TabClient(tab)
        wv.webChromeClient = TabChrome(tab)
        wv.setDownloadListener { dlUrl, ua, cd, mime, _ -> confirmDownload(dlUrl, ua, cd, mime) }

        tabs.add(tab)
        switchTo(tabs.size - 1)
        if (url != null && UrlUtil.isAllowedNav(url)) wv.loadUrl(url) else wv.loadUrl("file:///android_asset/newtab.html")
    }

    private fun switchTo(index: Int) {
        currentTab()?.webView?.onPause()
        currentIndex = index
        content.removeAllViews()
        val t = currentTab() ?: return
        content.addView(t.webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        t.webView.onResume()
        refreshUi()
    }

    private fun closeTab(index: Int) {
        val t = tabs.getOrNull(index) ?: return
        content.removeAllViews()
        tabs.removeAt(index)
        t.webView.destroy()
        if (tabs.isEmpty()) {
            currentIndex = -1
            newTab(null)
        } else {
            currentIndex = -1
            switchTo(minOf(index, tabs.size - 1))
        }
    }

    private fun closeAllTabs() {
        content.removeAllViews()
        for (t in tabs) t.webView.destroy()
        tabs.clear()
        currentIndex = -1
    }

    private fun navigate(input: String) {
        val url = UrlUtil.normalize(input)
        if (url == null) {
            toast("Alamat tidak didukung (hanya http/https)")
            return
        }
        currentTab()?.webView?.loadUrl(url) ?: newTab(url)
    }

    private fun showTabsDialog() {
        val items = tabs.mapIndexed { i, t ->
            (if (i == currentIndex) "\u25CF " else "    ") + (t.title.ifEmpty { "Tab baru" })
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Tab (${tabs.size})")
            .setItems(items) { _, which -> switchTo(which) }
            .setPositiveButton("Tab baru") { _, _ -> newTab(null) }
            .setNeutralButton("Tutup tab ini") { _, _ -> closeTab(currentIndex) }
            .show()
    }

    // ---------------------------------------------------------------- Menu

    private fun currentHost(): String =
        Uri.parse(currentTab()?.webView?.url ?: "").host ?: ""

    private fun showMenu(anchor: View) {
        val host = currentHost()
        val siteOff = host.isNotEmpty() && filter.isException(host)
        val popup = PopupMenu(this, anchor)
        popup.menu.add(0, 1, 0, "Tab baru")
        popup.menu.add(0, 2, 1, (if (filter.enabled) "Perisai pelacak: aktif" else "Perisai pelacak: mati") + " (${stats.blockedCount()} diblokir)")
        if (host.isNotEmpty()) popup.menu.add(0, 3, 2, if (siteOff) "Batalkan pengecualian $host" else "Matikan perisai untuk $host")
        popup.menu.add(0, 4, 3, "Reset Identity")
        popup.menu.add(0, 5, 4, "Tentang dan batasan")
        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                1 -> newTab(null)
                2 -> { filter.enabled = !filter.enabled; currentTab()?.webView?.reload() }
                3 -> { filter.setException(host, !siteOff); currentTab()?.webView?.reload() }
                4 -> confirmReset()
                5 -> showAbout()
            }
            true
        }
        popup.show()
    }

    private fun showAbout() {
        AlertDialog.Builder(this)
            .setTitle("Tketlon Browser Android 0.1 (pratinjau)")
            .setMessage(
                "- Sesi sementara: data WebView dihapus saat aplikasi dibuka dan saat Reset Identity. " +
                    "Ini bukan penyimpanan di memori seperti versi Windows.\n" +
                    "- Izin lokasi, kamera, dan mikrofon selalu ditolak.\n" +
                    "- Pemblokir pelacak berbasis domain (daftar starter).\n" +
                    "- Cookie pihak ketiga dimatikan; sebagian login atau game bisa terpengaruh.\n" +
                    "- Hanya https yang didukung.\n" +
                    "- Belum ada: kontrol WebRTC, isolasi per situs, unggah file, halaman uji mandiri."
            )
            .setPositiveButton("Tutup", null)
            .show()
    }

    // ---------------------------------------------------------------- Reset Identity

    private fun confirmReset() {
        AlertDialog.Builder(this)
            .setTitle("Reset Identity?")
            .setMessage("Semua tab ditutup dan semua login berakhir. File yang sudah diunduh tidak ikut dihapus.")
            .setNegativeButton("Batal", null)
            .setPositiveButton("Reset Identity") { _, _ -> doReset() }
            .show()
    }

    private fun doReset() {
        if (resetting) return
        resetting = true
        closeAllTabs()
        resetter.run(stats, filter) { text, verified ->
            stats.reset()
            newTab(null)
            resetting = false
            AlertDialog.Builder(this)
                .setTitle(if (verified) "Privacy Receipt: identitas baru siap" else "Privacy Receipt: tidak terverifikasi penuh")
                .setMessage(text)
                .setPositiveButton("Tutup", null)
                .show()
        }
    }

    // ---------------------------------------------------------------- Downloads

    private fun safeName(raw: String): String {
        val n = raw.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim().trimStart('.')
        return if (n.isEmpty()) "unduhan" else n
    }

    private fun confirmDownload(url: String, ua: String?, cd: String?, mime: String?) {
        if (!UrlUtil.isAllowedNav(url)) {
            toast("Unduhan ditolak: alamat tidak didukung")
            return
        }
        val name = safeName(URLUtil.guessFileName(url, cd, mime))
        AlertDialog.Builder(this)
            .setTitle("Unduh file?")
            .setMessage(name + "\n\nDisimpan di folder aplikasi (Android/data/app.tketlon.browser/files/Download). File tidak dibuka otomatis.")
            .setNegativeButton("Batal", null)
            .setPositiveButton("Unduh") { _, _ -> startDownload(url, ua, mime, name) }
            .show()
    }

    private fun startDownload(url: String, ua: String?, mime: String?, name: String) {
        try {
            val req = DownloadManager.Request(Uri.parse(url))
            if (!mime.isNullOrEmpty()) req.setMimeType(mime)
            if (!ua.isNullOrEmpty()) req.addRequestHeader("User-Agent", ua)
            val cookie = CookieManager.getInstance().getCookie(url)
            if (!cookie.isNullOrEmpty()) req.addRequestHeader("Cookie", cookie)
            req.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name)
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            toast("Mengunduh $name")
        } catch (e: Exception) {
            toast("Unduhan gagal: ${e.message}")
        }
    }

    // ---------------------------------------------------------------- WebView clients

    inner class TabClient(private val tab: Tab) : WebViewClient() {
        private fun isCurrent() = tabs.getOrNull(currentIndex) === tab

        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val url = request?.url?.toString() ?: return true
            return !UrlUtil.isAllowedNav(url) // true = batalkan navigasi non-http(s)
        }

        override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
            if (request == null) return null
            val url = request.url.toString()
            if (request.isForMainFrame) {
                tab.topUrl = url
                return null
            }
            val hit = filter.shouldBlock(url, tab.topUrl) ?: return null
            stats.addBlocked(hit)
            return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
        }

        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
            tab.topUrl = url
            tab.loading = true
            if (isCurrent()) refreshUi()
        }

        override fun onPageFinished(view: WebView?, url: String?) {
            tab.loading = false
            if (isCurrent()) refreshUi()
        }

        override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
            if (request?.isForMainFrame == true && view != null) {
                val msg = TextUtils.htmlEncode((error?.description ?: "Kesalahan jaringan").toString())
                view.loadDataWithBaseURL(
                    null,
                    "<html><body style='background:#0a1020;color:#e7ecf8;font-family:sans-serif;padding:24px'>" +
                        "<h2>Halaman tidak dapat dimuat</h2><p>$msg</p></body></html>",
                    "text/html", "utf-8", null
                )
            }
        }

        override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
            handler?.cancel() // sertifikat bermasalah tidak pernah diabaikan
            view?.loadDataWithBaseURL(
                null,
                "<html><body style='background:#0a1020;color:#e7ecf8;font-family:sans-serif;padding:24px'>" +
                    "<h2>Koneksi tidak aman</h2><p>Sertifikat situs tidak valid, sehingga halaman diblokir.</p></body></html>",
                "text/html", "utf-8", null
            )
        }

        override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
            val i = tabs.indexOf(tab)
            toast("Tab berhenti bekerja dan ditutup")
            if (i >= 0) closeTab(i)
            return true
        }
    }

    inner class TabChrome(private val tab: Tab) : WebChromeClient() {
        override fun onReceivedTitle(view: WebView?, title: String?) {
            tab.title = title ?: ""
        }

        override fun onPermissionRequest(request: PermissionRequest?) {
            request?.deny()
            stats.addDenied(request?.resources?.joinToString(",") ?: "unknown")
        }

        override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
            callback?.invoke(origin, false, false)
            stats.addDenied("geolocation")
        }

        override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
            if (view == null || customView != null) {
                callback?.onCustomViewHidden()
                return
            }
            customView = view
            customCallback = callback
            (window.decorView as FrameLayout).addView(
                view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            )
            setImmersive(true)
        }

        override fun onHideCustomView() {
            customView?.let { (window.decorView as FrameLayout).removeView(it) }
            customView = null
            customCallback?.onCustomViewHidden()
            customCallback = null
            setImmersive(false)
        }
    }

    @Suppress("DEPRECATION")
    private fun setImmersive(on: Boolean) {
        window.decorView.systemUiVisibility = if (on) {
            View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        } else {
            View.SYSTEM_UI_FLAG_VISIBLE
        }
    }

    // ---------------------------------------------------------------- Lifecycle

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        val t = currentTab()
        when {
            customView != null -> (t?.webView?.webChromeClient as? TabChrome)?.onHideCustomView()
            t != null && t.webView.canGoBack() -> t.webView.goBack()
            tabs.size > 1 -> closeTab(currentIndex)
            else -> super.onBackPressed()
        }
    }

    override fun onPause() {
        currentTab()?.webView?.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        currentTab()?.webView?.onResume()
    }
}
