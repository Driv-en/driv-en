// name=scripts/header.js
document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.getElementById('drivenHamburger') || document.querySelector('.driven-hamburger');
  const mobileNav = document.getElementById('drivenMobileNav') || document.querySelector('.driven-mobile-nav');

  if (!hamburger || !mobileNav) return;

  // Ensure IDs and aria states are present
  if (!mobileNav.id) mobileNav.id = 'drivenMobileNav';
  hamburger.setAttribute('aria-expanded', hamburger.getAttribute('aria-expanded') === 'true' ? 'true' : 'false');
  mobileNav.setAttribute('aria-hidden', mobileNav.classList.contains('active') ? 'false' : 'true');

  function openNav() {
    mobileNav.classList.add('active');
    hamburger.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    mobileNav.setAttribute('aria-hidden', 'false');
  }
  function closeNav() {
    mobileNav.classList.remove('active');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    mobileNav.setAttribute('aria-hidden', 'true');
  }
  function toggleNav() {
    hamburger.getAttribute('aria-expanded') === 'true' ? closeNav() : openNav();
  }

  hamburger.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleNav();
  });

  // keyboard: Enter / Space toggles
  hamburger.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleNav();
    }
  });

  // Close mobile nav when a link is clicked
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && hamburger.getAttribute('aria-expanded') === 'true') {
      closeNav();
      hamburger.focus();
    }
  });

  // Close when clicking outside
  document.addEventListener('click', function (e) {
    if (hamburger.getAttribute('aria-expanded') === 'true') {
      const inside = mobileNav.contains(e.target) || hamburger.contains(e.target);
      if (!inside) closeNav();
    }
  });
});
