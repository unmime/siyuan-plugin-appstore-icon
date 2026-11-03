const {Plugin, Dialog, Menu, Setting, showMessage, getAllEditor} = require("siyuan");

const ITUNES_API = "https://itunes.apple.com/search";
const EMOJI_GROUP = "appstore";
const ICON_SIZE = 256;
const SEARCH_LIMIT = 36;
const STORAGE = "settings";
const RECENT_KEY = "asi-recent";

const HOTKEY = "⌥⇧A";

const DEFAULT_CONF = {
    country: "cn",
    rounded: true,
    recentLimit: 12,
    showBreadcrumb: true,
    showStatusBar: false,
};

const COUNTRIES = [
    {code: "cn", label: "中国大陆"},
    {code: "hk", label: "中国香港"},
    {code: "tw", label: "中国台湾"},
    {code: "us", label: "美国"},
    {code: "jp", label: "日本"},
    {code: "gb", label: "英国"},
];

class AppStoreIconPlugin extends Plugin {
    async onload() {
        const saved = await this.loadData(STORAGE).catch(() => null);
        this.conf = Object.assign({}, DEFAULT_CONF, saved || {});
        this.dialog = null;
        this.results = [];
        this.recent = this.readRecent();
        this.downloaded = new Set();
        this.busy = false;

        this.addIcons(`<symbol id="iconAppstoreMark" viewBox="0 0 32 32">
<rect x="4.5" y="4.5" width="23" height="23" rx="6.5" fill="none" stroke="currentColor" stroke-width="2"/>
<circle cx="14.8" cy="14.8" r="4.1" fill="none" stroke="currentColor" stroke-width="2"/>
<path d="M18 18 L21.4 21.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</symbol>`);

        try {
            this.addTopBar({
                icon: "iconAppstoreMark",
                title: this.i18n.pluginName,
                position: "right",
                callback: () => this.openPanel(),
            });
        } catch (err) {
            console.error("appstore-icon topbar failed", err);
        }

        this.addToolbarItem({
            name: "appstore-icon",
            icon: "iconAppstoreMark",
            tipPosition: "n",
            tip: this.i18n.pluginName,
            click: (protyle) => {
                this.activeProtyle = protyle;
                this.openPanel();
            },
        });

        this.syncInjections();

        try {
            this.addCommand({
                langKey: "openPanel",
                hotkey: HOTKEY,
                callback: () => this.openPanel(),
            });
        } catch (err) {
            this.addCommand({
                langKey: "openPanel",
                callback: () => this.openPanel(),
            });
        }

        this.initSetting();
    }

    onunload() {
        this.closePanel();
        this.syncInjections(true);
    }

    syncInjections(forceRemove) {
        const wantBreadcrumb = !forceRemove && !!this.conf.showBreadcrumb;
        if (wantBreadcrumb && !this.breadcrumbAdded) {
            this.addBreadcrumbButton({
                id: "appstore-icon",
                icon: "iconAppstoreMark",
                title: this.i18n.pluginName,
                callback: (event, protyle) => {
                    event.preventDefault();
                    this.activeProtyle = protyle;
                    this.openPanel();
                },
            });
            this.breadcrumbAdded = true;
        } else if (!wantBreadcrumb && this.breadcrumbAdded) {
            this.removeBreadcrumbButton("appstore-icon");
            this.breadcrumbAdded = false;
        }

        const wantStatus = !forceRemove && !!this.conf.showStatusBar;
        if (wantStatus && !this.statusElement) {
            const el = document.createElement("div");
            el.className = "asi-statusbar b3-tooltips b3-tooltips__n";
            el.setAttribute("aria-label", this.i18n.pluginName);
            el.innerHTML = `<svg><use xlink:href="#iconAppstoreMark"></use></svg>`;
            el.addEventListener("click", () => this.openPanel());
            this.addStatusBar({element: el});
            this.statusElement = el;
        } else if (!wantStatus && this.statusElement) {
            this.statusElement.remove();
            this.statusElement = null;
        }
    }

    /* ── 设置 ── */

    initSetting() {
        const countrySelect = document.createElement("select");
        countrySelect.className = "b3-select fn__block";
        COUNTRIES.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.code;
            option.textContent = item.label;
            option.selected = item.code === this.conf.country;
            countrySelect.appendChild(option);
        });

        const roundedInput = document.createElement("input");
        roundedInput.type = "checkbox";
        roundedInput.className = "b3-switch fn__flex-center";
        roundedInput.checked = !!this.conf.rounded;

        const recentInput = document.createElement("input");
        recentInput.type = "number";
        recentInput.min = "0";
        recentInput.max = "20";
        recentInput.className = "b3-text-field fn__flex-center fn__size200";
        recentInput.value = String(this.conf.recentLimit);

        const breadcrumbInput = document.createElement("input");
        breadcrumbInput.type = "checkbox";
        breadcrumbInput.className = "b3-switch fn__flex-center";
        breadcrumbInput.checked = !!this.conf.showBreadcrumb;

        const statusInput = document.createElement("input");
        statusInput.type = "checkbox";
        statusInput.className = "b3-switch fn__flex-center";
        statusInput.checked = !!this.conf.showStatusBar;

        this.setting = new Setting({
            confirmCallback: () => {
                this.conf.country = countrySelect.value;
                this.conf.rounded = roundedInput.checked;
                this.conf.recentLimit = Math.min(20, Math.max(0, Number(recentInput.value) || 0));
                this.conf.showBreadcrumb = breadcrumbInput.checked;
                this.conf.showStatusBar = statusInput.checked;
                this.saveData(STORAGE, this.conf).catch((err) => {
                    showMessage("save settings failed: " + err);
                });
                this.syncInjections();
                showMessage(this.i18n.savedTip);
            },
        });

        this.setting.addItem({
            title: this.i18n.setCountry,
            direction: "row",
            description: this.i18n.setCountryDesc,
            createActionElement: () => countrySelect,
        });
        this.setting.addItem({
            title: this.i18n.setRounded,
            direction: "row",
            description: this.i18n.setRoundedDesc,
            createActionElement: () => roundedInput,
        });
        this.setting.addItem({
            title: this.i18n.setRecent,
            direction: "row",
            description: this.i18n.setRecentDesc,
            createActionElement: () => recentInput,
        });
        this.setting.addItem({
            title: this.i18n.setBreadcrumb,
            direction: "row",
            description: this.i18n.setBreadcrumbDesc,
            createActionElement: () => breadcrumbInput,
        });
        this.setting.addItem({
            title: this.i18n.setStatusBar,
            direction: "row",
            description: this.i18n.setStatusBarDesc,
            createActionElement: () => statusInput,
        });
    }

    openSetting() {
        if (!this.setting) return;
        super.openSetting();
    }

    /* ── 面板 ── */

    async openSaveDir() {
        const system = window.siyuan && window.siyuan.config && window.siyuan.config.system;
        const workspace = (system && system.workspaceDir) || "";
        const abs = workspace ? `${workspace}/data/emojis/${EMOJI_GROUP}` : `data/emojis/${EMOJI_GROUP}`;

        try {
            const electron = require("electron");
            if (electron && electron.shell && electron.shell.openPath) {
                const err = await electron.shell.openPath(abs);
                if (!err) return;
            }
        } catch (err) {
            /* 拿不到 electron 模块，降级 */
        }

        try {
            await navigator.clipboard.writeText(abs);
            this.setStatus(this.i18n.dirCopied.replace("$1", abs));
        } catch (err) {
            this.setStatus(abs);
        }
    }

    closePanel() {
        if (this.dialog) {
            this.dialog.destroy();
            this.dialog = null;
        }
    }

    openPanel() {
        this.savedBlockCtx = this.currentBlockContext();
        this.closePanel();
        this.refreshDownloaded();

        const countryOptions = COUNTRIES
            .map((c) => `<option value="${c.code}"${c.code === this.conf.country ? " selected" : ""}>${c.label}</option>`)
            .join("");

        this.dialog = new Dialog({
            title: this.i18n.pluginName,
            width: "760px",
            height: "620px",
            content: `<div class="b3-dialog__content asi">
    <div class="asi-toolbar">
        <input class="b3-text-field fn__flex-1 asi-input" placeholder="${this.i18n.searchPlaceholder}">
        <select class="b3-select asi-country">${countryOptions}</select>
        <button class="b3-button b3-button--outline asi-search">${this.i18n.search}</button>
    </div>
    <div class="asi-tip">${this.i18n.tip}</div>
    <div class="asi-path" title="${this.i18n.openDir}"><span>${this.i18n.saveDir}</span><code>data/emojis/${EMOJI_GROUP}</code></div>
    <div class="asi-recent fn__none">
        <div class="asi-recent-title">${this.i18n.recentTitle}</div>
        <div class="asi-recent-list"></div>
    </div>
    <div class="asi-status"></div>
    <div class="asi-grid"></div>
</div>`,
        });

        const root = this.dialog.element;
        const input = root.querySelector(".asi-input");
        const select = root.querySelector(".asi-country");
        const button = root.querySelector(".asi-search");

        button.addEventListener("click", () => this.search(input.value));
        const pathEl = root.querySelector(".asi-path");
        if (pathEl) pathEl.addEventListener("click", () => this.openSaveDir());
        select.addEventListener("change", () => {
            this.conf.country = select.value;
            if (input.value.trim()) this.search(input.value);
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.search(input.value);
            }
        });

        this.renderRecent();
        setTimeout(() => {
            if (input) input.focus();
        }, 60);
    }

    renderRecent() {
        if (!this.dialog) return;
        const wrap = this.dialog.element.querySelector(".asi-recent");
        const list = this.dialog.element.querySelector(".asi-recent-list");
        if (!wrap || !list) return;

        if (!this.recent.length || this.conf.recentLimit <= 0) {
            wrap.classList.add("fn__none");
            return;
        }
        wrap.classList.remove("fn__none");
        list.innerHTML = this.recent.map((item, index) => `<div class="asi-item asi-recent-item" data-recent="${index}" title="${this.esc(item.appName)}">
    <img src="/emojis/${this.esc(item.iconValue)}" alt="" loading="lazy">
    <span class="asi-name">${this.esc(item.appName)}</span>
</div>`).join("");

        list.onclick = async (event) => {
            const el = event.target.closest(".asi-recent-item");
            if (!el) return;
            const item = this.recent[Number(el.getAttribute("data-recent"))];
            if (!item) return;
            this.closePanel();
            await new Promise((resolve) => setTimeout(resolve, 60));
            if (!await this.insertEmoji(item.iconValue, item.iconValue.split("/").pop())) {
                showMessage(this.i18n.noEditor.replace("$1", item.iconValue));
            }
        };
    }

    setStatus(text) {
        if (!this.dialog) return;
        const el = this.dialog.element.querySelector(".asi-status");
        if (el) el.textContent = text || "";
    }

    esc(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
    }

    /* ── 最近使用 ── */

    readRecent() {
        try {
            const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
            return Array.isArray(list) ? list : [];
        } catch (err) {
            return [];
        }
    }

    pushRecent(iconValue, appName) {
        if (this.conf.recentLimit <= 0) return;
        const list = this.readRecent().filter((item) => item.iconValue !== iconValue);
        list.unshift({iconValue, appName});
        this.recent = list.slice(0, this.conf.recentLimit);
        localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent));
    }

    /* ── 已下载标记 ── */

    async refreshDownloaded() {
        try {
            const resp = await fetch("/api/file/readDir", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({path: `/data/emojis/${EMOJI_GROUP}`}),
            });
            const json = await resp.json();
            if (json.code === 0 && Array.isArray(json.data)) {
                this.downloaded = new Set(json.data.filter((f) => !f.isDir).map((f) => f.name));
                this.markDownloaded();
            }
        } catch (err) {
            /* 目录还不存在时忽略 */
        }
    }

    markDownloaded() {
        if (!this.dialog) return;
        this.dialog.element.querySelectorAll(".asi-item[data-file]").forEach((el) => {
            el.classList.toggle("is-downloaded", this.downloaded.has(el.getAttribute("data-file")));
        });
    }

    /* ── 搜索 ── */

    async search(rawTerm) {
        const term = (rawTerm || "").trim();
        if (!term) {
            this.setStatus(this.i18n.emptyKeyword);
            return;
        }
        if (this.busy || !this.dialog) return;

        this.busy = true;
        this.setStatus(this.i18n.searching);
        const grid = this.dialog.element.querySelector(".asi-grid");
        if (grid) grid.innerHTML = "";

        try {
            const params = new URLSearchParams({
                term,
                country: this.conf.country,
                entity: "software",
                limit: String(SEARCH_LIMIT),
            });
            const resp = await fetch(`${ITUNES_API}?${params.toString()}`);
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            const data = await resp.json();
            this.results = data.results || [];
            this.renderGrid();
        } catch (err) {
            this.results = [];
            this.setStatus(this.i18n.searchFailed + "：" + err.message);
        } finally {
            this.busy = false;
        }
    }

    renderGrid() {
        if (!this.dialog) return;
        const grid = this.dialog.element.querySelector(".asi-grid");
        if (!grid) return;

        if (!this.results.length) {
            grid.innerHTML = "";
            this.setStatus(this.i18n.noResult);
            return;
        }

        this.setStatus(this.i18n.resultCount.replace("$1", String(this.results.length)));
        grid.innerHTML = this.results.map((item, index) => {
            const thumb = item.artworkUrl100 || item.artworkUrl60 || "";
            const file = this.safeFileName(item.trackName) + ".png";
            const done = this.downloaded.has(file) ? " is-downloaded" : "";
            return `<div class="asi-item${done}" data-index="${index}" data-file="${this.esc(file)}" title="${this.esc(item.trackName)}">
    <img src="${this.esc(thumb)}" alt="" loading="lazy">
    <span class="asi-name">${this.esc(item.trackName)}</span>
</div>`;
        }).join("");

        grid.onclick = (event) => {
            const el = event.target.closest(".asi-item");
            if (!el) return;
            this.pick(Number(el.getAttribute("data-index")), "insert");
        };
        grid.oncontextmenu = (event) => {
            const el = event.target.closest(".asi-item");
            if (!el) return;
            event.preventDefault();
            this.openItemMenu(event, Number(el.getAttribute("data-index")));
        };
    }

    openItemMenu(event, index) {
        const app = this.results[index];
        if (!app) return;
        const menu = new Menu("asi-item-menu");
        menu.addItem({
            icon: "iconImage",
            label: this.i18n.setAsDocIcon,
            click: () => this.pick(index, "icon"),
        });
        menu.addItem({
            icon: "iconDownload",
            label: this.i18n.downloadOnly,
            click: () => this.pick(index, "download"),
        });
        menu.open({x: event.clientX, y: event.clientY});
    }

    /* ── 取图 ── */

    safeFileName(name) {
        const cleaned = String(name || "")
            .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "");
        return (cleaned || "icon").slice(0, 32);
    }

    async pick(index, mode) {
        const app = this.results[index];
        if (!app) {
            this.setStatus(this.i18n.staleResult);
            return;
        }
        if (this.busy) {
            this.setStatus(this.i18n.busyTip);
            return;
        }

        this.busy = true;
        this.lastFail = "";
        this.setStatus(this.i18n.saving.replace("$1", app.trackName));

        try {
            const blob = await this.fetchBlob(app.artworkUrl512 || app.artworkUrl100);
            const png = await this.toPng(blob, ICON_SIZE);
            const fileName = this.safeFileName(app.trackName) + ".png";
            const path = `/data/emojis/${EMOJI_GROUP}/${fileName}`;
            await this.putFile(path, png, fileName);

            const iconValue = `${EMOJI_GROUP}/${fileName}`;
            this.downloaded.add(fileName);
            this.pushRecent(iconValue, app.trackName);

            if (mode === "download") {
                this.setStatus(this.i18n.savedOnly.replace("$1", iconValue));
                this.markDownloaded();
                return;
            }

            if (mode === "icon") {
                const ok = await this.applyToActiveDoc(iconValue);
                this.setStatus(ok
                    ? this.i18n.appliedDocIcon.replace("$1", app.trackName)
                    : this.i18n.noDocId);
                this.markDownloaded();
                return;
            }

            this.closePanel();
            await new Promise((resolve) => setTimeout(resolve, 60));
            if (await this.insertEmoji(iconValue, fileName)) {
                return;
            }

            showMessage(this.i18n.noEditor.replace("$1", iconValue) + " ［" + (this.lastFail || "未知") + "］");
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(iconValue).catch(() => {});
            }
        } catch (err) {
            this.setStatus(this.i18n.saveFailed + "：" + err.message);
        } finally {
            this.busy = false;
        }
    }

    collectProtyles() {
        const list = [];
        const push = (p) => {
            if (p && typeof p.insert === "function" && list.indexOf(p) === -1) list.push(p);
        };

        if (this.activeProtyle) push(this.activeProtyle);

        try {
            (getAllEditor() || []).forEach((item) => {
                if (!item) return;
                push(item.protyle);
                push(item);
            });
        } catch (err) {
            /* 忽略，走 DOM 兜底 */
        }

        document.querySelectorAll(".protyle").forEach((el) => {
            push(el.__protyle);
            push(el.protyle);
        });

        return list;
    }

    tryInsert(protyle, wysiwyg, html) {
        const before = wysiwyg.querySelectorAll("img").length;
        try {
            if (typeof protyle.focus === "function") protyle.focus();
            protyle.insert(html, false);
        } catch (err) {
            return false;
        }
        return wysiwyg.querySelectorAll("img").length > before;
    }

    currentBlockContext() {
        const selection = window.getSelection();
        let node = selection && selection.anchorNode;
        let blockEl = null;
        while (node) {
            if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute("data-node-id")) {
                blockEl = node;
                break;
            }
            node = node.parentNode;
        }
        if (!blockEl) return null;

        const parentEl = blockEl.parentElement && blockEl.parentElement.closest("[data-node-id]");
        return {
            id: blockEl.getAttribute("data-node-id"),
            parentId: parentEl ? parentEl.getAttribute("data-node-id") : "",
        };
    }

    currentDocId() {
        const el = document.querySelector(".layout__wnd--active .protyle[data-doc-id]")
            || document.querySelector(".protyle[data-doc-id]");
        return el ? el.getAttribute("data-doc-id") : "";
    }

    async fetchRootId(blockId) {
        try {
            const resp = await fetch("/api/query/sql", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({stmt: `SELECT root_id FROM blocks WHERE id = '${blockId}'`}),
            });
            const json = await resp.json();
            if (json.code === 0 && json.data && json.data[0]) return json.data[0].root_id || "";
        } catch (err) {
            /* ignore */
        }
        return "";
    }

    async insertViaApi(iconValue) {
        const ctx = this.savedBlockCtx || this.currentBlockContext();
        let docId = this.currentDocId();
        if (!docId && ctx && ctx.id) {
            docId = await this.fetchRootId(ctx.id);
        }
        if (!docId) {
            this.lastFail = "docId 为空 ctx=" + (ctx ? ctx.id : "null");
            return false;
        }

        const parentId = (ctx && ctx.parentId) || docId;
        const payload = {
            dataType: "markdown",
            data: `![](/emojis/${iconValue})`,
            parentID: parentId,
        };
        if (ctx && ctx.id && ctx.id !== parentId) {
            payload.previousID = ctx.id;
        }

        try {
            const resp = await fetch("/api/block/insertBlock", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload),
            });
            const json = await resp.json();
            if (json.code !== 0) {
                this.lastFail = "API " + (json.msg || json.code);
            }
            return json.code === 0;
        } catch (err) {
            this.lastFail = "请求异常 " + (err && err.message);
            return false;
        }
    }

    async insertEmoji(iconValue, fileName) {
        const name = fileName.replace(/\.[^.]+$/, "");
        const html = `<img alt="${this.esc(name)}" class="emoji" src="/emojis/${this.esc(iconValue)}" title="${this.esc(name)}">`;

        const candidates = this.collectProtyles();

        for (const protyle of candidates) {
            const wysiwyg = protyle && protyle.wysiwyg && protyle.wysiwyg.element;
            if (!wysiwyg || !wysiwyg.isConnected) continue;
            if (this.tryInsert(protyle, wysiwyg, html)) return true;
        }

        return await this.insertViaApi(iconValue);
    }

    activeDocId() {
        const active = document.querySelector(".layout__wnd--active .protyle[data-doc-id]");
        if (active) return active.getAttribute("data-doc-id");
        const any = document.querySelector(".protyle[data-doc-id]");
        return any ? any.getAttribute("data-doc-id") : null;
    }

    async applyToActiveDoc(iconValue) {
        const id = this.activeDocId();
        if (!id) return false;
        try {
            const resp = await fetch("/api/attr/setBlockAttrs", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({id, attrs: {icon: iconValue}}),
            });
            const json = await resp.json();
            return json.code === 0;
        } catch (err) {
            return false;
        }
    }

    async fetchBlob(url) {
        if (!url) throw new Error("missing artwork url");
        const finalUrl = url.replace(/\/\d+x\d+bb\./, `/${ICON_SIZE}x${ICON_SIZE}bb.`);
        const resp = await fetch(finalUrl);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.blob();
    }

    async toPng(blob, size) {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        if (this.conf.rounded) {
            const r = size * 0.22;
            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.arcTo(size, 0, size, size, r);
            ctx.arcTo(size, size, 0, size, r);
            ctx.arcTo(0, size, 0, 0, r);
            ctx.arcTo(0, 0, size, 0, r);
            ctx.closePath();
            ctx.clip();
        }

        ctx.drawImage(bitmap, 0, 0, size, size);
        if (bitmap.close) bitmap.close();
        return new Promise((resolve, reject) => {
            canvas.toBlob((result) => {
                if (result) resolve(result);
                else reject(new Error("png encode failed"));
            }, "image/png");
        });
    }

    async putFile(path, blob, fileName) {
        const form = new FormData();
        form.append("path", path);
        form.append("isDir", "false");
        form.append("modTime", String(Date.now()));
        form.append("file", blob, fileName);

        const resp = await fetch("/api/file/putFile", {method: "POST", body: form});
        const json = await resp.json();
        if (json.code !== 0) throw new Error(json.msg || "putFile failed");
    }
}

module.exports = AppStoreIconPlugin;
