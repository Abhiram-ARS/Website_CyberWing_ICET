/**
 * CYBERWING - Premium Interactive Script
 * Features: SVG scroll translation, count-up animation, scroll reveal,
 * active link highlighting, glassmorphic modal, floating labels.
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================================================
  // 1. HERO ANIMATIONS ON LOAD
  // ==========================================================================
  const heroTitle = document.querySelector('.hero-title');
  const heroSubtitle = document.querySelector('.hero-subtitle');
  const heroText = document.querySelector('.hero-text');
  
  if (heroTitle) heroTitle.classList.add('animated');
  if (heroSubtitle) heroSubtitle.classList.add('animated');
  if (heroText) heroText.classList.add('animated');

  // ==========================================================================
  // 2. CRYPTO NETWORK BACKGROUND SCROLL EFFECT
  // ==========================================================================
  const svg1 = document.getElementById('network-svg-1');
  const svg2 = document.getElementById('network-svg-2');
  let isScrollThrottled = false;

  const updateSvgScroll = () => {
    const scrollY = window.scrollY;
    // Map scrollY to translate values
    // Scroll range [0, 3000] maps y1 to [0, -800], y2 to [0, 400]
    const y1 = scrollY * -0.2667;
    const y2 = scrollY * 0.1333;
    
    if (svg1) svg1.style.transform = `translate3d(0, ${y1}px, 0)`;
    if (svg2) svg2.style.transform = `translate3d(0, ${y2}px, 0)`;
    
    isScrollThrottled = false;
  };

  window.addEventListener('scroll', () => {
    if (!isScrollThrottled) {
      window.requestAnimationFrame(updateSvgScroll);
      isScrollThrottled = true;
    }
  });

  // ==========================================================================
  // 3. NAVBAR GLASSMORPHISM SCROLL STATE
  // ==========================================================================
  const navbar = document.getElementById('main-nav');
  
  const updateNavbarState = () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', updateNavbarState);
  updateNavbarState(); // Initial run

  // ==========================================================================
  // 4. MOBILE DRAWER NAVIGATION
  // ==========================================================================
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileNavMenu = document.getElementById('mobile-nav-menu');

  if (mobileToggle && mobileNavMenu) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileNavMenu.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', isOpen);
    });

    // Close menu when a link is clicked
    document.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileNavMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (mobileNavMenu.classList.contains('open') && !mobileNavMenu.contains(e.target) && e.target !== mobileToggle) {
        mobileNavMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ==========================================================================
  // 5. ACTIVE LINK HIGH LIGHTER
  // ==========================================================================
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id], header[id]');

  const highlightNavLinks = () => {
    let currentSectionId = '';
    const scrollPosition = window.scrollY + window.innerHeight / 2;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPosition >= top && scrollPosition <= top + height) {
        currentSectionId = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentSectionId}`) {
        link.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', highlightNavLinks);
  highlightNavLinks(); // Initial run

  // ==========================================================================
  // 6. SCROLL REVEAL (FADE-UP TRANSITIONS)
  // ==========================================================================
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      } else {
        // Remove class when scrolled out of view, matching React behavior
        entry.target.classList.remove('revealed');
      }
    });
  }, {
    threshold: 0.12
  });

  document.querySelectorAll('.scroll-reveal').forEach(el => {
    revealObserver.observe(el);
  });

  // ==========================================================================
  // 7. STATS NUMBERS COUNT-UP ANIMATION
  // ==========================================================================
  const duration = 2000;

  const countUp = (element, targetValue, prefix, suffix) => {
    const valueEl = element.querySelector('.metric-value');
    if (!valueEl) return;

    const end = parseFloat(targetValue);
    const isFloat = targetValue.includes('.');
    const startTime = performance.now();

    const updateCounter = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Ease out quadratic: f(t) = t(2-t)
      const easeOut = progress * (2 - progress);
      const currentVal = end * easeOut;

      valueEl.textContent = prefix + (isFloat ? currentVal.toFixed(1) : Math.floor(currentVal)) + suffix;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        valueEl.textContent = prefix + targetValue + suffix;
      }
    };

    requestAnimationFrame(updateCounter);
  };

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        const target = card.getAttribute('data-target');
        const suffix = card.getAttribute('data-suffix') || '';
        const prefix = card.getAttribute('data-prefix') || '';
        
        countUp(card, target, prefix, suffix);
        // Only run count-up once
        counterObserver.unobserve(card);
      }
    });
  }, {
    threshold: 0.15
  });

  document.querySelectorAll('.metric-card').forEach(card => {
    counterObserver.observe(card);
  });

  // ==========================================================================
  // 8. BENTO CARDS & DETAILS MODAL
  // ==========================================================================
  const modal = document.getElementById('awareness-modal');
  const modalTitle = document.getElementById('modal-title-el');
  const modalDesc = document.getElementById('modal-desc-el');
  const modalTakeaways = document.getElementById('modal-takeaways-el');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  if (modal && modalCloseBtn) {
    // Open modal on Bento Card click
    document.querySelectorAll('.bento-card').forEach(card => {
      card.addEventListener('click', () => {
        const title = card.querySelector('.bento-title').textContent;
        const desc = card.querySelector('.bento-desc').textContent;
        const takeaways = card.querySelectorAll('.takeaways-list li');
        
        modalTitle.textContent = title;
        modalDesc.textContent = desc;
        
        // Clear and rebuild dynamic takeaways list items
        modalTakeaways.innerHTML = '';
        takeaways.forEach(li => {
          const item = document.createElement('li');
          item.textContent = li.textContent;
          modalTakeaways.appendChild(item);
        });

        // Show Modal with animations
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
      });
    });

    // Close Modal helper
    const closeModal = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = ''; // Restore background scrolling
    };

    modalCloseBtn.addEventListener('click', closeModal);
    
    // Close when clicking modal backdrop
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
      }
    });
  }

});