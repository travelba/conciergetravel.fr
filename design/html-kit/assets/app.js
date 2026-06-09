// Header : fond opaque au scroll
(function () {
  var header = document.getElementById('header');
  function onScroll() {
    if (window.scrollY > 60) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Reveal progressif (amélioration progressive : visible par défaut si JS off)
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (e) {
      e.classList.add('is-visible');
    });
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  els.forEach(function (e) {
    io.observe(e);
  });
  // Filet de sécurité
  setTimeout(function () {
    els.forEach(function (e) {
      e.classList.add('is-visible');
    });
  }, 1600);
})();

/* ============================================================
   FICHE HÔTEL v2 — carrousels, "en savoir plus", dots galerie
   Amélioration progressive · AUCUNE API de stockage navigateur.
   ============================================================ */
(function () {
  // 1) Carrousels à flèches (chambres, restaurants…)
  document.querySelectorAll('.carousel').forEach(function (car) {
    var track = car.querySelector('.carousel-track');
    if (!track) return;
    var prev = car.querySelector('.carousel-nav.prev');
    var next = car.querySelector('.carousel-nav.next');
    function step() {
      var first = track.querySelector('*');
      return first ? first.getBoundingClientRect().width + 18 : 320;
    }
    if (prev)
      prev.addEventListener('click', function () {
        track.scrollBy({ left: -step(), behavior: 'smooth' });
      });
    if (next)
      next.addEventListener('click', function () {
        track.scrollBy({ left: step(), behavior: 'smooth' });
      });
  });

  // 2) Mini-galeries (carrousel photo dans les cartes) : dots actifs
  document.querySelectorAll('.mini-gallery').forEach(function (mg) {
    var track = mg.querySelector('.mg-track');
    var dots = mg.querySelectorAll('.mg-dots span');
    if (!track || !dots.length) return;
    track.addEventListener(
      'scroll',
      function () {
        var idx = Math.round(track.scrollLeft / track.clientWidth);
        dots.forEach(function (d, i) {
          d.classList.toggle('on', i === idx);
        });
      },
      { passive: true },
    );
    // Dots cliquables : défile vers l'image correspondante
    dots.forEach(function (d, i) {
      d.setAttribute('role', 'button');
      d.setAttribute('tabindex', '0');
      d.setAttribute('aria-label', 'Photo ' + (i + 1));
      function go() {
        track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      }
      d.addEventListener('click', go);
      d.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
    // Flèches de navigation (desktop, surtout sans swipe tactile)
    if (dots.length > 1) {
      var nav = document.createElement('div');
      nav.className = 'mg-nav';
      nav.innerHTML =
        '<button type="button" class="mg-arw mg-prev" aria-label="Photo pr\u00e9c\u00e9dente">\u2039</button><button type="button" class="mg-arw mg-next" aria-label="Photo suivante">\u203a</button>';
      mg.appendChild(nav);
      function step(dir) {
        var idx = Math.round(track.scrollLeft / track.clientWidth);
        idx = Math.max(0, Math.min(dots.length - 1, idx + dir));
        track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' });
      }
      nav.querySelector('.mg-prev').addEventListener('click', function () {
        step(-1);
      });
      nav.querySelector('.mg-next').addEventListener('click', function () {
        step(1);
      });
    }
  });

  // 3) "En savoir plus" : déplie la prose
  document.querySelectorAll('.read-more').forEach(function (rm) {
    var btn = rm.querySelector('.rm-toggle');
    if (!btn) return;
    var labelMore = btn.getAttribute('data-more') || 'En savoir plus';
    var labelLess = btn.getAttribute('data-less') || 'Réduire';
    btn.addEventListener('click', function () {
      var open = rm.classList.toggle('open');
      var span = btn.querySelector('span');
      if (span) span.textContent = open ? labelLess : labelMore;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
})();

/* ============================================================
   REFONTE v2 — Toggle "voir plus" / "voir toutes les expériences"
   Principe : data-toggle-more sur un bouton → retire .is-collapsed
   du conteneur id correspondant et masque le bouton.
   AUCUN storage. Guards sur chaque querySelector.
   ============================================================ */
(function () {
  // Bouton expériences : "Voir toutes les expériences"
  var btnExp = document.getElementById('btn-voir-exp');
  if (btnExp) {
    var expContainer = document.getElementById('exp-list-container');
    if (expContainer) {
      expContainer.classList.add('is-collapsed');
      btnExp.addEventListener('click', function () {
        expContainer.classList.remove('is-collapsed');
        btnExp.style.display = 'none';
      });
    }
  }

  // Boutons "Voir plus" des sous-sections "autour"
  document.querySelectorAll('.around-list[data-around-list]').forEach(function (list) {
    list.classList.add('is-collapsed');
  });
  document.querySelectorAll('.around-toggle-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // trouver la liste dans le même .around-sub
      var sub = btn.closest('.around-sub');
      if (!sub) return;
      var list = sub.querySelector('.around-list[data-around-list]');
      if (!list) return;
      list.classList.remove('is-collapsed');
      btn.style.display = 'none';
    });
  });
})();
