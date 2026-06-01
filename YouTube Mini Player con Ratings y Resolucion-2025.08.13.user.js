// ==UserScript==
// @name         YouTube Mini Player con Ratings y Resolucion
// @namespace    yt-mini-player-fix3
// @version      2025.08.13
// @description  Mini reproductor flotante con ratings opcionales, tamaño/posición persistentes, y resolución del video
// @author       Adapted & optimized by ChatGPT
// @icon         https://i.imgur.com/iCOFZgZ.png
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = "ytMiniPlayerSettings";
    const PLAYER_ID = "yt-popup-player";
    const BUTTON_CLASS = "yt-mini-button";

    const BAR_HEIGHT = 22;
    const sizes = [
        { w: 360, h: 200 },
        { w: 520, h: 293 },
        { w: 640, h: 360 }
    ];
    let sizeIndex = 1;// arranca en mediana
    let thumbBtnPosIndex = 0;// por defecto
    let ENABLE_RATINGS = true;
    let ENABLE_RESOLUTION = true;

    const ANCHOR_SELECTOR = "a[href*='/watch?v='], a[href^='/shorts/'], a#thumbnail[href]";
    const CONTAINER_MAP = [
        { parent: "ytm-shorts-lockup-view-model", images: [".shortsLockupViewModelHostThumbnailParentContainer"]},//shorts
        { parent: "ytd-playlist-video-renderer", images: ["ytd-thumbnail"]}, //playlist
        { parent: "ytd-rich-grid-media", images: ["ytd-thumbnail"]},//channels
        { parent: "ytd-rich-item-renderer", images: ["yt-thumbnail-view-model", "yt-collection-thumbnail-view-model"] },
        { parent: "yt-lockup-view-model", images: ["yt-thumbnail-view-model", "yt-collection-thumbnail-view-model"] },
        { parent: "ytd-video-renderer", images: ["ytd-thumbnail"] },//channels
        { parent: "ytd-grid-video-renderer", images: ["ytd-thumbnail"] } //channels
        
    ];

    const i18n = {
        en: {
            expand: "Expand/Restore",
            size: "Change size",
            ratings: "Toggle ratings on thumbnails",
            resolution: "Toggle resolution on thumbnails",
            btnDrag: "Enable/Disable Drag",
            btnPos: "Change thumbnail button position",
            close: "Close player"
        },
        es: {
            expand: "Expandir/Restaurar",
            size: "Cambiar tamaño",
            ratings: "Mostrar/Ocultar ratings",
            resolution: "Mostrar/Ocultar resolución",
            btnDrag: "Activar/Desactivar arrastre",
            btnPos: "Cambiar posicion del botón",
            close: "Cerrar reproductor"
        },
        // se pueden añadir más idiomas
    };

    let currentHighlightedBtn = null;
    let dragEnabled = false;
    let isDragging = false;
    let currentVideoResolution = "HD"; // Valor por defecto

    const THUMB_POSITIONS = [
        { top: "8px", left: "8px" }, // 0: top-left
        { top: "8px", left: "50%", transform: "translateX(-50%)" },// 1: top-center
        //{ top: "8px", right: "8px" },   // 2: top-right (superpuesto)
        { right: "8px", top: "50%", transform: "translateY(-50%)" },// 3: middle-right
        { bottom: "8px", right: "8px" },// 3: bottom-right
        { bottom: "8px", left: "50%", transform: "translateX(-50%)" },// 5: bottom-center
        { bottom: "8px", left: "8px" },// 2: bottom-left
        { left: "8px", top: "50%", transform: "translateY(-50%)" },// 6: middle-left
    ];

    // Oculta el botón redundante de YouTube
    const style = document.createElement("style");
    style.textContent = `
        .ytp-youtube-button.ytp-button.yt-uix-sessionlink {display: none !important;}
        .yt-mini-resolution {position: absolute; top: 0px; right: 0px; background: rgba(0,0,0,0.9); color: #fff; padding: 2px 4px; border-radius: 4px;
            box-shadow: 0 0 4px #aaa; clip-path: inset(0 0 -4px -4px); font-size: 10px; font-weight: bold; z-index: 400; pointer-events: none;
        }
        .yt-mini-resolution.SD { color: orange; }
        .yt-mini-resolution.HD { color: limegreen; }
        .yt-mini-resolution.FHD { color: dodgerblue; }
        .yt-mini-resolution.QHD { color: violet; }
        .yt-mini-resolution.UHD { color: crimson; }
    `;
    document.head.appendChild(style);

    // Caché global para no repetir peticiones del mismo video
    const resolutionCache = new Map();

    // -------------------- STORAGE --------------------

    // Carga configuración guardada en localStorage
    function loadSettings() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }
    // Guarda configuración en localStorage
    function saveSettings(settings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    // Inicializa configuración en memoria
    (function initSettings() {
        const s = loadSettings();
        if (typeof s.enableRatings === "boolean") ENABLE_RATINGS = s.enableRatings;
        if (typeof s.enableResolution === "boolean") ENABLE_RESOLUTION = s.enableResolution;
        if (typeof s.sizeIndex === "number") sizeIndex = s.sizeIndex;
        if (typeof s.thumbBtnPosIndex === "number") thumbBtnPosIndex = s.thumbBtnPosIndex;
    })();
    // Cambia el estado de ratings y lo guarda
    function toggleRatingsSetting(value) {
        const s = loadSettings();
        s.enableRatings = value;
        saveSettings(s);
        ENABLE_RATINGS = value;
    }
    // Cambia el estado de resolucion y lo guarda
    function toggleResolutionSetting(value) {
        const s = loadSettings();
        s.enableResolution = value;
        saveSettings(s);
        ENABLE_RESOLUTION = value;
    }

    // -------------------- HELPERS --------------------

    //Formato de Numeros
    function formatCount(n) {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + "M";
        if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + "K";
        return n.toString();
    }
    //Obtener idioma
    function getLang() {
        let lang = document.documentElement.lang || "en";
        lang = lang.split("-")[0];
        if (!i18n[lang]) lang = "en";
        return lang;
    }
    // Atajo para querySelectorAll
    function qAll(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
    // Extrae ID de video desde URL (watch o shorts)
    function extractVideoIdFromHref(href) {
        if (!href) return null;
        try {
            const url = new URL(href, location.origin);
            if (url.searchParams.has("v")) {
                const vid = url.searchParams.get("v");
                if (vid && vid.length === 11) return vid;
            }
            const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
            if (shortsMatch) return shortsMatch[1];
            return null;
        } catch {
            return null;
        }
    }
    // Busca contenedor de la miniatura del video
    function findContainerForAnchor(a) {
        for (const rule of CONTAINER_MAP) {
            const parentNode = a.closest(rule.parent);
            if (parentNode) {
                for (const imgSel of rule.images) {
                    const imageNode = parentNode.querySelector(imgSel);
                    if (imageNode) return imageNode;
                }
            }
        }
        return null;
    }
    // Asegura que el contenedor sea position:relative (para colocar botón encima)
    function ensureRelativeIfStatic(el) {
        try {
            const cs = getComputedStyle(el);
            if (cs.position === "static" || !cs.position) {
                el.style.position = "relative";
            }
        } catch {
            el.style.position = "relative";
        }
    }

    function makeThumbPosIcon(index) {
        const positions = [
            {cx: 3, cy: 3},    // Top-Left
            {cx: 8, cy: 3},    // Top-Center
            //{cx: 13, cy: 3},   // Top-Right (superpuesto)
            {cx: 13, cy: 8},    // Middle-Right
            {cx: 13, cy: 13},  // Bottom-Right
            {cx: 8, cy: 13},   // Bottom-Center
            {cx: 3, cy: 13},   // Bottom-Left
            {cx: 3, cy: 8},    // Middle-Left
        ];
        const pos = positions[index];

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("viewBox", "0 0 16 16");

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", pos.cx);
        circle.setAttribute("cy", pos.cy);
        circle.setAttribute("r", "3");
        circle.setAttribute("fill", "white");
        svg.appendChild(circle);

        return svg;
    }

    function saveThumbPos(index) {
        const s = loadSettings();
        s.thumbBtnPosIndex = index;
        saveSettings(s);
        thumbBtnPosIndex = index;
    }

    // -------------------- RESOLUCIÓN DEL VIDEO --------------------
    async function fetchVideoResolution(videoId) {
        // Si ya lo tenemos en caché, devolverlo directamente
        if (resolutionCache.has(videoId)) {
            return resolutionCache.get(videoId);
        }

        try {
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();

            // Extraer ytInitialPlayerResponse del HTML
            const match = html.match(/var ytInitialPlayerResponse = ({.*?});/);
            if (!match) throw new Error('ytInitialPlayerResponse not found');
            const data = JSON.parse(match[1]);

            let maxHeight = 0;
            const formats = [
                ...(data.streamingData?.formats || []),
                ...(data.streamingData?.adaptiveFormats || [])
            ];

            for (const fmt of formats) {
                // Ignorar pistas de solo audio
                if (fmt.mimeType && fmt.mimeType.includes('audio')) continue;
                const w = fmt.width || 0;
                const h = fmt.height || 0;
                if (w === 0 && h === 0) continue;
                // Usar el lado menor (resolución real del video)
                const dimension = Math.min(w, h);
                if (dimension > maxHeight) maxHeight = dimension;
            }

            if (maxHeight === 0) throw new Error('No valid video streams found');

            const resolutionText =
                  maxHeight >= 4320 ? "8K" :
            maxHeight >= 2160 ? "4K" :
            maxHeight >= 1440 ? "1440p" :   // si quieres "2K" cámbialo aquí
            maxHeight >= 1080 ? "1080p" :
            maxHeight >= 720  ? "720p" :
            maxHeight >= 480  ? "480p" :
            maxHeight >= 360  ? "360p" : "SD";

            const category =
                  maxHeight >= 2160 ? "UHD" :
            maxHeight >= 1440 ? "QHD" :
            maxHeight >= 1080 ? "FHD" :
            maxHeight >= 720  ? "HD" : "SD";

            const result = { resolution: resolutionText, height: maxHeight, category };

            // Guardar en caché
            resolutionCache.set(videoId, result);

            return result;
        } catch (error) {
            console.error('Error obteniendo resolución para', videoId, error);
            return null;
        }
    }
    // -------------------- DRAG --------------------

    function startPointerDrag(popup, pointerId, startX, startY, startRight, startBottom) {
        const onPointerMove = (ev) => {
            if (!isDragging) return;
            const dx = startX - ev.clientX;
            const dy = startY - ev.clientY;

            let newRight = startRight + dx;
            let newBottom = startBottom + dy;

            const winW = document.documentElement.clientWidth;
            const winH = document.documentElement.clientHeight;

            newRight = Math.max(0, Math.min(winW - popup.offsetWidth, newRight));
            newBottom = Math.max(0, Math.min(winH - popup.offsetHeight, newBottom));

            popup.style.right  = newRight + "px";
            popup.style.bottom = newBottom + "px";
            popup.style.left   = "auto";
            popup.style.top    = "auto";
        };

        const finishDrag = () => {
            if (!isDragging) return;
            isDragging = false;

            try { popup.releasePointerCapture(pointerId); } catch {}

            popup.removeEventListener('pointermove', onPointerMove);
            popup.removeEventListener('pointerup', onPointerUp);
            popup.removeEventListener('pointercancel', onPointerCancel);
            window.removeEventListener('blur', onWindowBlur);
            document.removeEventListener('visibilitychange', onVisibilityChange);

            document.body.style.userSelect = "";

            const settings = loadSettings();
            settings.right = parseInt(popup.style.right, 10) || 0;
            settings.bottom = parseInt(popup.style.bottom, 10) || 0;
            delete settings.left;
            delete settings.top;
            saveSettings(settings);
        };

        const onPointerUp = () => finishDrag();
        const onPointerCancel = () => finishDrag();
        const onWindowBlur = () => finishDrag();
        const onVisibilityChange = () => { if (document.visibilityState === 'hidden') finishDrag(); };

        popup.addEventListener('pointermove', onPointerMove);
        popup.addEventListener('pointerup', onPointerUp);
        popup.addEventListener('pointercancel', onPointerCancel);
        window.addEventListener('blur', onWindowBlur);
        document.addEventListener('visibilitychange', onVisibilityChange);
    }

    function handlePointerDown(e, popup) {
        if (!dragEnabled || e.button !== 0 || isExpanded(popup)) return;
        if (!e.isPrimary) return;

        isDragging = true;

        const startX = e.clientX;
        const startY = e.clientY;

        const rect = popup.getBoundingClientRect();
        const winW = document.documentElement.clientWidth;
        const winH = document.documentElement.clientHeight;

        const styleRight = popup.style.right && popup.style.right !== "auto"
        ? parseInt(popup.style.right, 10)
        : Math.max(0, winW - rect.right);

        const styleBottom = popup.style.bottom && popup.style.bottom !== "auto"
        ? parseInt(popup.style.bottom, 10)
        : Math.max(0, winH - rect.bottom);

        try { popup.setPointerCapture(e.pointerId); } catch {}

        startPointerDrag(popup, e.pointerId, startX, startY, styleRight, styleBottom);

        document.body.style.userSelect = "none";
        e.preventDefault();
    }

    // -------------------- MINI PLAYER --------------------

    function createPopupPlayer(videoId) {
        removePopupPlayer();
        const settings = loadSettings();

        const popup = document.createElement("div");
        popup.id = PLAYER_ID;

        sizeIndex = settings.sizeIndex ?? sizeIndex;
        const s = sizes[sizeIndex];

        Object.assign(popup.style, {
            position: "fixed",
            bottom: (settings.bottom ?? 0) + "px",
            right: (settings.right ?? 0) + "px",
            width: s.w + "px",
            height: (s.h + BAR_HEIGHT) + "px",
            backgroundColor: "#000",
            border: "2px solid #333",
            zIndex: "100000",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            overflow: "hidden",
            userSelect: "none"
        });

        popup.dataset.expanded = "false";
        dragEnabled = false;

        const controls = document.createElement("div");
        Object.assign(controls.style, {
            display: "flex",
            justifyContent: "flex-start",
            backgroundColor: "#222",
            padding: "0 2px",
            gap: "8px",
            alignItems: "center",
            height: BAR_HEIGHT + "px",
            boxSizing: "border-box",
            flex: "0 0 auto"
        });

        const lang = getLang();
        const expandBtn = makeBtn("⛶", i18n[lang].expand, () => toggleExpand(popup, expandBtn));
        const sizeBtn = makeBtn("⤢", i18n[lang].size, () => { if (!isExpanded(popup)) cycleSize(popup); });

        const ratingBtn = makeBtn(ENABLE_RATINGS ? "⭐" : "☆", i18n[lang].ratings, () => {
            toggleRatingsSetting(!ENABLE_RATINGS);
            ratingBtn.textContent = ENABLE_RATINGS ? "⭐" : "☆";
            rescanAfterNavigation();
        });

        const resolutionBtn = makeBtn(" ? ", i18n[lang].resolution, () => {
            toggleResolutionSetting(!ENABLE_RESOLUTION);
            resolutionBtn.style.color = ENABLE_RESOLUTION ? "#fff" : "#888";
            rescanAfterNavigation();
        });
        resolutionBtn.style.width = "auto";
        resolutionBtn.style.minWidth = "18px";
        resolutionBtn.style.padding = "0 4px";
        resolutionBtn.style.fontWeight = "bold";
        resolutionBtn.style.color = ENABLE_RESOLUTION ? "#fff" : "#888";

        // --- contador de likes/dislikes ---
        const statsEl = document.createElement("div");
        statsEl.textContent = "👍 --  👎 --";
        statsEl.style.fontSize = "12px";
        statsEl.style.color = "#ccc";
        statsEl.style.userSelect = "none";
        statsEl.classList.add("yt-mini-stats");
        controls.appendChild(statsEl);

        // Obtener resolución del video actual para el botón
        fetchVideoResolution(videoId).then(resolution => {
            if (resolution) {
                resolutionBtn.textContent = resolution.category;
            }
            // Si falla, se queda "?" que ya está por defecto
        });
        // obtener Likes/Dislikes
        fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`)
            .then(r => r.json())
            .then(data => {
                const likes = data.likes != null ? formatCount(data.likes) : "--";
                const dislikes = data.dislikes != null ? formatCount(data.dislikes) : "--";
                statsEl.textContent = `👍 ${likes}   👎 ${dislikes}`;
            })
            .catch(() => {
                statsEl.textContent = "👍 ?  👎 ?";
            });
        // Botón de cerrar
        const closeBtn = makeBtn("🗙", i18n[lang].close, () => removePopupPlayer());
        const thumbPosBtn = document.createElement("button");
        // Botón de arrastre (junto al cerrar)
        const dragToggleBtn = makeBtn("✜", i18n[lang].btnDrag, () => {
            dragEnabled = !dragEnabled;
            if (dragEnabled) {
                spacer.style.cursor = "move";
                spacer.style.backgroundImage = "repeating-linear-gradient(45deg, #444 0, #444 4px, transparent 4px, transparent 8px)";
                spacer.style.opacity = "0.6";
            } else {
                spacer.style.cursor = "default";
                spacer.style.backgroundImage = "none";
                spacer.style.opacity = "1";
            }
        });

        styleControlButton(thumbPosBtn);
        thumbPosBtn.title = i18n[lang].btnPos;
        thumbPosBtn.appendChild(makeThumbPosIcon(thumbBtnPosIndex));

        thumbPosBtn.addEventListener("click", () => {
            thumbBtnPosIndex = (thumbBtnPosIndex + 1) % THUMB_POSITIONS.length;
            saveThumbPos(thumbBtnPosIndex);
            thumbPosBtn.replaceChildren(makeThumbPosIcon(thumbBtnPosIndex));
            rescanAfterNavigation();
        });

        controls.appendChild(thumbPosBtn);
        controls.append(expandBtn, sizeBtn, thumbPosBtn, resolutionBtn, ratingBtn, statsEl);

        const spacer = document.createElement("div");
        spacer.style.flex = "1";
        spacer.style.height = "100%";
        controls.append(spacer, dragToggleBtn, closeBtn);
        // enganchar arrastre SOLO desde la barra, ignorando clicks en botones
        spacer.addEventListener("pointerdown", e => {
            if (dragEnabled) handlePointerDown(e, popup);
        });
        // Contenedor del iframe
        const videoWrapper = document.createElement("div");
        Object.assign(videoWrapper.style, {
            flex: "1",
            width: "100%",
            height: s.h + "px",
            position: "relative",
            background: "#000"
        });

        const iframe = document.createElement("iframe");
        iframe.src = `https://dragunthor.github.io/mini-player/index.html?id=${videoId}`;
        iframe.allow = "autoplay; encrypted-media; fullscreen";
        iframe.allowFullscreen = true;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";

        videoWrapper.appendChild(iframe);
        popup.appendChild(controls);
        popup.appendChild(videoWrapper);
        document.body.appendChild(popup);
    }
    // Crea un botón estilizado
    function makeBtn(symbol, title, fn) {
        const btn = document.createElement("button");
        btn.textContent = symbol;
        btn.title = title;
        styleControlButton(btn);
        btn.addEventListener("click", e => { e.stopPropagation(); fn(); });
        return btn;
    }
    // Estilo de los botones de control
    function styleControlButton(btn) {
        Object.assign(btn.style, {
            background: "#444",
            color: "#fff",
            border: "none",
            padding: "0",
            cursor: "pointer",
            fontSize: "11px",
            borderRadius: "3px",
            lineHeight: "1",
            height: "18px",
            width: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        });
    }
    // Elimina reproductor existente
    function removePopupPlayer() {
        const existing = document.getElementById(PLAYER_ID);
        if (existing) existing.remove();
        if (currentHighlightedBtn) {
            currentHighlightedBtn.style.outline = "";
            currentHighlightedBtn.style.boxShadow = "0 0 4px #aaa";
            currentHighlightedBtn.style.color = "#fff";
            currentHighlightedBtn.dataset.disabled = "false";
            currentHighlightedBtn = null;
        }
    }
    // Verifica si el player está expandido
    function isExpanded(popup) {
        return popup.dataset.expanded === "true";
    }
    // Alterna expandir/restaurar el player
    function toggleExpand(popup, expandBtn) {
        const isExp = isExpanded(popup);
        if (!isExp) {
            popup.dataset.prevStyles = JSON.stringify({
                right: popup.style.right,
                bottom: popup.style.bottom,
                width: popup.style.width,
                height: popup.style.height,
                borderRadius: popup.style.borderRadius
            });
            Object.assign(popup.style, {
                top: "0", left: "0", right: "0", bottom: "0",
                width: "100%", height: "100%", borderRadius: "0"
            });
            popup.dataset.expanded = "true";
            expandBtn.textContent = "❐";
            disableOtherButtons(popup, true);
        } else {
            const prev = JSON.parse(popup.dataset.prevStyles || "{}");
            Object.assign(popup.style, {
                bottom: prev.bottom || "0",
                right: prev.right || "0",
                width: prev.width || sizes[sizeIndex].w + "px",
                height: prev.height || (sizes[sizeIndex].h + BAR_HEIGHT) + "px",
                borderRadius: prev.borderRadius || "0",
                left: "auto", top: "auto"
            });
            popup.dataset.expanded = "false";
            expandBtn.textContent = "⛶";
            disableOtherButtons(popup, false);
        }
    }
    // Desactiva otros botones cuando está expandido
    function disableOtherButtons(popup, disable) {
        popup.querySelectorAll("button, .yt-mini-stats").forEach(el => {
            if (el.tagName === "BUTTON") {
                if (el.textContent !== "⛶" && el.textContent !== "❐" && el.textContent !== "🗙") {
                    el.disabled = disable;
                    el.style.opacity = disable ? "0.5" : "1";
                }
            } else if (el.classList.contains("yt-mini-stats")) {
                el.style.opacity = disable ? "0.5" : "1";
            }
        });
    }
    //restringir player dentro de la ventana
    function clampPlayerToViewport() {
        const popup = document.getElementById(PLAYER_ID);
        if (!popup) return;

        const winW = document.documentElement.clientWidth;
        const winH = document.documentElement.clientHeight;
        const rect = popup.getBoundingClientRect();
        // Calculamos posición actual respecto al borde derecho e inferior
        let right = parseInt(popup.style.right || "0", 10);
        let bottom = parseInt(popup.style.bottom || "0", 10);
        // Corrige desbordamientos en una línea
        right = rect.left < 0 ? winW - popup.offsetWidth : (rect.right > winW ? 0 : right);
        bottom = rect.top < 0 ? winH - popup.offsetHeight : (rect.bottom > winH ? 0 : bottom);

        popup.style.right = right + "px";
        popup.style.bottom = bottom + "px";
        // Guardar ajustes en localStorage
        const settings = loadSettings();
        settings.right = right;
        settings.bottom = bottom;
        saveSettings(settings);
    }
    // Cambia tamaño del player cíclicamente
    function cycleSize(popup) {
        sizeIndex = (sizeIndex + 1) % sizes.length;
        const s = sizes[sizeIndex];
        popup.style.width = s.w + "px";
        popup.style.height = (s.h + BAR_HEIGHT) + "px";
        clampPlayerToViewport();
        const settings = loadSettings();
        settings.sizeIndex = sizeIndex;
        saveSettings(settings);
    }

    // -------------------- RATING BUTTON --------------------
    // Obtiene ratings desde Return YouTube Dislike API
    async function fetchRating(videoId) {
        try {
            const resp = await fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`);
            const data = await resp.json();
            const likes = data.likes || 0;
            const dislikes = data.dislikes || 0;
            const total = likes + dislikes;
            if (total === 0) return null;
            return Math.round((likes / total) * 100);
        } catch {
            return null;
        }
    }
    // Colorea porcentaje según calidad
    function ratingColor(pct) {
        if (pct >= 80) return "#4caf50";
        if (pct >= 60) return "#ffeb3b";
        if (pct >= 40) return "#ff9800";
        return "#f44336";
    }

    // -------------------- BOTÓN EN MINIATURA --------------------
    // Inserta botón de play flotante en cada miniatura
    async function addPlayButton(container, videoId) {
        const existingBtn = container.querySelector(`.${BUTTON_CLASS}`);
        if (existingBtn) existingBtn.remove();

        const btn = document.createElement("div");
        btn.className = BUTTON_CLASS;
        btn.title = "Reproducir en mini reproductor";
        Object.assign(btn.style, {
            position: "absolute",
            ...THUMB_POSITIONS[thumbBtnPosIndex],
            width: "26px",
            height: ENABLE_RATINGS ? "33px" : "26px",
            borderRadius: ENABLE_RATINGS ? "6px 6px 13px 13px" : "50%",
            backgroundColor: "rgba(0,0,0,0.9)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            cursor: "pointer",
            zIndex: "900",
            boxShadow: "0 0 4px #aaa",
            lineHeight: "1.2",
        });

        let ratingEl;
        if (ENABLE_RATINGS) {
            ratingEl = document.createElement("div");
            ratingEl.textContent = "--";
            ratingEl.style.fontSize = "10px";
            ratingEl.style.fontWeight = "bold";
            btn.append(ratingEl);
        }

        const playEl = document.createElement("div");
        playEl.textContent = "▶";
        playEl.style.fontSize = ENABLE_RATINGS ? "14px" : "12px";
        btn.append(playEl);

        btn.addEventListener("click", (e) => {
            if (btn.dataset.disabled === "true") {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            createPopupPlayer(videoId);
            if (currentHighlightedBtn) {
                currentHighlightedBtn.style.outline = "";
                currentHighlightedBtn.style.boxShadow = "0 0 4px #aaa";
                currentHighlightedBtn.style.color = "#fff";
                currentHighlightedBtn.dataset.disabled = "false";
            }
            btn.style.outline = "2px solid #0f0";
            btn.style.boxShadow = "0 0 0 3px #000";
            btn.style.color = "#0f0";
            btn.dataset.disabled = "true";
            currentHighlightedBtn = btn;
        });

        ensureRelativeIfStatic(container);
        container.appendChild(btn);
        container.dataset.ytMiniVid = videoId;

        // Añadir elemento de resolución si está activado
        if (ENABLE_RESOLUTION) {
            const resolutionEl = document.createElement("div");
            resolutionEl.className = "yt-mini-resolution";
            resolutionEl.textContent = "...";
            container.appendChild(resolutionEl);

            // Obtener y mostrar la resolución
            fetchVideoResolution(videoId).then(resolution => {
                if (resolution) {
                    resolutionEl.textContent = resolution.resolution;
                    resolutionEl.classList.add(resolution.category);
                } else {
                    resolutionEl.textContent = " ? ";
                    resolutionEl.classList.add("SD");
                }
            }).catch(() => {
                resolutionEl.textContent = " ? ";
                resolutionEl.classList.add("SD");
            });
        }

        // Cargar ratings si está activado
        if (ENABLE_RATINGS && ratingEl) {
            fetchRating(videoId).then(pct => {
                if (pct != null) {
                    ratingEl.textContent = pct + "%";
                    ratingEl.style.color = ratingColor(pct);
                } else {
                    ratingEl.textContent = " ? ";
                    ratingEl.style.color = "#aaa";
                }
            });
        }
    }

    // -------------------- SCANNING --------------------

    function processAnchor(a) {
        if (a.closest('.html5-video-player') || a.closest('.ytp-right-controls') || a.closest('.ytp-left-controls')) {
            return;
        }
        const videoId = extractVideoIdFromHref(a.getAttribute('href') || a.href);
        if (!videoId) return;
        const container = findContainerForAnchor(a);
        if (!container) return;
        // si el contenedor ya tiene este videoId → no hacer nada
        if (container.dataset.ytMiniVid === videoId) return;
        // si cambió el videoId, limpiar el botón viejo si existe
        const oldBtn = container.querySelector(".yt-mini-button");
        if (oldBtn) oldBtn.remove();
        const oldResolution = container.querySelector(".yt-mini-resolution");
        if (oldResolution) oldResolution.remove();
        // actualizar el videoId
        container.dataset.ytMiniVid = videoId;
        // insertar botón nuevo
        addPlayButton(container, videoId);
    }
    // Procesa nuevos nodos inyectados en el DOM
    function scanNewNodes(nodes) {
        //if (location.pathname === "/watch") return;
        for (const node of nodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches && node.matches(ANCHOR_SELECTOR)) {
                processAnchor(node);
            }
            const anchors = node.querySelectorAll?.(ANCHOR_SELECTOR);
            if (anchors?.length) {
                anchors.forEach(a => processAnchor(a));
            }
        }
    }
    // Escanea toda la página
    function scanPage() {
        //if (location.pathname === "/watch") return;
        qAll(ANCHOR_SELECTOR, document).forEach(a => processAnchor(a));
    }

    // ---- INIT ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => scanPage());
    } else {
        scanPage();
    }
    setTimeout(scanPage, 500);
    // Observa cambios en el DOM para reinyectar botones
    const targetNode = document.querySelector('ytd-app') || document.body;
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === "childList" && mutation.addedNodes?.length) {
                scanNewNodes(mutation.addedNodes);
            }
            if (mutation.type === "attributes" && mutation.attributeName === "href") {
                processAnchor(mutation.target);
            }
        }
    });
    observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["href"]
    });
    // Reescanea tras la navegación interna de YouTube
    function rescanAfterNavigation() {
        scanPage();
    }
    // Asegurar que el reproductor nunca se desborde al redimensionar la ventana
    window.addEventListener('yt-navigate-finish', rescanAfterNavigation);
})();