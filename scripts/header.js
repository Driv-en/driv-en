document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.querySelector('.driven-hamburger');
  const mobileNav = document.querySelector('.driven-mobile-nav');

  if (!hamburger || !mobileNav) return;

  // Accessibility attributes
  hamburger.setAttribute('role', 'button');
  hamburger.setAttribute('tabindex', '0');
  hamburger.setAttribute('aria-expanded', 'false');
  if (!mobileNav.id) mobileNav.id = 'mobile-nav';

  function toggleNav() {
    const isOpen = mobileNav.classList.toggle('active');
    hamburger.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  }

  hamburger.addEventListener('click', toggleNav);
  hamburger.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleNav();
    }
  });
});
