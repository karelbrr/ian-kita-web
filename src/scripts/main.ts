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

// --- Journey timeline scrubbed by scroll -------------------------------------
// On desktop the scroll from the section reaching mid-screen until the pinned
// text column releases walks the line through the milestones in order, while
// CSS drifts the photo through the extra track length below it. On narrower
// screens nothing is pinned, so the line follows a focus point 60% down the
// viewport instead. Either way the photo swaps to the active milestone's era.
function setupJourney() {
    const section = document.querySelector<HTMLElement>('[data-journey]');
    const timeline = section?.querySelector<HTMLElement>('[data-journey-timeline]');
    const pinned = timeline?.parentElement;
    const grid = pinned?.parentElement;
    if (!section || !timeline || !pinned || !grid) return;

    const items = Array.from(timeline.querySelectorAll<HTMLElement>('[data-milestone]'));
    if (items.length < 2) return;

    const year = section.querySelector<HTMLElement>('[data-journey-year]');
    const shots = Array.from(section.querySelectorAll<HTMLElement>('[data-journey-shot]'));
    const desktop = window.matchMedia('(min-width: 1024px)');
    let activeIndex = -1;
    let pinnedHeight = 0;
    let frame = 0;

    const markerOffsets = () => {
        const top = timeline.getBoundingClientRect().top;
        return items.map((item) => {
            const marker = item.querySelector('[data-milestone-marker]')?.getBoundingClientRect();
            return marker ? marker.top + marker.height / 2 - top : 0;
        });
    };

    const showYear = (value: string) => {
        if (!year || year.textContent?.trim() === value) return;
        year.textContent = value;
        if (reducedMotion) return;
        year.animate(
            [
                { opacity: 0, transform: 'translateY(0.2em)' },
                { opacity: 1, transform: 'none' },
            ],
            { duration: 450, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        );
    };

    const update = () => {
        frame = 0;
        const offsets = markerOffsets();
        const last = offsets.length - 1;
        const gridRect = grid.getBoundingClientRect();
        const travel = gridRect.height - pinned.offsetHeight;

        let fill: number;
        if (desktop.matches) {
            const start = window.innerHeight * 0.5;
            const end = (parseFloat(getComputedStyle(pinned).top) || 0) - Math.max(travel, 0);
            const progress = Math.min(Math.max((start - gridRect.top) / (start - end), 0), 1);
            const position = progress * last;
            const i = Math.min(Math.floor(position), last - 1);
            fill = offsets[i] + (offsets[i + 1] - offsets[i]) * (position - i);
        } else {
            const focus = window.innerHeight * 0.6 - timeline.getBoundingClientRect().top;
            fill = Math.min(Math.max(focus, 0), offsets[last]);
        }

        timeline.style.setProperty('--timeline-fill', String(fill / timeline.offsetHeight));
        if (pinnedHeight !== pinned.offsetHeight) {
            pinnedHeight = pinned.offsetHeight;
            section.style.setProperty('--journey-pinned-h', `${pinnedHeight}px`);
        }

        const next = offsets.reduce((found, offset, i) => (offset <= fill + 1 ? i : found), -1);
        if (next === activeIndex) return;
        activeIndex = next;
        items.forEach((item, i) => {
            item.dataset.state = i < next ? 'past' : i === next ? 'active' : 'future';
        });
        const shotIndex = Number(items[Math.max(next, 0)].dataset.shot ?? 0);
        shots.forEach((shot, i) => shot.classList.toggle('is-active', i === shotIndex));
        if (next >= 0) showYear(items[next].dataset.year ?? '');
    };

    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(update);
    };

    timeline.classList.add('is-scrubbed');
    if (!reducedMotion) section.classList.add('is-scrubbed');
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
}

// --- Nav scroll-spy -------------------------------------------------------------
// Marks the desktop nav link of the section crossing the upper-middle band of
// the viewport with aria-current, which the CSS turns into the current state.
function setupScrollSpy() {
    if (!('IntersectionObserver' in window)) return;
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-nav] nav a[href*="#"]'));
    const sections = links
        .map((link) => document.getElementById(link.hash.slice(1)))
        .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;

    const inBand = new Set<Element>();
    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) inBand.add(entry.target);
                else inBand.delete(entry.target);
            }
            const current = sections.find((section) => inBand.has(section));
            links.forEach((link) => {
                if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'true');
                else link.removeAttribute('aria-current');
            });
        },
        { rootMargin: '-40% 0px -55% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
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

// --- Copy-to-clipboard buttons -----------------------------------------------
// Buttons ship hidden and appear only where the async Clipboard API exists
// (secure contexts), so nobody is offered a button that cannot work.
function setupCopyButtons() {
    if (!navigator.clipboard?.writeText) return;
    document.querySelectorAll<HTMLButtonElement>('button[data-copy]').forEach((button) => {
        const label = button.querySelector<HTMLElement>('[data-copy-label]') ?? button;
        const idle = label.textContent ?? '';
        let timer: number | undefined;
        button.hidden = false;
        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(button.dataset.copy ?? '');
            } catch {
                return;
            }
            label.textContent = button.dataset.copiedLabel ?? 'Copied';
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                label.textContent = idle;
            }, 2000);
        });
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
setupJourney();
setupNav();
setupScrollSpy();
setupLazyVideo();
setupLightbox();
setupCopyButtons();
setupScrollProgressFallback();
