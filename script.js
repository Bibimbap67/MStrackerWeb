// ==========================================================================
// CONFIGURATION
// ==========================================================================
const TMDB_API_KEY = "0a0e2bf9fe54e6e65320d51734e258a4";
const BASE_URL    = "https://api.themoviedb.org/3";
const IMAGE_URL   = "https://image.tmdb.org/t/p/original";
const POSTER_URL  = "https://image.tmdb.org/t/p/w342";

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
document.addEventListener("DOMContentLoaded", () => {
    if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY_HERE") {
        alert("Please insert your TMDb API Key inside script.js!");
        return;
    }

    setupNavSPA();
    showPage("action"); // default landing page = Action (home)

    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("detail-modal").addEventListener("click", (e) => {
        if (e.target.id === "detail-modal") closeModal();
    });

    // Stream button → navigate to videoplayer with current modal's id & type
    document.querySelector(".btn-stream").addEventListener("click", () => {
        if (currentModalId && currentModalType) {
            window.location.href = `videoplayer.html?id=${currentModalId}&type=${currentModalType}`;
        }
    });

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

// ==========================================================================
// SCROLL — navbar blur
// ==========================================================================
function onScroll() {
    document.getElementById("main-nav").classList.toggle("scrolled", window.scrollY > 10);
}