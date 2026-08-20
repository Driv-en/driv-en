/* nav.js — shared mobile slide-in nav for all pages */
function initDrivenNav() {
    var hamburger = document.getElementById('drivenHamburger');
    var mobileNav = document.getElementById('drivenMobileNav');

    if (!hamburger || !mobileNav) {
        setTimeout(initDrivenNav, 100);
        return;
    }

    var overlay = document.getElementById('drivenNavOverlay');

    // Create overlay if it doesn't exist
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'driven-mobile-nav-overlay';
        overlay.id = 'drivenNavOverlay';
        document.body.appendChild(overlay);
    }

    // Create X close button if it doesn't exist
    var closeBtn = document.getElementById('drivenNavClose');
    if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.className = 'driven-mobile-nav-close';
        closeBtn.id = 'drivenNavClose';
        closeBtn.setAttribute('aria-label', 'Close navigation');
        closeBtn.innerHTML = '&times;';
        mobileNav.appendChild(closeBtn);
    }

    function openNav() {
        mobileNav.classList.add('active');
        overlay.classList.add('active');
        hamburger.setAttribute('aria-expanded', 'true');
        mobileNav.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeNav() {
        mobileNav.classList.remove('active');
        overlay.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', openNav);
    closeBtn.addEventListener('click', closeNav);
    overlay.addEventListener('click', closeNav);

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
