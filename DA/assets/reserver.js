/* ============================================================
   MyConciergeHotel — Tunnel de réservation (logique JS)
   4 étapes · calcul dynamique · validation · persistance (mémoire de session)
   ============================================================ */
(function () {
  'use strict';

  var STORE_KEY = 'mch_resa';
  /* Persistance en mémoire uniquement (aucune API de stockage navigateur : indisponible en aperçu) */
  var memStore = {};
  var state = {
    step: 1,
    roomValue: 'deluxe',
    roomName: 'Chambre Deluxe',
    roomPrice: 1290,
    arrivee: '',
    depart: '',
    nights: 0,
    guests: 2,
  };

  /* ---------- Helpers ---------- */
  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $all(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }
  function fmt(n) {
    return n.toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0') + '\u00a0€';
  }

  function save() {
    try {
      memStore[STORE_KEY] = JSON.stringify(state);
    } catch (e) {}
  }
  function load() {
    try {
      var raw = memStore[STORE_KEY];
      if (raw) {
        var s = JSON.parse(raw);
        // ne pas restaurer l'étape de confirmation
        if (s.step === 4) s.step = 1;
        Object.assign(state, s);
      }
    } catch (e) {}
  }

  /* ---------- Dates / nuits ---------- */
  function computeNights() {
    if (!state.arrivee || !state.depart) {
      state.nights = 0;
      return;
    }
    var a = new Date(state.arrivee),
      d = new Date(state.depart);
    var diff = Math.round((d - a) / 86400000);
    state.nights = diff > 0 ? diff : 0;
  }

  function datesLabel() {
    if (!state.arrivee || !state.depart || state.nights <= 0) return 'À définir';
    var opt = { day: 'numeric', month: 'short' };
    var a = new Date(state.arrivee).toLocaleDateString('fr-FR', opt);
    var d = new Date(state.depart).toLocaleDateString('fr-FR', opt);
    return a + ' → ' + d + ' · ' + state.nights + (state.nights > 1 ? ' nuits' : ' nuit');
  }

  /* ---------- Récap (synchro UI) ---------- */
  function updateSummary() {
    var nights = state.nights > 0 ? state.nights : 1;
    var total = state.roomPrice * nights;

    var elRoom = $('#sum-room');
    if (elRoom) elRoom.textContent = state.roomName;
    var elDates = $('#sum-dates');
    if (elDates) elDates.textContent = datesLabel();
    var elGuests = $('#sum-guests');
    if (elGuests)
      elGuests.textContent = state.guests + (state.guests > 1 ? ' voyageurs' : ' voyageur');
    var elRate = $('#sum-rate');
    if (elRate) elRate.textContent = fmt(state.roomPrice);
    var elCalc = $('#sum-calc');
    if (elCalc)
      elCalc.textContent =
        state.nights > 0
          ? fmt(state.roomPrice) + ' × ' + state.nights + (state.nights > 1 ? ' nuits' : ' nuit')
          : 'Tarif / nuit';
    var elTotal = $('#sum-total');
    if (elTotal) elTotal.textContent = fmt(total);

    var hint = $('#nights-hint');
    if (hint) {
      hint.textContent =
        state.nights > 0
          ? state.nights +
            (state.nights > 1 ? ' nuits' : ' nuit') +
            ' · ' +
            fmt(total) +
            ' au total'
          : 'Sélectionnez vos dates pour calculer le nombre de nuits.';
    }
  }

  /* ---------- Stepper + panels ---------- */
  function goToStep(n) {
    state.step = n;
    save();

    $all('.resa-panel').forEach(function (p) {
      var on = +p.getAttribute('data-panel') === n;
      p.hidden = !on;
      p.classList.toggle('is-active', on);
    });

    $all('.step').forEach(function (s) {
      var sn = +s.getAttribute('data-step');
      s.classList.toggle('is-active', sn === n);
      s.classList.toggle('is-done', sn < n);
    });

    // remonter en haut du panneau
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Validation ---------- */
  function validateForm(formId) {
    var form = document.getElementById(formId);
    if (!form) return true;
    var ok = true;
    $all('input, textarea, select', form).forEach(function (el) {
      el.classList.remove('invalid');
      if (el.type === 'checkbox') {
        if (el.required && !el.checked) ok = false;
        return;
      }
      // ignorer les champs carte masqués (paiement à l'hôtel)
      var wrap = el.closest('[data-pay-card]');
      if (wrap && wrap.style.display === 'none') return;

      if (el.required && !el.value.trim()) {
        el.classList.add('invalid');
        ok = false;
      } else if (el.type === 'email' && el.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value)) {
        el.classList.add('invalid');
        ok = false;
      }
    });
    if (!ok) {
      var firstInvalid = $('.invalid', form);
      if (firstInvalid) firstInvalid.focus();
    }
    return ok;
  }

  /* ---------- Référence de réservation ---------- */
  function genCode() {
    var s = '';
    for (var i = 0; i < 6; i++)
      s += '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 34));
    return 'MCH-' + s;
  }

  function fillConfirmation() {
    var code = genCode();
    var elCode = $('#confirm-code');
    if (elCode) elCode.textContent = code;

    var nights = state.nights > 0 ? state.nights : 1;
    var total = state.roomPrice * nights;
    var recap = $('#confirm-recap');
    if (recap) {
      recap.innerHTML =
        line('Hôtel', 'Le Meurice · Paris 1ᵉʳ') +
        line('Chambre', state.roomName) +
        line('Dates', datesLabel()) +
        line('Voyageurs', state.guests + (state.guests > 1 ? ' voyageurs' : ' voyageur')) +
        '<div class="sum-line"><span>Total</span><strong>' +
        fmt(total) +
        '</strong></div>';
    }
  }
  function line(k, v) {
    return '<div class="sum-line"><span>' + k + '</span><span>' + v + '</span></div>';
  }

  /* ---------- Init ---------- */
  function init() {
    load();
    computeNights();

    // restaurer les valeurs de formulaire d'étape 1
    var arr = $('#arrivee'),
      dep = $('#depart'),
      guests = $('#voyageurs');
    if (arr && state.arrivee) arr.value = state.arrivee;
    if (dep && state.depart) dep.value = state.depart;
    if (guests) guests.value = String(state.guests);

    // dates minimales = aujourd'hui
    var today = new Date().toISOString().split('T')[0];
    if (arr) arr.min = today;
    if (dep) dep.min = today;

    // restaurer la chambre sélectionnée
    var roomInput = $('input[name="room"][value="' + state.roomValue + '"]');
    if (roomInput) {
      roomInput.checked = true;
      $all('.room-opt').forEach(function (o) {
        o.classList.remove('is-selected');
      });
      roomInput.closest('.room-opt').classList.add('is-selected');
    }

    /* --- Chambres --- */
    $all('input[name="room"]').forEach(function (input) {
      input.addEventListener('change', function () {
        $all('.room-opt').forEach(function (o) {
          o.classList.remove('is-selected');
        });
        input.closest('.room-opt').classList.add('is-selected');
        state.roomValue = input.value;
        state.roomName = input.getAttribute('data-name');
        state.roomPrice = +input.getAttribute('data-price');
        save();
        updateSummary();
      });
    });

    /* --- Dates / voyageurs --- */
    if (arr)
      arr.addEventListener('change', function () {
        state.arrivee = arr.value;
        if (dep) {
          dep.min = arr.value || today;
        }
        computeNights();
        save();
        updateSummary();
      });
    if (dep)
      dep.addEventListener('change', function () {
        state.depart = dep.value;
        computeNights();
        save();
        updateSummary();
      });
    if (guests)
      guests.addEventListener('change', function () {
        state.guests = +guests.value;
        save();
        updateSummary();
      });

    /* --- Modes de paiement --- */
    $all('input[name="pay"]').forEach(function (input) {
      input.addEventListener('change', function () {
        $all('.pay-opt').forEach(function (o) {
          o.classList.remove('is-selected');
        });
        input.closest('.pay-opt').classList.add('is-selected');
        var showCard = input.value === 'card';
        $all('[data-pay-card]').forEach(function (w) {
          w.style.display = showCard ? '' : 'none';
        });
      });
    });

    /* --- Formatage léger carte --- */
    var cardnum = $('#cardnum');
    if (cardnum)
      cardnum.addEventListener('input', function () {
        var v = cardnum.value.replace(/\D/g, '').slice(0, 16);
        cardnum.value = v.replace(/(.{4})/g, '$1 ').trim();
      });
    var cardexp = $('#cardexp');
    if (cardexp)
      cardexp.addEventListener('input', function () {
        var v = cardexp.value.replace(/\D/g, '').slice(0, 4);
        cardexp.value = v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v;
      });

    /* --- Navigation --- */
    $all('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var vForm = btn.getAttribute('data-validate');
        if (vForm && !validateForm(vForm)) return;
        if (state.step === 1 && state.nights <= 0) {
          var hint = $('#nights-hint');
          if (hint) {
            hint.textContent = "Merci de sélectionner des dates valides (départ après l'arrivée).";
            hint.style.color = '#b15545';
          }
          return;
        }
        goToStep(state.step + 1);
      });
    });
    $all('[data-prev]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        goToStep(state.step - 1);
      });
    });
    var confirmBtn = $('[data-confirm]');
    if (confirmBtn)
      confirmBtn.addEventListener('click', function () {
        var vForm = confirmBtn.getAttribute('data-validate');
        if (vForm && !validateForm(vForm)) return;
        fillConfirmation();
        goToStep(4);
        try {
          delete memStore[STORE_KEY];
        } catch (e) {}
      });

    updateSummary();
    goToStep(state.step);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
