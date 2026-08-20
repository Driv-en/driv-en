/* nav.js — shared mobile slide-in nav for all pages */
function initDrivenNav() {
    var hamburger = document.getElementById('drivenHamburger');
    var mobileNav = document.getElementById('drivenMobileNav');
    var overlay = document.getElementById('drivenNavOverlay');
    var closeBtn = document.getElementById('drivenNavClose');

    if (!hamburger || !mobileNav) {
        // Header not loaded yet — retry in 100ms
        setTimeout(initDrivenNav, 100);
        return;
    }

    function openNav() {
        mobileNav.classList.add('active');
        if (overlay) overlay.classList.add('active');
        hamburger.setAttribute('aria-expanded', 'true');
        mobileNav.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeNav() {
        mobileNav.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', openNav);
    if (closeBtn) closeBtn.addEventListener('click', closeNav);
    if (overlay) overlay.addEventListener('click', closeNav);

    mobileNav.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeNav);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
            closeNav();
        }
    });
}

initDrivenNav();
