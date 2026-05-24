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

// ==========================================================================
// STATE
// ==========================================================================
let heroInterval     = null;
let currentSlide     = 0;
let topMovies        = [];
let currentPage      = "action"; // tracks active SPA page
let currentModalId   = null;     // id of the currently open modal item
let currentModalType = null;     // "movie" or "tv"

// ==========================================================================
// BOOT
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY_HERE") {
        alert("Please insert your TMDb API Key inside script.js!");
        return;
    }

    const homePage = document.getElementById("page-home");
    const playerPage = document.getElementById("player-layout");

    if (homePage) {
        setupNavSPA();
        showPage("action"); // default landing page = Action (home)

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
                    window.location.href = `videoplayer.html?id=${currentModalId}&type=${currentModalType}`;
                }
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
        item.querySelector("a").addEventListener("click", (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page === currentPage) return;
            setActiveNavItem(item);
            showPage(page);
        });
    });

    // Set initial active to first item
    setActiveNavItem(items[0]);
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
            const rating = item.vote_average ? item.vote_average.toFixed(1) : "—";
            const card  = document.createElement("div");
            card.className = "movie-card";
            card.dataset.id   = item.id;
            card.dataset.type = type;
            card.innerHTML = `
                <span class="rating-badge">★ ${rating}</span>
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
            const ratingHTML = isUpcoming ? "" : `<span class="rating-badge">★ ${item.vote_average.toFixed(1)}</span>`;
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

    try {
        const [detailsRes, creditsRes] = await Promise.all([
            fetch(`${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`),
            fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`),
        ]);
        const details = await detailsRes.json();
        const credits = await creditsRes.json();

        const title    = details.title || details.name || details.original_name;
        const year     = (details.release_date || details.first_air_date || "2026").split("-")[0];
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

    document.getElementById("ov-title").innerText = title;
    document.getElementById("ov-overview").innerText = details.overview || "No overview available.";
    fallbackTitle.textContent = title;

    if (details.backdrop_path) {
        fallbackBackdrop.style.backgroundImage = `url('${IMAGE_URL}${details.backdrop_path}')`;
    }

    buildBadges(details, type, year, score, rating);
    buildCast(credits.cast || []);
    buildDetails(details, credits, type);
    buildSimilar((similar.results || []).filter(item => item.id !== parseInt(id, 10)), type);

    if (type === "tv") {
        document.getElementById("tv-right-panel").style.display = "block";
        document.getElementById("movie-right-panel").style.display = "none";
        buildSeasonSelector(details);
        const firstSeason = (details.seasons || []).find(s => s.season_number > 0)?.season_number;
        if (firstSeason) await loadSeason(id, firstSeason);
    } else {
        document.getElementById("tv-right-panel").style.display = "none";
        document.getElementById("movie-right-panel").style.display = "block";
        buildMoviePanel(details, details.poster_path ? `${IMG_POSTER}${details.poster_path}` : "");
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
        const thumb = item.backdrop_path ? `${IMG_W300}${item.backdrop_path}` : `${IMG_POSTER}${item.poster_path}`;
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

function buildSeasonSelector(details) {
    const wrapper = document.getElementById("season-selector");
    if (!wrapper) return;
    const menu    = wrapper.querySelector(".psd-menu");
    const label   = wrapper.querySelector(".psd-label");
    const trigger = wrapper.querySelector(".psd-trigger");
    const seasons = (details.seasons || []).filter(s => s.season_number > 0);

    menu.innerHTML = seasons.map((s, i) =>
        `<div class="psd-option${i === 0 ? " psd-selected" : ""}" data-value="${s.season_number}">Season ${s.season_number}</div>`
    ).join("");

    if (seasons.length > 0) label.textContent = `Season ${seasons[0].season_number}`;

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
        await loadSeason(new URLSearchParams(location.search).get("id"), val);
    });
}

async function loadSeason(seriesId, seasonNum) {
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
                <div class="track-strip-item ${active ? "active-stream-track" : ""}" data-ep="${ep.episode_number}">
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

        const html = eps.map((ep, i) => makeCard(ep, i === 0)).join("");
        listEl.innerHTML    = html || `<p style="color:rgba(255,255,255,0.3);font-size:0.85rem">No runtime records found.</p>`;
        tabListEl.innerHTML = html || listEl.innerHTML;

        [listEl, tabListEl].forEach(container => {
            container.querySelectorAll(".track-strip-item").forEach(card => {
                card.addEventListener("click", () => {
                    document.querySelectorAll(".track-strip-item").forEach(c => c.classList.remove("active-stream-track"));
                    const ep = card.dataset.ep;
                    document.querySelectorAll(`.track-strip-item[data-ep="${ep}"]`).forEach(c => c.classList.add("active-stream-track"));
                });
            });
        });

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
        const signinBtn     = document.getElementById('nav-signin-btn');
        const profileWrapper = document.getElementById('nav-profile-wrapper');
        const profileBtn    = document.getElementById('nav-profile-btn');
        const dropdown      = document.getElementById('profile-dropdown');
        const pdUsername    = document.getElementById('pd-username');
        const signoutBtn    = document.getElementById('pd-signout-btn');

        function initProfile() {
            const user = localStorage.getItem('notflix_user');
            if (user) {
                // Logged in: hide sign-in, show avatar
                signinBtn.style.display = 'none';
                profileWrapper.style.display = 'flex';
                pdUsername.textContent = user;
            } else {
                signinBtn.style.display = 'flex';
                profileWrapper.style.display = 'none';
            }
        }

        // Toggle dropdown open/close
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle('open');
            profileBtn.setAttribute('aria-expanded', isOpen);
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== profileBtn) {
                dropdown.classList.remove('open');
                profileBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Sign out
        signoutBtn.addEventListener('click', () => {
            localStorage.removeItem('notflix_user');
            dropdown.classList.remove('open');
            initProfile();
        });

        // Hover highlight on menu items
        document.querySelectorAll('.pd-menu-item').forEach(item => {
            item.addEventListener('mouseenter', () => item.classList.add('hovered'));
            item.addEventListener('mouseleave', () => item.classList.remove('hovered'));
        });

        initProfile();
    })();

