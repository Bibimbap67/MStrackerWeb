// ==========================================================================
// CONFIGURATION
// ==========================================================================
const TMDB_API_KEY = "0a0e2bf9fe54e6e65320d51734e258a4";
const BASE_URL    = "https://api.themoviedb.org/3";
const IMAGE_URL   = "https://image.tmdb.org/t/p/original";
const POSTER_URL  = "https://image.tmdb.org/t/p/w342";
const TMDB_KEY    = TMDB_API_KEY;
const BASE        = BASE_URL;
const IMG_ORIG    = IMAGE_URL;
const IMG_W300    = "https://image.tmdb.org/t/p/w300";
const IMG_W185    = "https://image.tmdb.org/t/p/w185";
const IMG_POSTER  = POSTER_URL;
const AMBIENT_VIDEO_PREF_KEY = "notflix_ambient_video_enabled";

// Genre IDs
const GENRES = {
    action:  28,
    comedy:  35,
    drama:   18,
    scifi:   878,
    horror:  27,
    mystery: 9648,
    anime:   16,
};

// Category page config: label, subtitle, TMDB fetch URL builder
const CATEGORY_CONFIG = {
    action:  { label: "Action",  subtitle: "High-octane thrills and explosive adventure.",  url: () => `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${GENRES.action}&sort_by=popularity.desc` },
    comedy:  { label: "Comedy",  subtitle: "Laughs guaranteed — no serious business here.", url: () => `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${GENRES.comedy}&sort_by=popularity.desc` },
    drama:   { label: "Drama",   subtitle: "Powerful stories that move you.",               url: () => `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${GENRES.drama}&sort_by=popularity.desc` },
    scifi:   { label: "Sci-Fi",  subtitle: "Explore galaxies, futures, and the unknown.",   url: () => `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${GENRES.scifi}&sort_by=popularity.desc` },
    horror:  { label: "Horror",  subtitle: "Things that go bump in the dark.",              url: () => `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${GENRES.horror}&sort_by=popularity.desc` },
    mystery: { label: "Mystery", subtitle: "Every clue matters. Trust no one.",             url: () => `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${GENRES.mystery}&sort_by=popularity.desc` },
};

// Watch History Expansion State
let historyExpanded = false;

// ========================================================================== // STATE
// ==========================================================================
let heroInterval     = null;
let currentSlide     = 0;
let topMovies        = [];
let currentPage      = "action"; // tracks active SPA page
let currentModalId   = null;     // id of the currently open modal item
let currentModalType = null;     // "movie" or "tv"
let currentModalDetails = null;  // hydrated TMDB details for watch history

// ==========================================================================
// BOOT
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    initNavSearch();
    applyPreferences();
    initProfilePage();
    initSignupPage();
    if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY_HERE") {
        alert("Please insert your TMDb API Key inside script.js!");
        return;
    }

    const homePage = document.getElementById("page-home");
    const playerPage = document.getElementById("player-layout");

    if (homePage) {
        setupNavSPA();
        const bootParams = new URLSearchParams(window.location.search);
        const requestedSearch = bootParams.get("search");
        const requestedPage = bootParams.get("page") || "action";
        if (requestedSearch) {
            runSearch(requestedSearch);
        } else {
            showPage(CATEGORY_CONFIG[requestedPage] ? requestedPage : "action"); // default landing page = Action (home)
        }

        const modalClose = document.getElementById("modal-close");
        if (modalClose) modalClose.addEventListener("click", closeModal);

        const detailModal = document.getElementById("detail-modal");
        if (detailModal) {
            detailModal.addEventListener("click", (e) => {
                if (e.target.id === "detail-modal") closeModal();
            });
        }

        const btnStream = document.querySelector(".btn-stream");
        if (btnStream) {
            btnStream.addEventListener("click", () => {
                if (currentModalId && currentModalType) {
                    removePlanningItem(currentModalId, currentModalType);
                    saveWatchHistoryFromDetails(currentModalDetails || { id: currentModalId, type: currentModalType });
                    window.location.href = `videoplayer.html?id=${currentModalId}&type=${currentModalType}`;
                }
            });
        }

        const btnPlan = document.getElementById("modal-plan-btn");
        if (btnPlan) {
            btnPlan.addEventListener("click", () => {
                if (!currentModalDetails) return;
                savePlanningItem(currentModalDetails);
                btnPlan.classList.add("is-planned");
                btnPlan.setAttribute("aria-label", "Added to Planning");
                renderPlanningToWatch();
            });
        }
    }

    if (playerPage) {
        await initPlayerPage();
    }

    window.addEventListener("scroll", onScroll);
});

// ==========================================================================
// SPA NAVIGATION
// ==========================================================================
function setupNavSPA() {
    const items = document.querySelectorAll("#nav-categories .category-item");
    items.forEach(item => {
        const page = item.dataset.page;
        const link = item.querySelector("a");
        if (link) link.href = `index.html?page=${encodeURIComponent(page)}`;
        link?.addEventListener("click", (e) => {
            e.preventDefault();
            if (page === currentPage && !document.getElementById("page-category")?.classList.contains("search-mode")) return;
            setActiveNavItem(item);
            showPage(page);
            history.replaceState(null, "", page === "action" ? "index.html" : `index.html?page=${encodeURIComponent(page)}`);
        });
    });

    const initialPage = new URLSearchParams(window.location.search).get("page") || "action";
    const initialItem = Array.from(items).find(item => item.dataset.page === initialPage) || items[0];
    if (initialItem) setActiveNavItem(initialItem);
}

function setActiveNavItem(targetItem) {
    const items = document.querySelectorAll("#nav-categories .category-item");
    items.forEach(i => i.classList.remove("active"));
    targetItem.classList.add("active");

    // Animate the sliding underline indicator
    const indicator = document.getElementById("nav-indicator");
    const link = targetItem.querySelector("a");
    indicator.style.left   = `${link.offsetLeft}px`;
    indicator.style.width  = `${link.offsetWidth}px`;
    indicator.style.opacity = "1";
}

function showPage(page) {
    currentPage = page;
    document.getElementById("page-category")?.classList.remove("search-mode");
    const homeEl     = document.getElementById("page-home");
    const categoryEl = document.getElementById("page-category");

    if (page === "action") {
        // Action = the rich home page with hero + rows
        homeEl.classList.remove("page-hidden");
        categoryEl.classList.add("page-hidden");
        loadHomePage();
    } else {
        homeEl.classList.add("page-hidden");
        categoryEl.classList.remove("page-hidden");
        loadCategoryPage(page);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================================================
// HOME PAGE (Action)
// ==========================================================================
let homeLoaded = false;

function loadHomePage() {
    if (homeLoaded) return; // already loaded, don't re-fetch
    homeLoaded = true;

    renderContinueWatching();
    renderPlanningToWatch();
    initSkeletons("row-trending", 8);
    initSkeletons("row-anime", 6);
    initSkeletons("row-kdrama", 6);
    initSkeletons("row-horror", 6);
    initSkeletons("row-upcoming", 6);

    fetchHeroShowcase();
    fetchRow(`${BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}`, "row-trending", true);
    fetchRow(`${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${GENRES.anime}&with_original_language=ja`, "row-anime");
    fetchRow(`${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ko`, "row-kdrama");
    fetchRow(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${GENRES.horror}`, "row-horror");
    fetchRow(`${BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}`, "row-upcoming", false, true);
}

// ==========================================================================
// CATEGORY PAGE
// ==========================================================================
const categoryCache = {};

async function loadCategoryPage(page) {
    const config = CATEGORY_CONFIG[page];
    if (!config) return;

    document.getElementById("category-page-title").innerText = config.label;
    document.getElementById("category-page-subtitle").innerText = config.subtitle;

    const grid = document.getElementById("category-grid");

    if (categoryCache[page]) {
        grid.innerHTML = categoryCache[page];
        grid.querySelectorAll(".movie-card").forEach(card => {
            card.addEventListener("click", () => openDetailModal(card.dataset.id, card.dataset.type));
            enableCardHover(card);
        });
        return;
    }

    // Skeleton placeholders
    grid.innerHTML = "";
    for (let i = 0; i < 18; i++) {
        const sk = document.createElement("div");
        sk.className = "movie-card skeleton";
        sk.innerHTML = `<div class="card-image-placeholder"></div>`;
        grid.appendChild(sk);
    }

    try {
        const res  = await fetch(config.url());
        const data = await res.json();
        grid.innerHTML = "";

        if (!data.results || data.results.length === 0) {
            grid.innerHTML = `<p class="error-msg">No titles found for this category.</p>`;
            return;
        }

        data.results.forEach((item) => {
            if (!item.poster_path) return;
            const type  = item.media_type || (item.title ? "movie" : "tv");
            const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
            const card  = document.createElement("div");
            card.className = "movie-card";
            card.dataset.id   = item.id;
            card.dataset.type = type;
            card.innerHTML = `
                <span class="rating-badge">&#9733; ${rating}</span>
                <div class="card-image-placeholder" style="background-image: url('${POSTER_URL}${item.poster_path}')"></div>
            `;
            card.addEventListener("click", () => openDetailModal(item.id, type));
            grid.appendChild(card);
        });

        categoryCache[page] = grid.innerHTML;

    } catch (err) {
        console.error("Category fetch error:", err);
        grid.innerHTML = `<p class="error-msg">Failed to load content. Please try again.</p>`;
    }
}

// ==========================================================================
// HERO SHOWCASE
// ==========================================================================
async function fetchHeroShowcase() {
    try {
        const res  = await fetch(`${BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        topMovies  = data.results.slice(0, 8);
        await renderHeroSlide();
        startHeroAutoplay();
    } catch (err) {
        console.error("Hero showcase error:", err);
    }
}

async function renderHeroSlide() {
    const item = topMovies[currentSlide];
    if (!item) return;

    const title        = item.title || item.name || item.original_name;
    const year         = (item.release_date || item.first_air_date || "2026").split("-")[0];
    const rating       = item.vote_average ? item.vote_average.toFixed(1) : "7.7";
    const mediaType    = item.media_type || (item.title ? "movie" : "tv");
    const typeLabel    = mediaType === "tv" ? "TV Series" : "Movie";

    const block = document.getElementById("hero-animated-block");
    const logo  = document.getElementById("hero-logo");

    block.style.opacity   = "0";
    block.style.transform = "translateY(8px)";

    // Fetch logo
    let logoPath = null;
    try {
        const imgRes  = await fetch(`${BASE_URL}/${mediaType}/${item.id}/images?api_key=${TMDB_API_KEY}`);
        const imgData = await imgRes.json();
        if (imgData.logos && imgData.logos.length > 0) {
            const en = imgData.logos.find(l => l.iso_639_1 === "en");
            logoPath = en ? en.file_path : imgData.logos[0].file_path;
        }
    } catch {}

    setTimeout(() => {
        document.getElementById("hero-section").style.backgroundImage = `url('${IMAGE_URL}${item.backdrop_path}')`;

        if (logoPath) {
            logo.src   = `${IMAGE_URL}${logoPath}`;
            logo.alt   = title;
            logo.style.display = "block";
        } else {
            logo.removeAttribute("src");
            logo.style.display = "none";
        }

        document.getElementById("hero-meta").innerHTML = `
            <span class="meta-pill pill-star">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="star-icon"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>
                ${rating}
            </span>
            <span class="meta-pill">${year}</span>
            <span class="meta-pill opacity-50">${typeLabel}</span>
            <span class="meta-pill opacity-50">Trending Now</span>
        `;

        document.getElementById("hero-desc").innerText = item.overview || "No description available.";
        updateIndicators(topMovies.length, currentSlide);

        block.style.opacity   = "1";
        block.style.transform = "none";
    }, 400);
}

function startHeroAutoplay() {
    clearInterval(heroInterval);
    heroInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % topMovies.length;
        renderHeroSlide();
    }, 8000);
}

function updateIndicators(total, active) {
    const track = document.getElementById("hero-indicators");
    if (!track) return;
    track.innerHTML = "";
    for (let i = 0; i < total; i++) {
        const btn  = document.createElement("button");
        btn.type   = "button";
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", i === active ? "true" : "false");
        btn.setAttribute("aria-label", `Go to slide ${i + 1}`);
        btn.className = "timeline-tab-trigger";

        const line = document.createElement("span");
        line.className = `timeline-line-fill ${i === active ? "line-active" : ""}`;
        btn.appendChild(line);

        btn.addEventListener("click", () => {
            if (currentSlide === i) return;
            currentSlide = i;
            renderHeroSlide();
            startHeroAutoplay();
        });
        track.appendChild(btn);
    }
}

// ==========================================================================
// ROW FETCHING (Home sliders)
// ==========================================================================
function initSkeletons(rowId, count) {
    const el = document.getElementById(rowId);
    if (!el) return;
    el.innerHTML = "";
    for (let i = 0; i < count; i++) {
        const sk = document.createElement("div");
        sk.className = "movie-card skeleton";
        sk.innerHTML = `<div class="card-image-placeholder"></div>`;
        el.appendChild(sk);
    }
}

async function fetchRow(url, rowId, isTop10 = false, isUpcoming = false) {
    try {
        const res  = await fetch(url);
        const data = await res.json();
        const el   = document.getElementById(rowId);
        if (!el || !data.results || data.results.length === 0) return;

        el.innerHTML = "";
        data.results.forEach((item, index) => {
            if (!item.poster_path) return;
            const type = item.media_type || (rowId === "row-anime" || rowId === "row-kdrama" ? "tv" : "movie");
            const card = document.createElement("div");
            card.className = `movie-card ${isUpcoming ? "upcoming" : ""}`;

            const top10HTML  = isTop10 && index < 10 ? `<span class="top10-badge">TOP<br>${index + 1}</span>` : "";
            const ratingHTML = isUpcoming ? "" : `<span class="rating-badge">&#9733; ${item.vote_average.toFixed(1)}</span>`;
            const tagHTML    = index === 0 && !isUpcoming
                ? `<span class="tag-badge red-tag">TRENDING</span>`
                : isUpcoming
                ? `<span class="tag-badge grey-tag">${item.release_date || "2026"}</span>`
                : "";

            card.innerHTML = `
                ${top10HTML}
                ${ratingHTML}
                <div class="card-image-placeholder" style="background-image: url('${POSTER_URL}${item.poster_path}')"></div>
                ${tagHTML}
            `;
            card.addEventListener("click", () => openDetailModal(item.id, type));
            el.appendChild(card);
        });

        enableDragScroll(el);
    } catch (err) {
        console.error(`Row fetch error [${rowId}]:`, err);
    }
}

// ==========================================================================
// DRAG SCROLL
// ==========================================================================
function enableDragScroll(slider) {
    let isDown = false, startX, scrollLeft, hasDragged = false;

    slider.addEventListener("mousedown", (e) => {
        isDown = true;
        hasDragged = false;
        slider.classList.add("drag-active");
        startX     = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener("mouseleave", () => { isDown = false; slider.classList.remove("drag-active"); });

    slider.addEventListener("mouseup", (e) => {
        isDown = false;
        slider.classList.remove("drag-active");
        if (hasDragged) { e.stopPropagation(); e.preventDefault(); }
    });

    slider.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        e.preventDefault();
        const walk = (e.pageX - slider.offsetLeft - startX) * 1.5;
        if (Math.abs(walk) > 6) hasDragged = true;
        slider.scrollLeft = scrollLeft - walk;
    });

    slider.addEventListener("click", (e) => {
        if (hasDragged) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
}

// Lightweight hover enabler for category grid cards (no drag needed)
function enableCardHover(card) { /* CSS handles it */ }

// ==========================================================================
// MODAL
// ==========================================================================
async function openDetailModal(id, type) {
    const modal   = document.getElementById("detail-modal");
    const wrapper = document.getElementById("modal-card-wrapper");
    wrapper.classList.add("skeleton");
    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    // Track which item is open so btn-stream can navigate
    currentModalId   = id;
    currentModalType = type;
    currentModalDetails = null;
    const planButton = document.getElementById("modal-plan-btn");
    planButton?.classList.remove("is-planned");
    planButton?.setAttribute("aria-label", "Add to Planning");
try {
        const [detailsRes, creditsRes] = await Promise.all([
            fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`),
            fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`),
        ]);
        const details = await detailsRes.json();
        const credits = await creditsRes.json();

        const title    = details.title || details.name || details.original_name;
        const year     = (details.release_date || details.first_air_date || "2026").split("-")[0];
        currentModalDetails = {
            id,
            type,
            title,
            year,
            posterPath: details.poster_path || "",
            posterUrl: details.poster_path ? `${POSTER_URL}${details.poster_path}` : "",
            backdropUrl: details.backdrop_path ? `${IMAGE_URL}${details.backdrop_path}` : "",
            watchedAt: Date.now()
        };
        const score    = (details.vote_average * 10).toFixed(0);
        const backdrop = details.backdrop_path ? `${IMAGE_URL}${details.backdrop_path}` : "";

        document.getElementById("modal-banner").style.backgroundImage = `url('${backdrop}')`;
        document.getElementById("modal-title").innerText    = title;
        document.getElementById("modal-year").innerText     = year;
        document.getElementById("modal-type").innerText     = type === "tv" ? "TV Series" : "Movie";
        document.getElementById("modal-rating").innerText   = `★ ${details.vote_average.toFixed(1)}`;
        document.getElementById("modal-overview").innerText = details.overview || "No overview available.";
        document.getElementById("modal-match").innerText    = `${score > 0 ? score : "85"}% Match`;
        document.getElementById("modal-genres").innerText   = details.genres ? details.genres.map(g => g.name).join(", ") : "N/A";
        document.getElementById("modal-cast").innerText     = credits.cast ? credits.cast.slice(0, 4).map(c => c.name).join(", ") : "N/A";
        document.getElementById("modal-runtime").innerText  = type === "tv"
            ? `${details.number_of_seasons || 1} Season(s)`
            : details.runtime ? `${details.runtime} mins` : "N/A";

        updatePlanningButtonState();

        wrapper.classList.remove("skeleton");
    } catch (err) {
        console.error("Modal fetch error:", err);
        wrapper.classList.remove("skeleton");
    }
}

function closeModal() {
    document.getElementById("detail-modal").classList.remove("open");
    document.body.style.overflow = "auto";
}

// -- FIRST_PLAYER_LOGIC_START --
// ==========================================================================
// SCROLL — navbar blur
// ==========================================================================
function onScroll() {
    document.getElementById("main-nav").classList.toggle("scrolled", window.scrollY > 10);
}

// ==========================================================================
// VIDEOPLAYER PAGE LOGIC
// ==========================================================================
async function initPlayerPage() {
    const playerLayout = document.getElementById('player-layout');
    if (!playerLayout) return;

    if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY_HERE") {
        alert("Please insert your TMDb API Key inside script.js!");
        return;
    }

    setupTabs();
    setupScrollNav();
    setupAmbientVideoBackground();
    setupVideoProgressTracking();
    setupCompleteButton();

    const params = new URLSearchParams(location.search);
    const MEDIA_ID = params.get("id");
    const MEDIA_TYPE = params.get("type") || "movie";

    if (!MEDIA_ID) {
        document.getElementById("page-loading").innerHTML = `<p style="color:rgba(255,255,255,0.4)">No active content identifier found. <a href="index.html" style="color:#e50914">Go back</a></p>`;
        return;
    }

    try {
        await loadPlayerPage(MEDIA_ID, MEDIA_TYPE);
    } catch (err) {
        console.error("Critical core module exception:", err);
        document.getElementById("page-loading").innerHTML = `<p style="color:rgba(255,255,255,0.4)">Failed to parse streaming catalog entry. <a href="index.html" style="color:#e50914">Go back</a></p>`;
    }
}

async function loadPlayerPage(id, type) {
    const loadingEl = document.getElementById("page-loading");
    const playerLayoutEl = document.getElementById("player-layout");
    const fallbackTitle = document.getElementById("placeholder-title");
    const fallbackBackdrop = document.getElementById("placeholder-backdrop");

    if (!loadingEl || !playerLayoutEl || !fallbackTitle || !fallbackBackdrop) {
        throw new Error("Required player page elements are missing.");
    }

    loadingEl.style.display = "none";
    playerLayoutEl.style.display = "grid";
    fallbackTitle.textContent = "Loading media...";
    fallbackBackdrop.style.backgroundImage = "";

    const [detailsRes, creditsRes, similarRes] = await Promise.all([
        fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`),
        fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`),
        fetch(`${BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}`),
    ]);

    if (!detailsRes.ok || !creditsRes.ok || !similarRes.ok) {
        throw new Error("One or more player data requests failed.");
    }

    const details = await detailsRes.json();
    const credits = await creditsRes.json();
    const similar = await similarRes.json();

    const title = details.title || details.name || details.original_name || "Untitled";
    const year = (details.release_date || details.first_air_date || "").split("-")[0] || "—";
    const score = Math.round((details.vote_average || 0) * 10);
    const rating = getRating(details, type);
    currentPlayerMedia = {
        id: String(id),
        type,
        title,
        year,
        posterPath: details.poster_path || "",
        posterUrl: details.poster_path ? `${POSTER_URL}${details.poster_path}` : "",
        backdropUrl: details.backdrop_path ? `${IMAGE_URL}${details.backdrop_path}` : "",
        finalSeason: 0,
        finalEpisode: 0,
    };

    document.getElementById("ov-title").innerText = title;
    document.getElementById("ov-overview").innerText = details.overview || "No overview available.";
    fallbackTitle.textContent = title;

    if (details.backdrop_path) {
        fallbackBackdrop.style.backgroundImage = `url('${IMAGE_URL}${details.backdrop_path}')`;
    }

    buildBadges(details, type, year, score, rating);
    buildCast(credits.cast || []);
    buildDetails(details, credits, type);
    saveWatchHistoryFromDetails({
        id,
        type,
        title,
        year,
        posterPath: details.poster_path || "",
        posterUrl: details.poster_path ? `${POSTER_URL}${details.poster_path}` : "",
        watchedAt: Date.now()
    });
    buildSimilar((similar.results || []).filter(item => item.id !== parseInt(id, 10)), type);

    if (type === "tv") {
        document.getElementById("tv-right-panel").style.display = "block";
        document.getElementById("movie-right-panel").style.display = "none";
        const params = new URLSearchParams(location.search);
        const requestedSeason = parseInt(params.get("season") || "", 10);
        const requestedEpisode = parseInt(params.get("episode") || "", 10);
        const firstSeason = (details.seasons || []).find(s => s.season_number > 0)?.season_number;
        const finalSeasonInfo = [...(details.seasons || [])].reverse().find(s => s.season_number > 0 && s.episode_count > 0);
        currentPlayerMedia.finalSeason = finalSeasonInfo?.season_number || 0;
        currentPlayerMedia.finalEpisode = finalSeasonInfo?.episode_count || 0;
        const selectedSeason = Number.isFinite(requestedSeason) ? requestedSeason : firstSeason;
        buildSeasonSelector(details, selectedSeason);
        if (selectedSeason) await loadSeason(id, selectedSeason, Number.isFinite(requestedEpisode) ? requestedEpisode : 1);
    } else {
        document.getElementById("tv-right-panel").style.display = "none";
        document.getElementById("movie-right-panel").style.display = "block";
        buildMoviePanel(details, details.poster_path ? `${IMG_POSTER}${details.poster_path}` : "");
        setPlayerSourceForItem({
            key: getMovieProgressKey(id),
            id: String(id),
            type: "movie",
            title,
            subtitle: year,
            posterPath: details.poster_path || "",
            posterUrl: details.poster_path ? `${POSTER_URL}${details.poster_path}` : "",
            href: `videoplayer.html?id=${id}&type=movie`,
            isFinalItem: true,
        }, getMovieVideoSource(id));
    }
}

function buildBadges(details, type, year, score, ratingLabel) {
    const el = document.getElementById("ov-badges");
    const seasons = type === "tv" && details.number_of_seasons
        ? `<span class="meta-chip">${details.number_of_seasons} Season${details.number_of_seasons > 1 ? "s" : ""}</span>` : "";
    const runtime = type === "movie" && details.runtime
        ? `<span class="meta-chip">${details.runtime} min</span>` : "";
    const genres = (details.genres || []).slice(0, 2).map(g =>
        `<span class="meta-chip">${g.name}</span>`).join("");

    el.innerHTML = `
        <span class="meta-chip high-match">${score > 0 ? score : "—"}% Match</span>
        <span class="meta-chip">${year}</span>
        ${ratingLabel ? `<span class="meta-chip">${ratingLabel}</span>` : ""}
        ${seasons}${runtime}
        <span class="meta-chip">★ ${(details.vote_average||0).toFixed(1)}</span>
        ${genres}
    `;
}

function buildCast(cast) {
    const el = document.getElementById("ov-cast");
    if (!el) return;
    if (!cast.length) { el.innerHTML = `<p style="color:rgba(255,255,255,0.3);font-size:0.85rem">No cast metrics available.</p>`; return; }
    el.innerHTML = cast.slice(0, 12).map(actor => {
        const img = actor.profile_path ? `${IMG_W185}${actor.profile_path}` : "";
        const avatar = img ? `background-image:url('${img}')` : `background-color:#2a2a35`;
        return `
            <div class="cast-card">
                <div class="cast-avatar" style="${avatar}"></div>
                <div class="cast-text-overlay">
                    <div class="cast-name">${actor.name}</div>
                    <div class="cast-role">${actor.character || ""}</div>
                </div>
            </div>`;
    }).join("");
    enableDragScroll(el);
}

function buildDetails(details, credits, type) {
    const el = document.getElementById("details-list");
    const cast  = (credits.cast  || []).slice(0, 6).map(c => c.name).join(", ") || "N/A";
    const crew  = (credits.crew  || []);
    const directors = crew.filter(c => c.job === "Director").map(c => c.name).join(", ") || "N/A";
    const creators  = (details.created_by || []).map(c => c.name).join(", ") || directors;
    const genres    = (details.genres || []).map(g => g.name).join(", ") || "N/A";
    const studios   = (details.production_companies || []).map(c => c.name).slice(0,3).join(", ") || "N/A";
    const langs     = (details.spoken_languages || []).map(l => l.english_name).join(", ") || "N/A";
    const status    = details.status || "N/A";
    const network   = type === "tv" ? (details.networks || []).map(n => n.name).join(", ") || "N/A" : null;

    const rows = [
        ["Creator / Director", creators],
        ["Cast Personnel", cast],
        ["Genres Context", genres],
        ["Production Status", status],
        network ? ["Network Source", network] : null,
        ["Studio Labels", studios],
        ["Track Languages", langs],
    ].filter(Boolean);

    el.innerHTML = rows.map(([k, v]) =>
        `<div class="extended-row"><strong>${k}</strong><span>${v}</span></div>`
    ).join("");
}

function buildSimilar(results, type) {
    const el = document.getElementById("suggested-grid");
    if (!el) return;
    const filtered = results.filter(r => r.poster_path || r.backdrop_path).slice(0, 12);
    if (!filtered.length) { el.innerHTML = `<p style="color:rgba(255,255,255,0.3);font-size:0.85rem;grid-column:1/-1">No alternative matching profiles discovered.</p>`; return; }

    el.innerHTML = filtered.map(item => {
        const thumb = item.poster_path ? `${IMG_POSTER}${item.poster_path}` : (item.backdrop_path ? `${IMG_W300}${item.backdrop_path}` : "");
        const label = item.title || item.name;
        const yr    = (item.release_date || item.first_air_date || "").split("-")[0];
        const sc    = Math.round((item.vote_average || 0) * 10);
        return `<div class="suggested-card" onclick="goToPlayer(${item.id}, '${type}')">
                    <div class="suggested-thumb" style="background-image:url('${thumb}')"></div>
                    <div class="suggested-info">
                        <h5>${label}</h5>
                        <p>${sc > 0 ? sc+"% Match" : "—"} · ${yr}</p>
                    </div>
                </div>`;
    }).join("");
}

function buildSeasonSelector(details, selectedSeasonNumber) {
    const wrapper = document.getElementById("season-selector");
    if (!wrapper) return;
    const menu    = wrapper.querySelector(".psd-menu");
    const label   = wrapper.querySelector(".psd-label");
    const trigger = wrapper.querySelector(".psd-trigger");
    const seasons = (details.seasons || []).filter(s => s.season_number > 0);

    const activeSeason = selectedSeasonNumber || seasons[0]?.season_number;
    menu.innerHTML = seasons.map((s) =>
        `<div class="psd-option${s.season_number === activeSeason ? " psd-selected" : ""}" data-value="${s.season_number}">Season ${s.season_number}</div>`
    ).join("");

    if (activeSeason) label.textContent = `Season ${activeSeason}`;

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        wrapper.classList.toggle("open");
    });

    document.addEventListener("click", () => wrapper.classList.remove("open"));

    menu.addEventListener("click", async (e) => {
        const opt = e.target.closest(".psd-option");
        if (!opt) return;
        const val = parseInt(opt.dataset.value, 10);
        menu.querySelectorAll(".psd-option").forEach(o => o.classList.remove("psd-selected"));
        opt.classList.add("psd-selected");
        label.textContent = opt.textContent;
        wrapper.classList.remove("open");
        await loadSeason(new URLSearchParams(location.search).get("id"), val, 1);
    });
}

async function loadSeason(seriesId, seasonNum, selectedEpisodeNum = 1) {
    const listEl    = document.getElementById("episode-list");
    const tabListEl = document.getElementById("episodes-tab-list");
    if (!listEl || !tabListEl) return;
    listEl.innerHTML    = `<div style="color:rgba(255,255,255,0.3);font-size:0.85rem;padding:12px">Buffering sequence nodes...</div>`;
    tabListEl.innerHTML = listEl.innerHTML;

    try {
        const res  = await fetch(`${BASE}/tv/${seriesId}/season/${seasonNum}?api_key=${TMDB_KEY}`);
        const data = await res.json();
        const eps  = data.episodes || [];

        const makeCard = (ep, active) => {
            const thumb = ep.still_path ? `${IMG_W300}${ep.still_path}` : "";
            const runtime = ep.runtime ? `${ep.runtime}m` : "";
            const name    = ep.name || `Episode ${ep.episode_number}`;
            const overview = ep.overview || "No item log synopsis available.";
            return `
                <div class="track-strip-item ${active ? "active-stream-track" : ""}" data-season="${seasonNum}" data-ep="${ep.episode_number}">
                    <div class="track-thumbnail-capsule" style="${thumb ? `background-image:url('${thumb}')` : ""}"></div>
                    <div class="track-description-block">
                        <div class="track-row-header">
                            <h4>${ep.episode_number}. ${name}</h4>
                            <span class="track-duration-stamp">${runtime}</span>
                        </div>
                        <p class="track-summary-excerpt">${overview}</p>
                    </div>
                </div>`;
        };

        const selectedEpisode = eps.find(ep => ep.episode_number === selectedEpisodeNum) || eps[0];
        const html = eps.map((ep) => makeCard(ep, selectedEpisode && ep.episode_number === selectedEpisode.episode_number)).join("");
        listEl.innerHTML    = html || `<p style="color:rgba(255,255,255,0.3);font-size:0.85rem">No runtime records found.</p>`;
        tabListEl.innerHTML = html || listEl.innerHTML;

        [listEl, tabListEl].forEach(container => {
            container.querySelectorAll(".track-strip-item").forEach(card => {
                card.addEventListener("click", () => {
                    document.querySelectorAll(".track-strip-item").forEach(c => c.classList.remove("active-stream-track"));
                    const epNum = parseInt(card.dataset.ep, 10);
                    const season = parseInt(card.dataset.season, 10);
                    document.querySelectorAll(`.track-strip-item[data-season="${season}"][data-ep="${epNum}"]`).forEach(c => c.classList.add("active-stream-track"));
                    const episode = eps.find(ep => ep.episode_number === epNum);
                    if (episode) selectEpisode(seriesId, season, episode);
                });
            });
        });

        if (selectedEpisode) selectEpisode(seriesId, seasonNum, selectedEpisode, false);

    } catch (err) {
        listEl.innerHTML = `<p style="color:rgba(255,255,255,0.3);font-size:0.85rem">Failed to populate episode tracking.</p>`;
    }
}

function buildMoviePanel(details, poster) {
    if (poster) document.getElementById("movie-poster").style.backgroundImage = `url('${poster}')`;

    const facts = [
        ["Release",  details.release_date || "—"],
        ["Runtime",  details.runtime ? `${details.runtime} min` : "—"],
        ["Rating",   `★ ${(details.vote_average||0).toFixed(1)} / 10`],
        ["Votes",    details.vote_count ? details.vote_count.toLocaleString() : "—"],
        ["Language", details.original_language?.toUpperCase() || "—"],
        ["Budget",   details.budget ? `$${(details.budget/1e6).toFixed(0)}M` : "—"],
        ["Revenue",  details.revenue ? `$${(details.revenue/1e6).toFixed(0)}M` : "—"],
        ["Status",   details.status || "—"],
    ];

    document.getElementById("movie-facts").innerHTML = facts.map(([k, v]) =>
        `<div class="fact-row"><span>${k}</span><span>${v}</span></div>`
    ).join("");
}

function selectEpisode(seriesId, seasonNum, episode, updateUrl = true) {
    if (!episode || !currentPlayerMedia) return;
    const epNum = episode.episode_number;
    const title = `${currentPlayerMedia.title}: S${seasonNum} E${epNum}`;
    const subtitle = episode.name || `Episode ${epNum}`;
    const href = `videoplayer.html?id=${seriesId}&type=tv&season=${seasonNum}&episode=${epNum}`;

    setPlayerSourceForItem({
        key: getEpisodeProgressKey(seriesId, seasonNum, epNum),
        id: String(seriesId),
        type: "tv",
        season: seasonNum,
        episode: epNum,
        title,
        subtitle,
        posterPath: currentPlayerMedia.posterPath || "",
        posterUrl: currentPlayerMedia.posterUrl || "",
        href,
        isFinalItem: seasonNum === currentPlayerMedia.finalSeason && epNum === currentPlayerMedia.finalEpisode,
    }, getEpisodeVideoSource(seriesId, seasonNum, epNum));

    if (updateUrl) history.replaceState(null, "", href);
}

function getMovieProgressKey(id) {
    return `movie:${id}`;
}

function getEpisodeProgressKey(seriesId, seasonNum, episodeNum) {
    return `tv:${seriesId}:s${seasonNum}:e${episodeNum}`;
}

function getMovieVideoSource(id) {
    return VIDEO_SOURCES.movie?.[getMovieProgressKey(id)] || "";
}

function getEpisodeVideoSource(seriesId, seasonNum, episodeNum) {
    return VIDEO_SOURCES.episode?.[getEpisodeProgressKey(seriesId, seasonNum, episodeNum)] || "";
}

function setPlayerSourceForItem(item, src) {
    const video = document.getElementById("theater-embedded-media");
    const source = video?.querySelector("source");
    const fallback = document.getElementById("player-fallback-card");
    const fallbackTitle = document.getElementById("placeholder-title");
    if (!video || !source) return;

    activePlaybackItem = item;
    activeProgressKey = item.key;
    activeProgressLoaded = false;
    updateCompleteButtonState();

    if (fallbackTitle) fallbackTitle.textContent = src ? item.title : "No local video assigned";

    if (!src) {
        source.removeAttribute("src");
        video.removeAttribute("src");
        video.load();
        setAmbientVideoSource("");
        if (fallback) fallback.style.display = "flex";
        return;
    }

    if (source.getAttribute("src") !== src) {
        source.src = src;
        video.load();
    }
    setAmbientVideoSource(src);
    if (fallback) fallback.style.display = "none";
}

function setupAmbientVideoBackground() {
    const main = document.getElementById("theater-embedded-media");
    const glow = document.getElementById("theater-ambient-media");
    const toggle = document.getElementById("ambient-toggle-btn");
    if (!main || !glow || glow.dataset.ambientBound === "true") return;

    glow.dataset.ambientBound = "true";
    glow.muted = true;
    glow.playsInline = true;

    const syncGlowTime = () => {
        if (!Number.isFinite(main.currentTime) || Math.abs(main.currentTime - glow.currentTime) <= 0.3) return;
        try {
            glow.currentTime = main.currentTime;
        } catch {}
    };

    const alignGlow = () => {
        syncGlowTime();
    };

    const playGlow = () => {
        if (!glow.src || !isAmbientVideoEnabled()) return;
        alignGlow();
        glow.playbackRate = main.playbackRate;
        glow.play().catch(() => {});
    };

    main.addEventListener("play", playGlow);
    main.addEventListener("pause", () => glow.pause());
    main.addEventListener("ended", () => glow.pause());
    main.addEventListener("seeking", () => {
        glow.pause();
        alignGlow();
    });
    main.addEventListener("seeked", () => {
        alignGlow();
        if (!main.paused) playGlow();
    });
    main.addEventListener("ratechange", () => {
        glow.playbackRate = main.playbackRate;
    });
    main.addEventListener("timeupdate", alignGlow);
    main.addEventListener("loadedmetadata", alignGlow);

    if (toggle) {
        toggle.addEventListener("click", () => {
            const nextEnabled = !isAmbientVideoEnabled();
            localStorage.setItem(AMBIENT_VIDEO_PREF_KEY, nextEnabled ? "true" : "false");
            applyAmbientVideoPreference();
            if (nextEnabled && !main.paused) playGlow();
        });
    }

    applyAmbientVideoPreference();
}

function setAmbientVideoSource(src) {
    const glow = document.getElementById("theater-ambient-media");
    const main = document.getElementById("theater-embedded-media");
    if (!glow) return;

    if (!src) {
        glow.pause();
        glow.removeAttribute("src");
        glow.load();
        applyAmbientVideoPreference();
        return;
    }

    if (glow.getAttribute("src") !== src) {
        glow.src = src;
        glow.load();
    }

    applyAmbientVideoPreference();
    if (!isAmbientVideoEnabled()) return;
    if (main) {
        glow.playbackRate = main.playbackRate;
        if (Number.isFinite(main.currentTime)) {
            try {
                glow.currentTime = main.currentTime;
            } catch {}
        }
        if (!main.paused) glow.play().catch(() => {});
    }
}

function isAmbientVideoEnabled() {
    return localStorage.getItem(AMBIENT_VIDEO_PREF_KEY) !== "false";
}

function applyAmbientVideoPreference() {
    const enabled = isAmbientVideoEnabled();
    const glow = document.getElementById("theater-ambient-media");
    const toggle = document.getElementById("ambient-toggle-btn");

    if (glow) {
        glow.classList.toggle("ambient-disabled", !enabled || !glow.getAttribute("src"));
        if (!enabled) glow.pause();
    }

    if (toggle) {
        toggle.classList.toggle("ambient-off", !enabled);
        toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
        toggle.setAttribute("aria-label", enabled ? "Turn ambient background off" : "Turn ambient background on");
        toggle.title = enabled ? "Ambient background on" : "Ambient background off";
    }
}

function setupVideoProgressTracking() {
    const video = document.getElementById("theater-embedded-media");
    if (!video || video.dataset.progressBound === "true") return;
    video.dataset.progressBound = "true";

    video.addEventListener("loadedmetadata", () => {
        if (!activeProgressKey || activeProgressLoaded) return;
        const saved = readProgressMap()[activeProgressKey];
        activeProgressLoaded = true;
        if (saved && saved.currentTime > 5 && video.duration && saved.currentTime < video.duration - 10) {
            video.currentTime = saved.currentTime;
        }
    });

    video.addEventListener("timeupdate", () => {
        if (!activePlaybackItem || !activeProgressKey || !video.duration || video.duration < 1) return;
        saveProgressEntry({
            ...activePlaybackItem,
            currentTime: video.currentTime,
            duration: video.duration,
            updatedAt: Date.now(),
        });
        updateCompleteButtonState();
    });

    video.addEventListener("ended", () => {
        if (!activePlaybackItem || !activeProgressKey || !video.duration) return;
        saveProgressEntry({
            ...activePlaybackItem,
            currentTime: video.duration,
            duration: video.duration,
            completed: true,
            updatedAt: Date.now(),
        });
        updateCompleteButtonState();
    });
}

function setupCompleteButton() {
    const button = document.getElementById("complete-watch-btn");
    if (!button || button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
        if (button.disabled || !activePlaybackItem) return;
        markCompleted(activePlaybackItem);
        button.classList.add("completed");
        button.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> Completed`;
    });
    updateCompleteButtonState();
}

function updateCompleteButtonState() {
    const button = document.getElementById("complete-watch-btn");
    const video = document.getElementById("theater-embedded-media");
    if (!button) return;
    const isFinalItem = Boolean(activePlaybackItem?.isFinalItem);

    const canComplete = Boolean(
        activePlaybackItem &&
        isFinalItem &&
        isPlaybackDone(activePlaybackItem, video)
    );
    const alreadyCompleted = activePlaybackItem && isCompletedItem(activePlaybackItem.id, activePlaybackItem.type);

    button.style.display = isFinalItem ? "inline-flex" : "none";
    button.disabled = !canComplete || alreadyCompleted;
    button.classList.toggle("ready", canComplete && !alreadyCompleted);
    button.classList.toggle("completed", Boolean(alreadyCompleted));
    button.innerHTML = alreadyCompleted
        ? `<i class="fa-solid fa-check" aria-hidden="true"></i> Completed`
        : `<i class="fa-solid fa-check" aria-hidden="true"></i> Mark Complete`;
}

function isPlaybackDone(item, video) {
    const saved = item?.key ? readProgressMap()[item.key] : null;
    if (saved?.completed || saved?.percent >= 0.98) return true;
    if (!video || !video.duration) return false;
    return video.ended || video.currentTime >= video.duration - 1;
}

function readProgressMap() {
    try {
        return JSON.parse(localStorage.getItem(WATCH_PROGRESS_KEY) || "{}");
    } catch {
        return {};
    }
}

function saveProgressEntry(entry) {
    if (!entry || !entry.key) return;
    const progress = readProgressMap();
    const pct = entry.duration ? entry.currentTime / entry.duration : 0;
    progress[entry.key] = {
        ...entry,
        percent: Math.max(0, Math.min(1, pct)),
        completed: entry.completed || pct >= 0.98,
    };
    localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(progress));
}

function removeProgressEntry(key) {
    if (!key) return;
    const progress = readProgressMap();
    if (progress[key]) {
        delete progress[key];
        localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(progress));
    }
}

function readList(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
        return [];
    }
}

function writeList(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
}

function normalizeShelfItem(details) {
    if (!details || !details.id || !details.type) return null;
    const title = details.title || details.name || details.original_name || "Untitled";
    const year = details.year || (details.release_date || details.first_air_date || "").split("-")[0] || "----";
    return {
        id: String(details.id),
        type: details.type,
        title,
        year,
        posterPath: details.posterPath || "",
        posterUrl: details.posterUrl || (details.posterPath ? `${POSTER_URL}${details.posterPath}` : ""),
        backdropUrl: details.backdropUrl || "",
        href: details.href || `videoplayer.html?id=${details.id}&type=${details.type}`,
        updatedAt: Date.now(),
    };
}

function readPlanningItems() {
    return readList(WATCH_PLANNING_KEY);
}

function savePlanningItem(details) {
    const nextItem = normalizeShelfItem(details);
    if (!nextItem) return;
    const items = readPlanningItems().filter(item => !(String(item.id) === nextItem.id && item.type === nextItem.type));
    items.unshift(nextItem);
    writeList(WATCH_PLANNING_KEY, items.slice(0, 20));
}

function removePlanningItem(id, type) {
    if (!id || !type) return;
    const items = readPlanningItems().filter(item => !(String(item.id) === String(id) && item.type === type));
    writeList(WATCH_PLANNING_KEY, items);
}

function isPlanningItem(id, type) {
    return readPlanningItems().some(item => String(item.id) === String(id) && item.type === type);
}

function updatePlanningButtonState() {
    const button = document.getElementById("modal-plan-btn");
    if (!button || !currentModalDetails) return;
    const planned = isPlanningItem(currentModalDetails.id, currentModalDetails.type);
    button.classList.toggle("is-planned", planned);
    button.setAttribute("aria-label", planned ? "Added to Planning" : "Add to Planning");
}

function readCompletedItems() {
    return readList(WATCH_COMPLETED_KEY);
}

function isCompletedItem(id, type) {
    return readCompletedItems().some(item => String(item.id) === String(id) && item.type === type);
}

function markCompleted(item) {
    const completedItem = normalizeShelfItem({
        ...item,
        year: item.year || item.subtitle,
        posterUrl: item.posterUrl || (item.posterPath ? `${POSTER_URL}${item.posterPath}` : ""),
    });
    if (!completedItem) return;

    removePlanningItem(completedItem.id, completedItem.type);
    const completed = readCompletedItems().filter(entry => !(entry.id === completedItem.id && entry.type === completedItem.type));
    completed.unshift({ ...completedItem, completedAt: Date.now() });
    writeList(WATCH_COMPLETED_KEY, completed.slice(0, 50));
}

function getContinueWatchingItems() {
    return Object.values(readProgressMap())
        .filter(item => item.duration && item.currentTime > 5 && !item.completed && item.percent < 0.98)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 12);
}

async function repairContinueWatchingPosters(items) {
    const tvItems = items.filter(item => item.type === "tv" && item.id && item.key);
    if (!tvItems.length) return;

    const progress = readProgressMap();
    let changed = false;

    await Promise.all(tvItems.map(async item => {
        try {
            const res = await fetch(`${BASE_URL}/tv/${item.id}?api_key=${TMDB_API_KEY}`);
            if (!res.ok) return;
            const details = await res.json();
            if (!details.poster_path || !progress[item.key]) return;
            if (progress[item.key].posterPath === details.poster_path) return;

            progress[item.key] = {
                ...progress[item.key],
                posterPath: details.poster_path,
                posterUrl: `${POSTER_URL}${details.poster_path}`,
            };
            changed = true;
        } catch (err) {
            console.error("Continue Watching poster repair failed:", err);
        }
    }));

    if (changed) {
        localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(progress));
        renderContinueWatching();
    }
}

function renderContinueWatching() {
    const section = document.getElementById("continue-section");
    const row = document.getElementById("row-continue");
    if (!section || !row) return;
    const items = getContinueWatchingItems();
    section.style.display = items.length ? "block" : "none";
    if (!items.length) {
        row.innerHTML = "";
        return;
    }
    repairContinueWatchingPosters(items);
    row.innerHTML = items.map(item => {
        const pct = Math.round((item.percent || 0) * 100);
        const almostDone = pct >= 85 ? "Almost done" : `${pct}% watched`;
        const poster = item.posterPath ? `background-image: url('${POSTER_URL}${escapeAttribute(item.posterPath)}')` : (item.posterUrl ? `background-image: url('${escapeAttribute(item.posterUrl)}')` : "");
        return `
            <div class="movie-card continue-card" data-href="${escapeAttribute(item.href || "#")}">
                <div class="card-image-placeholder" style="${poster}"></div>
                <button class="continue-remove-btn" type="button" data-key="${escapeAttribute(item.key)}" aria-label="Remove from Continue Watching">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 6h18"></path>
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                    </svg>
                </button>
                <div class="continue-play-overlay">
                    <div class="continue-play-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="11" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/>
                            <path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="white"/>
                        </svg>
                        <span>Continue</span>
                    </div>
                </div>
                <div class="continue-overlay">
                    <strong>${escapeHtml(item.title || "Continue Watching")}</strong>
                    <span>${escapeHtml(item.subtitle || almostDone)}</span>
                    <div class="continue-progress"><span style="width:${pct}%"></span></div>
                    <small>${almostDone}</small>
                </div>
            </div>`;
    }).join("");
    row.querySelectorAll(".continue-card").forEach(card => {
        card.addEventListener("click", () => {
            const href = card.dataset.href;
            if (href && href !== "#") window.location.href = href;
        });
    });
    row.querySelectorAll(".continue-remove-btn").forEach(button => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            removeProgressEntry(button.dataset.key);
            renderContinueWatching();
        });
    });
    enableDragScroll(row);
}

function renderPlanningToWatch() {
    const section = document.getElementById("planning-section");
    const row = document.getElementById("row-planning");
    if (!section || !row) return;

    const items = readPlanningItems();
    section.style.display = items.length ? "block" : "none";
    if (!items.length) {
        row.innerHTML = "";
        return;
    }

    row.innerHTML = items.map(item => {
        const poster = item.posterPath ? `background-image: url('${POSTER_URL}${escapeAttribute(item.posterPath)}')` : (item.posterUrl ? `background-image: url('${escapeAttribute(item.posterUrl)}')` : "");
        return `
            <div class="movie-card continue-card planning-card" data-id="${escapeAttribute(item.id)}" data-type="${escapeAttribute(item.type)}" data-href="${escapeAttribute(item.href || `videoplayer.html?id=${item.id}&type=${item.type}`)}">
                <div class="card-image-placeholder" style="${poster}"></div>
                <div class="continue-play-overlay">
                    <div class="continue-play-btn">
                        <i class="fa-solid fa-eye planning-watch-icon" aria-hidden="true"></i>
                        <span>Watch</span>
                    </div>
                </div>
                <div class="continue-overlay">
                    <strong>${escapeHtml(item.title || "Planning to Watch")}</strong>
                    <span>${escapeHtml(item.type === "tv" ? "TV Series" : "Movie")} - ${escapeHtml(item.year || "----")}</span>
                    <small>Planning</small>
                </div>
            </div>`;
    }).join("");

    row.querySelectorAll(".planning-card").forEach(card => {
        card.addEventListener("click", () => {
            const id = card.dataset.id;
            const type = card.dataset.type;
            const item = readPlanningItems().find(entry => entry.id === id && entry.type === type);
            if (item) {
                removePlanningItem(id, type);
                saveWatchHistoryFromDetails(item);
            }
            const href = card.dataset.href;
            if (href && href !== "#") window.location.href = href;
        });
    });
    enableDragScroll(row);
}

function getRating(details, type) {
    try {
        if (type === "movie") {
            const us = (details.release_dates?.results || []).find(r => r.iso_3166_1 === "US");
            return us?.release_dates?.[0]?.certification || "";
        } else {
            const us = (details.content_ratings?.results || []).find(r => r.iso_3166_1 === "US");
            return us?.rating || "";
        }
    } catch { return ""; }
}

function goToPlayer(id, type) {
    location.href = `videoplayer.html?id=${id}&type=${type}`;
}

// ── Pill Control Switching Action Triggers ──
function setupTabs() {
    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".capsule-tab-btn");
        if (!btn) return;
        const targetId = btn.getAttribute("data-target");
        document.querySelectorAll(".capsule-tab-btn").forEach(b => {
            b.classList.remove("active-pill");
            b.setAttribute("aria-selected", "false");
        });
        document.querySelectorAll(".deck-viewpane").forEach(p => p.classList.remove("active-pane"));
        btn.classList.add("active-pill");
        btn.setAttribute("aria-selected", "true");
        document.getElementById(targetId)?.classList.add("active-pane");
    });
}

// ── Sticky Header Toggles ──
function setupScrollNav() {
    window.addEventListener("scroll", () => {
        document.getElementById("main-nav")?.classList.toggle("scrolled", window.scrollY > 10);
    });
}


// ── Drag to Scroll Implementation for Cast Row ──
document.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById("ov-cast");
    if (!slider) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener("mousedown", (e) => {
        isDown = true;
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener("mouseleave", () => {
        isDown = false;
    });

    slider.addEventListener("mouseup", () => {
        isDown = false;
    });

    slider.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        e.preventDefault(); // Prevents image/text dragging artifacts
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 1.5; // Multiply factor to adjust drag sensitivity
        slider.scrollLeft = scrollLeft - walk;
    });
});

 // ── Profile Dropdown Logic ──
    (function () {
        const signinBtn      = document.getElementById('nav-signin-btn');
        const profileWrapper = document.getElementById('nav-profile-wrapper');
        const profileBtn     = document.getElementById('nav-profile-btn');
        const dropdown       = document.getElementById('profile-dropdown');
        const pdUsername     = document.getElementById('pd-username');
        const signoutBtn     = document.getElementById('pd-signout-btn');

        function initProfile() {
            const user = localStorage.getItem('notflix_user');
            if (user) {
                if (signinBtn) signinBtn.style.display = 'none';
                if (profileWrapper) profileWrapper.style.display = 'flex';
                if (pdUsername) pdUsername.textContent = user;
            } else {
                if (signinBtn) signinBtn.style.display = 'flex';
                if (profileWrapper) profileWrapper.style.display = 'none';
            }
        }

        // Toggle dropdown open/close
        if (profileBtn && dropdown) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.toggle('open');
                profileBtn.setAttribute('aria-expanded', isOpen);
            });
        }

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileBtn || !dropdown) return;
            if (!dropdown.contains(e.target) && e.target !== profileBtn) {
                dropdown.classList.remove('open');
                profileBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Sign out
        if (signoutBtn) {
            signoutBtn.addEventListener('click', () => {
                localStorage.removeItem('notflix_user');
                dropdown?.classList.remove('open');
                initProfile();
            });
        }

        // ── Menu item → UserProfile navigation ──
        // Case A: Profile Settings  → UserProfile.html (top / profile section)
        const goProfile = document.querySelector('.pd-menu-list .pd-menu-item:nth-child(1)');
        if (goProfile) goProfile.addEventListener('click', () => {
            window.location.href = 'userProfile.html?section=profile';
        });

        // Watch History → UserProfile.html#section-history
        const goHistory = document.querySelector('.pd-menu-list .pd-menu-item:nth-child(2)');
        if (goHistory) goHistory.addEventListener('click', () => {
            window.location.href = 'userProfile.html?section=history';
        });

        // Streaming Statistics → UserProfile.html#section-stats
        const goStats = document.querySelector('.pd-menu-list .pd-menu-item:nth-child(3)');
        if (goStats) goStats.addEventListener('click', () => {
            window.location.href = 'userProfile.html?section=stats';
        });

        // Case B: Preference → UserProfile.html (smooth-scroll to Preferences)
        const goPrefs = document.querySelector('.pd-menu-list .pd-menu-item:nth-child(4)');
        if (goPrefs) goPrefs.addEventListener('click', () => {
            window.location.href = 'userProfile.html?section=preferences';
        });

        // Hover highlight on menu items
        document.querySelectorAll('.pd-menu-item').forEach(item => {
            item.addEventListener('mouseenter', () => item.classList.add('hovered'));
            item.addEventListener('mouseleave', () => item.classList.remove('hovered'));
        });

        initProfile();
    })();

// ==========================================================================
// PREFERENCES AND WATCH HISTORY
// ==========================================================================
const FONT_OPTIONS = {
    "font-inter": "'Inter', sans-serif",
    "font-mono": "'JetBrains Mono', monospace",
    "font-sans": "'Work Sans', sans-serif",
    "font-lexend": "'Lexend Deca', sans-serif",
};

const DEFAULT_FONT_ID = "font-inter";
const DEFAULT_LANG = "en";
const DEFAULT_THEME = "dark";
const WATCH_HISTORY_KEY = "notflix_watch_history";
const WATCH_PROGRESS_KEY = "notflix_watch_progress";
const WATCH_PLANNING_KEY = "notflix_watch_planning";
const WATCH_COMPLETED_KEY = "notflix_watch_completed";

// Local video paths used by the player when a TMDB title has a matching local file.
const VIDEO_SOURCES = {
    movie: {},
    episode: {
        "tv:85937:s3:e10": "videos/demonSlayerS3E10.mp4",
        "tv:95479:s1:e1": "videos/JUJUTSU KAISEN (2020) S1E1.mp4",
        "tv:95479:s1:e33": "videos/JJKS2EP09.mp4",
    },
};

let activePlaybackItem = null;
let activeProgressKey = null;
let activeProgressLoaded = false;
let currentPlayerMedia = null;

// Translation dictionary for navigation, profile labels, home rows, and player tabs.
const translations = {
    en: {
        nav: ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Mystery"],
        signIn: "Sign In",
        account: "MY ACCOUNT",
        menu: ["Profile Settings", "Watch History", "Streaming Statistics", "Preference", "Sign Out"],
        home: {
            watchNow: "Watch Now",
            trailer: "Trailer",
            rows: ["Top 10 Today", "Popular Anime", "Trending K-Dramas", "Western Horror", "Coming Soon & New Releases"],
        },
        profile: {
            overview: "Overview",
            history: "Watch History",
            habits: "Viewing Habits",
            stats: "Statistics",
            total: "TOTAL WATCHED",
            completed: "COMPLETED",
            watching: "3 Watching",
            planning: "2 Planning",
            breakdown: "BREAKDOWN",
            movies: "Movies",
            series: "Series",
            prefOverline: "Personalization",
            pref: "Preferences",
            theme: "Theme",
            lang: "Language",
            member: "Premium Member since March 2026",
            emptyHistory: "Your watched titles will appear here after you press Stream.",
            continue: "Continue",
        },
        player: ["Overview", "Episodes", "More Like This", "Details", "Cast Members", "English [Original]"],
    },
    ja: {
        nav: ["アクション", "コメディ", "ドラマ", "SF", "ホラー", "ミステリー"],
        signIn: "サインイン",
        account: "マイアカウント",
        menu: ["プロフィール設定", "視聴履歴", "配信統計", "設定", "サインアウト"],
        home: {
            watchNow: "今すぐ見る",
            trailer: "予告編",
            rows: ["今日のトップ10", "人気アニメ", "話題の韓国ドラマ", "海外ホラー", "近日公開・新作"],
        },
        profile: {
            overview: "概要",
            history: "視聴履歴",
            habits: "視聴習慣",
            stats: "統計",
            total: "総視聴数",
            completed: "完了",
            watching: "3件を視聴中",
            planning: "2件を予定",
            breakdown: "内訳",
            movies: "映画",
            series: "シリーズ",
            prefOverline: "パーソナライズ",
            pref: "設定",
            theme: "テーマ",
            lang: "言語",
            member: "2026年3月からのプレミアム会員",
            emptyHistory: "Streamを押すと、視聴した作品がここに表示されます。",
            continue: "続きから",
        },
        player: ["概要", "エピソード", "関連作品", "詳細", "出演者", "日本語"],
    },
    ko: {
        nav: ["액션", "코미디", "드라마", "SF", "호러", "미스터리"],
        signIn: "로그인",
        account: "내 계정",
        menu: ["프로필 설정", "시청 기록", "스트리밍 통계", "설정", "로그아웃"],
        home: {
            watchNow: "지금 보기",
            trailer: "예고편",
            rows: ["오늘의 TOP 10", "인기 애니메이션", "인기 K-드라마", "서양 호러", "공개 예정 및 신작"],
        },
        profile: {
            overview: "개요",
            history: "시청 기록",
            habits: "시청 습관",
            stats: "통계",
            total: "총 시청 수",
            completed: "완료",
            watching: "3개 시청 중",
            planning: "2개 예정",
            breakdown: "내역",
            movies: "영화",
            series: "시리즈",
            prefOverline: "개인화",
            pref: "설정",
            theme: "테마",
            lang: "언어",
            member: "2026년 3월부터 프리미엄 회원",
            emptyHistory: "Stream을 누르면 시청한 작품이 여기에 표시됩니다.",
            continue: "이어보기",
        },
        player: ["개요", "에피소드", "비슷한 콘텐츠", "상세 정보", "출연진", "한국어"],
    },
    zh: {
        nav: ["动作", "喜剧", "剧情", "科幻", "恐怖", "悬疑"],
        signIn: "登录",
        account: "我的账户",
        menu: ["个人资料设置", "观看历史", "流媒体统计", "偏好设置", "退出登录"],
        home: {
            watchNow: "立即观看",
            trailer: "预告片",
            rows: ["今日前10", "热门动漫", "热门韩剧", "欧美恐怖", "即将上线与新片"],
        },
        profile: {
            overview: "概览",
            history: "观看历史",
            habits: "观看习惯",
            stats: "统计",
            total: "总观看数",
            completed: "已完成",
            watching: "3部观看中",
            planning: "2部计划中",
            breakdown: "明细",
            movies: "电影",
            series: "剧集",
            prefOverline: "个性化",
            pref: "偏好设置",
            theme: "主题",
            lang: "语言",
            member: "自2026年3月起的高级会员",
            emptyHistory: "点击 Stream 后，你观看过的作品会显示在这里。",
            continue: "继续观看",
        },
        player: ["概览", "剧集", "更多类似内容", "详情", "演员", "中文"],
    },
};
function setTheme(name) {
    localStorage.setItem("user-theme", name);
    document.documentElement.setAttribute("data-theme", name);
    document.getElementById("theme-dark")?.classList.toggle("active", name === "dark");
    document.getElementById("theme-light")?.classList.toggle("active", name === "light");
}

function setFont(fontString, id = DEFAULT_FONT_ID) {
    localStorage.setItem("user-font", fontString);
    localStorage.setItem("user-font-id", id);
    document.documentElement.style.setProperty("--main-font", fontString);
    document.querySelectorAll('[id^="font-"]').forEach(button => button.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");
}

function setLanguage(code) {
    const dictionary = translations[code] || translations[DEFAULT_LANG];
    localStorage.setItem("user-lang", code);
    document.documentElement.lang = code;
    applyTranslations(dictionary);
    document.querySelectorAll('[id^="lang-"]').forEach(button => button.classList.remove("active"));
    document.getElementById(`lang-${code}`)?.classList.add("active");
    renderWatchHistory();
}

function applyPreferences() {
    const theme = localStorage.getItem("user-theme") || DEFAULT_THEME;
    const font = localStorage.getItem("user-font") || FONT_OPTIONS[DEFAULT_FONT_ID];
    const fontId = localStorage.getItem("user-font-id") || DEFAULT_FONT_ID;
    const lang = localStorage.getItem("user-lang") || DEFAULT_LANG;
    setTheme(theme);
    setFont(font, fontId);
    setLanguage(lang);
}

function applyTranslations(dictionary) {
    document.querySelectorAll("#nav-categories .category-item a").forEach((link, index) => {
        if (dictionary.nav[index]) link.textContent = dictionary.nav[index];
    });
    setOwnText(document.getElementById("nav-signin-btn"), dictionary.signIn);
    setText(".pd-label", dictionary.account);
    document.querySelectorAll(".pd-menu-list .pd-menu-item").forEach((item, index) => {
        if (dictionary.menu[index]) setOwnText(item, dictionary.menu[index]);
    });

    setOwnText(document.querySelector(".hero-btn-primary"), dictionary.home.watchNow);
    setOwnText(document.querySelector(".hero-btn-secondary"), dictionary.home.trailer);
    document.querySelectorAll(".category-section:not(.continue-section):not(.planning-section) .category-title").forEach((title, index) => {
        if (dictionary.home.rows[index]) title.textContent = dictionary.home.rows[index];
    });

    setText("#section-history .overline", dictionary.profile.overview);
    setText("#title-history", dictionary.profile.history);
    setText("#title-habits-overline", dictionary.profile.habits);
    setText("#title-stats", dictionary.profile.stats);
    setText(".stats-box h3", dictionary.profile.total);
    setText(".completed-lbl", dictionary.profile.completed);
    setText("#title-breakdown", dictionary.profile.breakdown);
    document.querySelectorAll(".media-label").forEach((label, index) => {
        label.textContent = index === 0 ? dictionary.profile.movies : dictionary.profile.series;
    });
    setText("#section-preferences .overline", dictionary.profile.prefOverline);
    setText("#title-pref", dictionary.profile.pref);
    setText("#lbl-theme", dictionary.profile.theme);
    setText("#lbl-lang", dictionary.profile.lang);
    setText("#member-since", dictionary.profile.member);

    document.querySelectorAll(".capsule-tab-btn").forEach((button, index) => {
        if (dictionary.player[index]) button.textContent = dictionary.player[index];
    });
    setText(".cast-section-title", dictionary.player[4]);
    setText("#audio-track-label", dictionary.player[5]);
}

function setText(selector, text) {
    const nodes = typeof selector === "string" ? document.querySelectorAll(selector) : [selector];
    nodes.forEach(node => {
        if (node) node.textContent = text;
    });
}

function setOwnText(element, text) {
    if (!element) return;
    const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
    if (textNode) {
        textNode.nodeValue = ` ${text}`;
    } else {
        element.appendChild(document.createTextNode(` ${text}`));
    }
}

function initProfilePage() {
    setupUsernameEditor();
    setupDemoReset();
    renderWatchHistory();
    setupHistorySeeAllButton();
    setupHistorySliderDrag();
    handleProfileDeepLink();
}

function setupDemoReset() {
    const button = document.getElementById("reset-demo-btn");
    if (!button || button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
        localStorage.clear();
        button.classList.add("loading");
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> RESETTING`;
        setTimeout(() => window.location.reload(), 450);
    });
}

function initSignupPage() {
    if (!document.body.classList.contains("signup-body")) return;

    const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
    const strengthColors = ["", "#e24b4a", "#EF9F27", "#EF9F27", "#52b347"];
    const strengthClasses = ["", "weak", "fair", "fair", "strong"];

    const setAuthTab = (tab) => {
        ["login", "signup"].forEach(name => {
            document.getElementById(`tab-${name}`)?.classList.toggle("active", name === tab);
            document.getElementById(`form-${name}`)?.classList.toggle("hidden", name !== tab);
        });
    };

    const setPasswordVisibility = (inputId, iconId, button) => {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if (!input || !icon) return;

        const isShowing = input.type === "password";
        input.type = isShowing ? "text" : "password";
        icon.className = `ti ${isShowing ? "ti-eye-off" : "ti-eye"}`;
        button?.setAttribute("aria-label", isShowing ? "Hide password" : "Show password");
    };

    const updatePasswordStrength = (value) => {
        const score = [
            value.length >= 8,
            /[A-Z]/.test(value),
            /[0-9]/.test(value),
            /[^A-Za-z0-9]/.test(value),
        ].filter(Boolean).length;

        ["b1", "b2", "b3", "b4"].forEach((id, index) => {
            const bar = document.getElementById(id);
            if (bar) bar.className = `sbar${index < score ? ` ${strengthClasses[score]}` : ""}`;
        });

        const label = document.getElementById("sl");
        if (label) {
            label.textContent = value ? strengthLabels[score] : "";
            label.style.color = value ? strengthColors[score] : "";
        }
    };

    const setFieldState = (wrapId, errId, valid) => {
        const wrapper = document.getElementById(wrapId);
        const error = document.getElementById(errId);
        if (wrapper) {
            wrapper.classList.toggle("valid", valid);
            wrapper.classList.toggle("error", !valid);
        }
        error?.classList.toggle("show", !valid);
        return valid;
    };

    const showLoader = (message, callback) => {
        const loader = document.getElementById("loader");
        const loaderMessage = document.getElementById("loader-msg");
        if (loaderMessage) loaderMessage.textContent = message;
        loader?.classList.add("show");
        setTimeout(() => {
            loader?.classList.remove("show");
            callback();
        }, 2000);
    };

    const submitLogin = () => {
        const username = document.getElementById("lu")?.value.trim() || "";
        const password = document.getElementById("lp")?.value || "";
        const isValid = [
            setFieldState("w-lu", "e-lu", Boolean(username)),
            setFieldState("w-lp", "e-lp", Boolean(password)),
        ].every(Boolean);

        if (!isValid) return;
        showLoader("Logging in...", () => {
            localStorage.setItem("notflix_user", username);
            window.location.href = "index.html";
        });
    };

    const submitSignup = () => {
        const username = document.getElementById("su")?.value.trim() || "";
        const email = document.getElementById("se")?.value.trim() || "";
        const password = document.getElementById("sp")?.value || "";
        const confirmation = document.getElementById("sc")?.value || "";
        const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const isValid = [
            setFieldState("w-su", "e-su", username.length >= 3),
            setFieldState("w-se", "e-se", emailIsValid),
            setFieldState("w-sp", "e-sp", password.length >= 8),
            setFieldState("w-sc", "e-sc", Boolean(confirmation) && confirmation === password),
        ].every(Boolean);

        if (!isValid) return;
        showLoader("Creating account...", () => {
            localStorage.setItem("notflix_user", username);
            window.location.href = "index.html";
        });
    };

    document.querySelectorAll("[data-auth-tab]").forEach(trigger => {
        trigger.addEventListener("click", () => setAuthTab(trigger.dataset.authTab));
    });

    document.querySelectorAll("[data-eye-input]").forEach(button => {
        button.addEventListener("click", () => {
            setPasswordVisibility(button.dataset.eyeInput, button.dataset.eyeIcon, button);
        });
    });

    document.getElementById("sp")?.addEventListener("input", event => updatePasswordStrength(event.target.value));
    document.getElementById("login-submit")?.addEventListener("click", submitLogin);
    document.getElementById("signup-submit")?.addEventListener("click", submitSignup);
}

function setupUsernameEditor() {
    const editButton = document.getElementById("edit-username-btn");
    const display = document.getElementById("username-display");
    if (!editButton || !display || editButton.dataset.bound === "true") return;
    editButton.dataset.bound = "true";
    const storedName = localStorage.getItem("notflix_user") || localStorage.getItem("notflix_profile_name");
    if (storedName) display.textContent = storedName;

    editButton.addEventListener("click", () => {
        const current = display.textContent.trim();
        const input = document.createElement("input");
        input.type = "text";
        input.value = current;
        input.className = "username-edit-input";
        display.replaceWith(input);
        input.focus();
        input.select();

        const save = () => {
            const value = input.value.trim() || current;
            display.textContent = value;
            localStorage.setItem("notflix_user", value);
            localStorage.setItem("notflix_profile_name", value);
            document.querySelectorAll("#pd-username").forEach(el => { el.textContent = value; });
            input.replaceWith(display);
        };

        input.addEventListener("blur", save);
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") {
                input.value = current;
                save();
            }
        });
    });
}

function handleProfileDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    const map = {
        profile: "section-profile",
        history: "section-history",
        stats: "section-stats",
        preferences: "section-preferences",
    };
    if (!section || !map[section] || handleProfileDeepLink.done) return;
    handleProfileDeepLink.done = true;
    setTimeout(() => document.getElementById(map[section])?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
}

function readWatchHistory() {
    try {
        return JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveWatchHistoryFromDetails(details) {
    if (!details || !details.id || !details.type) return;
    const title = details.title || details.name || details.original_name || "Untitled";
    const year = details.year || (details.release_date || details.first_air_date || "").split("-")[0] || "----";
    const posterUrl = details.posterUrl || (details.posterPath ? `${POSTER_URL}${details.posterPath}` : "");
    const nextItem = {
        id: String(details.id),
        type: details.type,
        title,
        year,
        posterUrl,
        watchedAt: details.watchedAt || Date.now(),
    };
    removePlanningItem(nextItem.id, nextItem.type);
    const history = readWatchHistory().filter(item => !(String(item.id) === nextItem.id && item.type === nextItem.type));
    history.unshift(nextItem);
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

function renderWatchHistory() {
    const grid = document.querySelector(".watch-history-grid");
    if (!grid) return;
    const history = readWatchHistory();
    const lang = localStorage.getItem("user-lang") || DEFAULT_LANG;
    const dictionary = translations[lang] || translations[DEFAULT_LANG];

    if (!history.length) {
        grid.innerHTML = `<p class="watch-history-empty">${dictionary.profile.emptyHistory}</p>`;
        updateHistoryStats(history, dictionary);
        return;
    }

    grid.innerHTML = history.map((item, index) => createWatchHistoryCard(item, index, dictionary)).join("");
    grid.querySelectorAll(".wh-card").forEach(card => {
        card.addEventListener("click", () => {
            const id = card.dataset.id;
            const type = card.dataset.type;
            if (id && type) window.location.href = `videoplayer.html?id=${id}&type=${type}`;
        });
    });
    updateHistoryStats(history, dictionary);
    
    // Setup drag and see all functionality
    setupHistorySeeAllButton();
    setupHistorySliderDrag();
}

function createWatchHistoryCard(item, index, dictionary) {
    const title = escapeHtml(item.title || "Untitled");
    const typeLabel = item.type === "tv" ? dictionary.profile.series : dictionary.profile.movies;
    const year = escapeHtml(item.year || "----");
    const poster = item.posterUrl ? `<img src="${escapeAttribute(item.posterUrl)}" alt="${title}">` : "";
    return `
            <div class="wh-card" data-id="${escapeAttribute(item.id)}" data-type="${escapeAttribute(item.type)}">
                <div class="wh-poster${index === 0 ? " highlight-border" : ""}">
                    ${poster}
                    <div class="wh-poster-overlay">
                        <div class="wh-play-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="11" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/>
                                <path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="white"/>
                            </svg>
                            <span class="wh-play-label">${dictionary.profile.continue}</span>
                        </div>
                    </div>
                </div>
                <div class="wh-title">${title}</div>
                <div class="wh-meta">${typeLabel} - ${year}</div>
            </div>`;
}

function setupHistorySeeAllButton() {
    const btn = document.getElementById("history-see-all-btn");
    const grid = document.querySelector(".watch-history-grid");
    if (!btn || !grid) return;
    if (btn.dataset.bound === "true") return;
    btn.dataset.bound = "true";
    
    btn.addEventListener("click", () => {
        historyExpanded = !historyExpanded;
        grid.classList.toggle("expanded", historyExpanded);
        btn.textContent = historyExpanded ? "Collapse" : "See All";
    });
}

function setupHistorySliderDrag() {
    const grid = document.querySelector(".watch-history-grid");
    if (!grid || grid.dataset.drag === "true") return;
    grid.dataset.drag = "true";
    
    let isDragging = false;
    let startX;
    let scrollLeft;

    grid.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.pageX - grid.offsetLeft;
        scrollLeft = grid.scrollLeft;
        grid.classList.add("drag-active");
    });

    grid.addEventListener("mouseleave", () => {
        isDragging = false;
        grid.classList.remove("drag-active");
    });

    grid.addEventListener("mouseup", () => {
        isDragging = false;
        grid.classList.remove("drag-active");
    });

    grid.addEventListener("mousemove", (e) => {
        if (!isDragging || historyExpanded) return;
        e.preventDefault();
        const x = e.pageX - grid.offsetLeft;
        const walk = (x - startX) * 1;
        grid.scrollLeft = scrollLeft - walk;
    });
}

function updateHistoryStats(history, dictionary = translations[localStorage.getItem("user-lang") || DEFAULT_LANG]) {
    const planning = readPlanningItems();
    const completed = readCompletedItems();
    const watching = getWatchingStatItems(history);
    const movieCount = completed.filter(item => item.type === "movie").length;
    const seriesCount = completed.filter(item => item.type === "tv").length;
    const total = completed.length;
    const moviePct = total ? Math.round((movieCount / total) * 100) : 0;
    const seriesPct = total ? 100 - moviePct : 0;
    setText("#main-counter", String(total));
    setText("#tab-watching", `${watching.length} Watching`);
    setText("#tab-planning", `${planning.length} Planning`);
    setText("#count-movies", String(movieCount));
    setText("#count-series", String(seriesCount));
    setText("#lbl-movies-pct", `${dictionary.profile.movies} ${moviePct}%`);
    setText("#lbl-series-pct", `${dictionary.profile.series} ${seriesPct}%`);
    const moviesBar = document.getElementById("bar-movies");
    const seriesBar = document.getElementById("bar-series");
    if (moviesBar) moviesBar.style.width = `${moviePct}%`;
    if (seriesBar) seriesBar.style.width = `${seriesPct}%`;
}

function getWatchingStatItems(history = readWatchHistory()) {
    const activeProgress = getContinueWatchingItems().map(item => ({
        id: String(item.id),
        type: item.type,
    }));
    const map = new Map();
    [...activeProgress, ...history].forEach(item => {
        if (!item.id || !item.type || isCompletedItem(item.id, item.type)) return;
        map.set(`${item.type}:${item.id}`, item);
    });
    return [...map.values()];
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    }[char]));
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
}

// ==========================================================================
// NAV SEARCH
// ==========================================================================
function updateCategoryNavHrefs() {
    document.querySelectorAll("#nav-categories .category-item").forEach(item => {
        const page = item.dataset.page;
        const link = item.querySelector("a");
        if (page && link) link.href = page === "action" ? "index.html?page=action" : `index.html?page=${encodeURIComponent(page)}`;
    });
}

let liveSearchTimer = null;
let latestSearchRequest = 0;

function initNavSearch() {
    updateCategoryNavHrefs();
    const navRight = document.querySelector(".global-navbar .nav-right");
    if (!navRight || document.getElementById("nav-search-form")) return;

    const form = document.createElement("form");
    form.className = "nav-search-form";
    form.id = "nav-search-form";
    form.setAttribute("role", "search");
    form.innerHTML = `
        <button class="nav-search-icon" type="submit" aria-label="Search">
            <i class="fa-solid fa-magnifying-glass"></i>
        </button>
        <input class="nav-search-input" id="nav-search-input" type="search" placeholder="Search" autocomplete="off" />
    `;
    navRight.prepend(form);

    const input = form.querySelector(".nav-search-input");

    input?.addEventListener("input", () => {
        const query = input.value.trim();
        const homePage = document.getElementById("page-home");
        clearTimeout(liveSearchTimer);

        if (!homePage) return;

        if (!query) {
            latestSearchRequest++;
            history.replaceState(null, "", "index.html");
            showPage("action");
            return;
        }

        if (query.length < 2) { latestSearchRequest++; return; }

        liveSearchTimer = setTimeout(() => {
            runSearch(query);
            history.replaceState(null, "", `index.html?search=${encodeURIComponent(query)}`);
        }, 300);
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = input?.value.trim();
        if (!query) return;
        const homePage = document.getElementById("page-home");
        if (homePage) {
            clearTimeout(liveSearchTimer);
            runSearch(query);
            history.replaceState(null, "", `index.html?search=${encodeURIComponent(query)}`);
        } else {
            window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        }
    });
}

async function runSearch(query) {
    const requestId = ++latestSearchRequest;
    const homeEl = document.getElementById("page-home");
    const categoryEl = document.getElementById("page-category");
    const titleEl = document.getElementById("category-page-title");
    const subtitleEl = document.getElementById("category-page-subtitle");
    const grid = document.getElementById("category-grid");
    if (!homeEl || !categoryEl || !titleEl || !subtitleEl || !grid) return;

    currentPage = "search";
    document.querySelectorAll("#nav-categories .category-item").forEach(item => item.classList.remove("active"));
    const indicator = document.getElementById("nav-indicator");
    if (indicator) indicator.style.opacity = "0";

    homeEl.classList.add("page-hidden");
    categoryEl.classList.remove("page-hidden");
    categoryEl.classList.add("search-mode");
    titleEl.textContent = `Search results for "${query}"`;
    subtitleEl.textContent = "Movies and series from TMDB";

    grid.innerHTML = "";
    for (let i = 0; i < 12; i++) {
        const sk = document.createElement("div");
        sk.className = "movie-card skeleton";
        sk.innerHTML = `<div class="card-image-placeholder"></div>`;
        grid.appendChild(sk);
    }

    try {
        const url = `${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
        const res = await fetch(url);
        const data = await res.json();
        if (requestId !== latestSearchRequest) return;
        const results = (data.results || []).filter(item =>
            (item.media_type === "movie" || item.media_type === "tv") && item.poster_path
        );

        grid.innerHTML = "";
        if (!results.length) {
            grid.innerHTML = `<p class="error-msg">No results found for "${escapeHtml(query)}".</p>`;
            return;
        }

        results.slice(0, 30).forEach(item => {
            const type = item.media_type;
            const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
            const card = document.createElement("div");
            card.className = "movie-card";
            card.dataset.id = item.id;
            card.dataset.type = type;
            card.innerHTML = `
                <span class="rating-badge">&#9733; ${rating}</span>
                <div class="card-image-placeholder" style="background-image: url('${POSTER_URL}${item.poster_path}')"></div>
            `;
            card.addEventListener("click", () => openDetailModal(item.id, type));
            grid.appendChild(card);
        });
    } catch (err) {
        if (requestId !== latestSearchRequest) return;
        console.error("Search error:", err);
        grid.innerHTML = `<p class="error-msg">Search failed. Please try again.</p>`;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}
