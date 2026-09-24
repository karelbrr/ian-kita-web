/**
 * Client-side behaviour for the whole site. Everything here is progressive
 * enhancement: the page is fully readable with JavaScript disabled, and every
 * motion effect is gated behind prefers-reduced-motion in CSS.
 */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Scroll reveals ---------------------------------------------------------
function setupReveals() {
    const revealEls = document.querySelectorAll('.reveal, .stagger, .timeline');

    document.querySelectorAll('.stagger').forEach((group) => {
        Array.from(group.children).forEach((child, i) => {
            (child as HTMLElement).style.setProperty('--i', String(i));
        });
    });

    if (!('IntersectionObserver' in window)) {
        revealEls.forEach((el) => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            }
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    revealEls.forEach((el) => observer.observe(el));
}

// --- Fixed nav: translucent once the page has scrolled ----------------------
function setupNav() {
    const nav = document.querySelector<HTMLElement>('[data-nav]');
    if (!nav) return;

    const update = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });

    const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
    const menu = document.getElementById('menu');
    if (!toggle || !menu) return;

    const labelOpen = toggle.dataset.labelOpen ?? 'Menu';
    const labelClose = toggle.dataset.labelClose ?? 'Close';

    const setOpen = (open: boolean) => {
        menu.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? labelClose : labelOpen;
        document.body.classList.toggle('menu-open', open);
        if (open) menu.querySelector<HTMLElement>('a')?.focus();
    };

    toggle.addEventListener('click', () => setOpen(Boolean(menu.hidden)));
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !menu.hidden) {
            setOpen(false);
            toggle.focus();
        }
    });
}

// --- Lazy, muted background video --------------------------------------------
// The <video> ships with only a poster. The source is attached (and playback
// started) once the section scrolls near the viewport, and paused again when
// it leaves. Skipped entirely for reduced-motion and data-saver visitors, who
// simply see the poster frame.
function setupLazyVideo() {
    const videos = document.querySelectorAll<HTMLVideoElement>('video[data-lazy-video]');
    if (videos.length === 0) return;

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reducedMotion || connection?.saveData) return;

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                const video = entry.target as HTMLVideoElement;
                if (entry.isIntersecting) {
                    if (!video.dataset.loaded) {
                        video.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((s) => {
                            s.src = s.dataset.src ?? '';
                        });
                        video.load();
                        video.dataset.loaded = 'true';
                    }
                    video.play().catch(() => {
                        /* autoplay blocked — the poster stays visible */
                    });
                } else if (!video.paused) {
                    video.pause();
                }
            }
        },
        { rootMargin: '25% 0px' },
    );
    videos.forEach((v) => observer.observe(v));
}

// --- Gallery lightbox --------------------------------------------------------
function setupLightbox() {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[data-lightbox-dialog]');
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[data-lightbox]'));
    if (!dialog || links.length === 0 || typeof dialog.showModal !== 'function') return;

    const img = dialog.querySelector<HTMLImageElement>('[data-lightbox-img]');
    const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]');
    const counter = dialog.querySelector<HTMLElement>('[data-lightbox-counter]');
    if (!img || !caption || !counter) return;

    let index = 0;

    img.addEventListener('load', () => dialog.classList.remove('is-loading'));
    img.addEventListener('error', () => dialog.classList.remove('is-loading'));

    const show = (i: number) => {
        index = (i + links.length) % links.length;
        const link = links[index];
        if (img.src !== link.href) dialog.classList.add('is-loading');
        img.src = link.href;
        img.alt = link.dataset.alt ?? '';
        caption.textContent = link.dataset.caption ?? '';
        counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(links.length).padStart(2, '0')}`;
    };

    links.forEach((link, i) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            show(i);
            dialog.showModal();
        });
    });

    dialog.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => show(index - 1));
    dialog.querySelector('[data-lightbox-next]')?.addEventListener('click', () => show(index + 1));
    dialog.querySelector('[data-lightbox-close]')?.addEventListener('click', () => dialog.close());

    dialog.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') show(index - 1);
        if (e.key === 'ArrowRight') show(index + 1);
    });

    // Click on the dimmed area (outside the figure) closes.
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
    });
}

// --- Scroll progress fallback ------------------------------------------------
// Browsers with scroll-driven animations handle the bar in CSS alone.
function setupScrollProgressFallback() {
    if (CSS.supports('animation-timeline: scroll()')) return;
    const bar = document.querySelector<HTMLElement>('.scroll-progress');
    if (!bar) return;
    const update = () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${scrollable > 0 ? window.scrollY / scrollable : 0})`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
}

setupReveals();
setupNav();
setupLazyVideo();
setupLightbox();
setupScrollProgressFallback();
