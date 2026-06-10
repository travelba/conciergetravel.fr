'use client';

import { useEffect } from 'react';

/**
 * Client behaviours from `DA/assets/app.js` for kit hotel fiches:
 * read-more toggle, experiences "voir plus", around-list collapses, mini-galleries.
 */
export function HotelKitInteractions(): null {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    document.querySelectorAll('.read-more').forEach((rm) => {
      const btn = rm.querySelector('.rm-toggle');
      if (!(btn instanceof HTMLButtonElement)) return;
      const labelMore = btn.getAttribute('data-more') ?? 'Lire la description complète';
      const labelLess = btn.getAttribute('data-less') ?? 'Réduire';
      const onClick = (): void => {
        const open = rm.classList.toggle('open');
        const span = btn.querySelector('span');
        if (span) span.textContent = open ? labelLess : labelMore;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    });

    document.querySelectorAll('.review-toggle').forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const textId = btn.getAttribute('aria-controls');
      if (textId === null || textId === '') return;
      const textEl = document.getElementById(textId);
      if (textEl === null) return;
      const labelMore = btn.getAttribute('data-more') ?? 'Voir plus';
      const labelLess = btn.getAttribute('data-less') ?? 'Voir moins';
      const onToggle = (): void => {
        const clamped = textEl.classList.toggle('is-clamped');
        btn.textContent = clamped ? labelMore : labelLess;
        btn.setAttribute('aria-expanded', clamped ? 'false' : 'true');
      };
      btn.addEventListener('click', onToggle);
      cleanups.push(() => btn.removeEventListener('click', onToggle));
    });

    document.querySelectorAll('[data-toggle-more]').forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const targetId = btn.getAttribute('data-toggle-more');
      if (targetId === null || targetId === '') return;
      const container = document.getElementById(targetId);
      if (container === null) return;
      if (!container.classList.contains('is-collapsed')) {
        container.classList.add('is-collapsed');
      }
      const labelMore = btn.getAttribute('data-more') ?? 'Voir plus';
      const labelLess = btn.getAttribute('data-less') ?? 'Voir moins';
      const onToggle = (): void => {
        const collapsed = container.classList.toggle('is-collapsed');
        btn.textContent = collapsed ? labelMore : labelLess;
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      };
      btn.addEventListener('click', onToggle);
      cleanups.push(() => btn.removeEventListener('click', onToggle));
    });

    document.querySelectorAll('.around-list[data-around-list]').forEach((list) => {
      list.classList.add('is-collapsed');
    });
    document.querySelectorAll('.around-toggle-btn').forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const onAround = (): void => {
        const sub = btn.closest('.around-sub');
        if (!sub) return;
        const list = sub.querySelector('.around-list[data-around-list]');
        if (list) list.classList.remove('is-collapsed');
        btn.style.display = 'none';
      };
      btn.addEventListener('click', onAround);
      cleanups.push(() => btn.removeEventListener('click', onAround));
    });

    document.querySelectorAll('.faq-toggle-btn').forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const group = btn.closest('.faq-group');
      const list = group?.querySelector('.faq-list[data-faq-list]');
      if (!(list instanceof HTMLElement)) return;
      const labelMore = btn.getAttribute('data-more') ?? 'Voir plus';
      const labelLess = btn.getAttribute('data-less') ?? 'Voir moins';
      const onToggle = (): void => {
        const collapsed = list.classList.toggle('is-collapsed');
        btn.textContent = collapsed ? labelMore : labelLess;
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      };
      btn.addEventListener('click', onToggle);
      cleanups.push(() => btn.removeEventListener('click', onToggle));
    });

    document.querySelectorAll('.mini-gallery').forEach((gallery) => {
      const track = gallery.querySelector('.mg-track');
      const dots = gallery.querySelectorAll('.mg-dots span');
      if (!(track instanceof HTMLElement) || dots.length === 0) return;

      const imgs = track.querySelectorAll('img');
      if (imgs.length <= 1) return;

      let idx = 0;
      const setActive = (i: number): void => {
        idx = i;
        track.style.transform = `translateX(-${i * 100}%)`;
        dots.forEach((d, j) => d.classList.toggle('on', j === i));
      };

      const dotHandlers: Array<() => void> = [];
      dots.forEach((dot, i) => {
        const onDot = (): void => setActive(i);
        dot.addEventListener('click', onDot);
        dotHandlers.push(() => dot.removeEventListener('click', onDot));
      });

      let nav = gallery.querySelector('.mg-nav');
      if (!nav) {
        nav = document.createElement('div');
        nav.className = 'mg-nav';
        nav.innerHTML =
          '<button type="button" class="mg-arw mg-prev" aria-label="Previous">‹</button><button type="button" class="mg-arw mg-next" aria-label="Next">›</button>';
        gallery.appendChild(nav);
      }
      const prev = nav.querySelector('.mg-prev');
      const next = nav.querySelector('.mg-next');
      const onPrev = (): void => setActive((idx - 1 + imgs.length) % imgs.length);
      const onNext = (): void => setActive((idx + 1) % imgs.length);
      prev?.addEventListener('click', onPrev);
      next?.addEventListener('click', onNext);
      cleanups.push(() => {
        dotHandlers.forEach((off) => off());
        prev?.removeEventListener('click', onPrev);
        next?.removeEventListener('click', onNext);
      });
    });

    const sectionNav = document.querySelector('.mch-kit .htl-nav');
    if (sectionNav instanceof HTMLElement) {
      const links = sectionNav.querySelectorAll<HTMLAnchorElement>('.htl-nav__link');
      if (links.length > 0) {
        const targets: HTMLElement[] = [];
        for (const link of links) {
          const hash = link.getAttribute('href');
          if (hash === null || !hash.startsWith('#')) continue;
          const el = document.getElementById(hash.slice(1));
          if (el !== null) targets.push(el);
        }
        if (targets.length > 0) {
          const setActive = (id: string): void => {
            links.forEach((link) => {
              const hash = link.getAttribute('href');
              const isActive = hash === `#${id}`;
              link.classList.toggle('is-active', isActive);
              link.setAttribute('aria-current', isActive ? 'true' : 'false');
              if (isActive) {
                link.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                  inline: 'center',
                });
              }
            });
          };
          const observer = new IntersectionObserver(
            (entries) => {
              const visible = entries
                .filter((e) => e.isIntersecting)
                .sort(
                  (a, b) =>
                    (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop,
                );
              const first = visible[0];
              if (first) setActive(first.target.id);
            },
            { rootMargin: '-20% 0px -65% 0px', threshold: 0 },
          );
          for (const target of targets) observer.observe(target);
          cleanups.push(() => observer.disconnect());
        }
      }
    }

    return () => {
      cleanups.forEach((off) => off());
    };
  }, []);

  return null;
}
