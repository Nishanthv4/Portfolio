/**
 * NISHANTH V — PERSONAL DEVELOPER PORTFOLIO JAVASCRIPT
 * Modular, dependency-free ES6+ script.
 * Features:
 *   - Scroll Progress Indicator
 *   - Sticky Navigation & Active Section Highlighting
 *   - Mobile Drawer Navigation with Accessible ARIA
 *   - Interactive Animated Terminal with Simulated Commands
 *   - Project Gallery Category Filtering
 *   - Certification Category Filtering
 *   - Accessible Modal Dialogs (Projects & Resume Preview)
 *   - Copy Email to Clipboard with Tooltip
 *   - Client-Side Form Validation & Prefilled Mailto Generator
 *   - Scroll-to-Top Floating Trigger
 *   - IntersectionObserver Reveal Animations
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. SCROLL PROGRESS BAR & BACK TO TOP BUTTON
  // =========================================================================
  const scrollProgress = document.getElementById('scrollProgress');
  const backToTopBtn = document.getElementById('backToTop');

  function handleWindowScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    // Update progress bar width
    if (scrollHeight > 0 && scrollProgress) {
      const progressPercent = (scrollTop / scrollHeight) * 100;
      scrollProgress.style.width = `${progressPercent}%`;
    }

    // Toggle Back to Top visibility
    if (backToTopBtn) {
      if (scrollTop > 380) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }
  }

  window.addEventListener('scroll', handleWindowScroll, { passive: true });

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // Set current year in footer
  const currentYearSpan = document.getElementById('currentYear');
  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }

  // =========================================================================
  // 2. MOBILE DRAWER NAVIGATION & KEYBOARD ACCESSIBILITY
  // =========================================================================
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('nav');
  const navBackdrop = document.getElementById('navBackdrop');

  function toggleMobileMenu(forceState) {
    if (!menuToggle || !navMenu) return;
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !navMenu.classList.contains('open');

    menuToggle.classList.toggle('open', shouldOpen);
    navMenu.classList.toggle('open', shouldOpen);
    menuToggle.setAttribute('aria-expanded', String(shouldOpen));

    if (navBackdrop) {
      navBackdrop.classList.toggle('open', shouldOpen);
    }

    document.body.style.overflow = shouldOpen && window.innerWidth <= 768 ? 'hidden' : '';
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', () => toggleMobileMenu());
  }

  if (navBackdrop) {
    navBackdrop.addEventListener('click', () => toggleMobileMenu(false));
  }

  // Close drawer when any nav link is clicked
  if (navMenu) {
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          toggleMobileMenu(false);
        }
      });
    });
  }

  // Close with Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleMobileMenu(false);
      closeAllModals();
    }
  });

  // =========================================================================
  // 3. ACTIVE SECTION HIGHLIGHTING (INTERSECTION OBSERVER)
  // =========================================================================
  const sections = document.querySelectorAll('section[id]');
  const navLinksList = document.querySelectorAll('.nav-menu .nav-link');

  if ('IntersectionObserver' in window && sections.length > 0) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const currentId = entry.target.getAttribute('id');
          navLinksList.forEach(link => {
            const href = link.getAttribute('href');
            if (href === `#${currentId}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, {
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    });

    sections.forEach(sec => navObserver.observe(sec));
  }

  // =========================================================================
  // 4. SCROLL REVEAL ANIMATIONS (INTERSECTION OBSERVER)
  // =========================================================================
  const revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && revealElements.length > 0) {
    document.documentElement.classList.add('js-ready');
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -20px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // Safety fallback: reveal all elements within 600ms so content is never hidden
    setTimeout(() => {
      revealElements.forEach(el => el.classList.add('visible'));
    }, 600);
  } else {
    // Fallback if IntersectionObserver is not supported
    revealElements.forEach(el => el.classList.add('visible'));
  }

  // =========================================================================
  // 5. ANIMATED HERO TERMINAL TYPING EFFECT
  // =========================================================================
  const typingElement = document.getElementById('typingText');
  const typingPhrases = [
    'building practical software',
    'exploring cloud computing & AWS',
    'learning Linux, Docker & Git',
    'developing StudyMate & AI tools',
    'strengthening CS fundamentals'
  ];

  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typingTimeoutId = null;

  function runTypingLoop() {
    if (!typingElement) return;

    const currentPhrase = typingPhrases[phraseIndex];

    if (!isDeleting) {
      typingElement.textContent = currentPhrase.slice(0, charIndex);
      charIndex++;

      if (charIndex > currentPhrase.length) {
        isDeleting = true;
        typingTimeoutId = setTimeout(runTypingLoop, 1600);
        return;
      }
      typingTimeoutId = setTimeout(runTypingLoop, 75);
    } else {
      typingElement.textContent = currentPhrase.slice(0, charIndex);
      charIndex--;

      if (charIndex < 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % typingPhrases.length;
        charIndex = 0;
        typingTimeoutId = setTimeout(runTypingLoop, 350);
        return;
      }
      typingTimeoutId = setTimeout(runTypingLoop, 35);
    }
  }

  if (typingElement) {
    runTypingLoop();
  }

  // =========================================================================
  // 6. INTERACTIVE TERMINAL QUICK COMMANDS
  // =========================================================================
  const termPillButtons = document.querySelectorAll('.term-pill');
  const terminalBody = document.getElementById('terminalBody');

  if (termPillButtons.length > 0 && terminalBody) {
    const originalTerminalContent = terminalBody.innerHTML;

    termPillButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        executeTerminalCommand(cmd);
      });
    });

    function executeTerminalCommand(cmd) {
      if (cmd === 'clear') {
        terminalBody.innerHTML = originalTerminalContent;
        // Re-bind typing element
        const newTypingEl = document.getElementById('typingText');
        if (newTypingEl) {
          clearTimeout(typingTimeoutId);
          charIndex = 0;
          isDeleting = false;
          runTypingLoop();
        }
        return;
      }

      let responseHTML = '';
      if (cmd === 'interests') {
        responseHTML = `
          <div class="terminal-line">
            <span class="term-user">visitor@nishanth</span><span class="term-colon">:</span><span class="term-path">~</span><span class="term-prompt">$</span>
            <span class="term-cmd">cat interests.txt</span>
          </div>
          <div class="terminal-output">
            <span class="out-val">● Cloud Infrastructure &amp; Scalability</span><br>
            <span class="out-val">● Systems Programming &amp; Clean Architecture</span><br>
            <span class="out-val">● Full-Stack Web Development &amp; Tooling</span>
          </div>
        `;
      } else if (cmd === 'stack') {
        responseHTML = `
          <div class="terminal-line">
            <span class="term-user">visitor@nishanth</span><span class="term-colon">:</span><span class="term-path">~</span><span class="term-prompt">$</span>
            <span class="term-cmd">tools --list</span>
          </div>
          <div class="terminal-output">
            <span class="out-cyan">LANGUAGES:</span> C, C++, Python, JavaScript<br>
            <span class="out-green">WEB:</span> HTML5, CSS3, DOM APIs<br>
            <span class="out-yellow">CLOUD &amp; TOOLS:</span> Linux, Docker, AWS, Git, GitHub, VS Code
          </div>
        `;
      } else if (cmd === 'contact') {
        responseHTML = `
          <div class="terminal-line">
            <span class="term-user">visitor@nishanth</span><span class="term-colon">:</span><span class="term-path">~</span><span class="term-prompt">$</span>
            <span class="term-cmd">ping contact</span>
          </div>
          <div class="terminal-output">
            <span class="out-key">Email:</span> <span class="out-val">nishanthv4@gmail.com</span><br>
            <span class="out-key">GitHub:</span> <span class="out-val">github.com/Nishanthv4</span><br>
            <span class="out-key">LinkedIn:</span> <span class="out-val">linkedin.com/in/nishanth-v-129367360</span><br>
            <span class="out-key">X / Twitter:</span> <span class="out-val">x.com/nishant61972303</span><br>
            <span class="out-key">Location:</span> <span class="out-val">Tamil Nadu, India</span><br>
            <span class="out-key">Direct Link:</span> <span class="out-accent"><a href="#contact" style="color:var(--accent-cyan); text-decoration:underline;">Jump to Contact Form &darr;</a></span>
          </div>
        `;
      }

      // Append command response right above active line
      const activeLine = terminalBody.querySelector('.active-line');
      if (activeLine) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = responseHTML;
        terminalBody.insertBefore(tempDiv, activeLine);
        terminalBody.scrollTop = terminalBody.scrollHeight;
      }
    }
  }

  // =========================================================================
  // 7. PROJECT GALLERY FILTERING
  // =========================================================================
  const filterBtns = document.querySelectorAll('.project-filter-bar .filter-btn');
  const projectCards = document.querySelectorAll('.projects-grid .project-card');

  if (filterBtns.length > 0 && projectCards.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle active button state
        filterBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        const selectedFilter = btn.getAttribute('data-filter');

        projectCards.forEach(card => {
          const cardCategories = card.getAttribute('data-category') || '';
          if (selectedFilter === 'all' || cardCategories.includes(selectedFilter)) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      });
    });
  }

  // =========================================================================
  // 8. CERTIFICATION CATEGORY FILTERING
  // =========================================================================
  const certTabBtns = document.querySelectorAll('.cert-category-tabs .cert-tab-btn');
  const certCards = document.querySelectorAll('.certs-grid .cert-card');

  if (certTabBtns.length > 0 && certCards.length > 0) {
    certTabBtns.forEach(tab => {
      tab.addEventListener('click', () => {
        certTabBtns.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const selectedCategory = tab.getAttribute('data-cert-cat');

        certCards.forEach(card => {
          const group = card.getAttribute('data-cert-group') || '';
          if (selectedCategory === 'all' || group === selectedCategory) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      });
    });
  }

  // =========================================================================
  // 9. MODALS (PROJECT DETAILS & RESUME PREVIEW)
  // =========================================================================
  const modalTriggers = document.querySelectorAll('[data-modal]');
  const resumePreviewBtn = document.getElementById('btnPreviewResume');
  const resumeModal = document.getElementById('modalResume');

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    
    // Focus close button for accessibility
    const closeBtn = modalEl.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.focus();
  }

  function closeAllModals() {
    const openModals = document.querySelectorAll('.modal-dialog:not([hidden])');
    openModals.forEach(m => m.setAttribute('hidden', ''));
    document.body.style.overflow = '';
  }

  // Bind project details modal triggers
  modalTriggers.forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-modal');
      const targetModal = document.getElementById(modalId);
      if (targetModal) openModal(targetModal);
    });
  });

  // Bind resume preview modal trigger
  if (resumePreviewBtn && resumeModal) {
    resumePreviewBtn.addEventListener('click', () => openModal(resumeModal));
  }

  // Close modals on close buttons & backdrop click
  document.querySelectorAll('[data-close-modal]').forEach(closer => {
    closer.addEventListener('click', closeAllModals);
  });

  // Close modals on Escape key press
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // =========================================================================
  // 10. COPY EMAIL ADDRESS TO CLIPBOARD
  // =========================================================================
  const btnCopyEmail = document.getElementById('btnCopyEmail');
  const copyTooltip = document.getElementById('copyTooltip');
  const emailLink = document.getElementById('emailLink');

  if (btnCopyEmail && emailLink) {
    btnCopyEmail.addEventListener('click', async () => {
      const emailToCopy = 'nishanthv4@gmail.com';
      
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(emailToCopy);
        } else {
          // Fallback for older browsers
          const tempInput = document.createElement('textarea');
          tempInput.value = emailToCopy;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
        }

        if (copyTooltip) {
          copyTooltip.textContent = 'Copied!';
          copyTooltip.classList.add('show');
          setTimeout(() => {
            copyTooltip.classList.remove('show');
            setTimeout(() => { copyTooltip.textContent = 'Copy'; }, 200);
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to copy email:', err);
      }
    });
  }

  // =========================================================================
  // 11. CONTACT FORM CLIENT-SIDE VALIDATION & PREFILLED MAILTO GENERATOR
  // =========================================================================
  const contactForm = document.getElementById('contactForm');
  const senderNameInput = document.getElementById('senderName');
  const senderEmailInput = document.getElementById('senderEmail');
  const subjectInput = document.getElementById('messageSubject');
  const messageInput = document.getElementById('messageBody');
  const formStatusBanner = document.getElementById('formStatus');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      let hasErrors = false;

      // Validate Name
      const nameVal = senderNameInput ? senderNameInput.value.trim() : '';
      const nameGroup = senderNameInput ? senderNameInput.closest('.form-group') : null;
      if (!nameVal) {
        if (nameGroup) nameGroup.classList.add('has-error');
        hasErrors = true;
      } else if (nameGroup) {
        nameGroup.classList.remove('has-error');
      }

      // Validate Email
      const emailVal = senderEmailInput ? senderEmailInput.value.trim() : '';
      const emailGroup = senderEmailInput ? senderEmailInput.closest('.form-group') : null;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailVal || !emailRegex.test(emailVal)) {
        if (emailGroup) emailGroup.classList.add('has-error');
        hasErrors = true;
      } else if (emailGroup) {
        emailGroup.classList.remove('has-error');
      }

      // Validate Subject
      const subjectVal = subjectInput ? subjectInput.value.trim() : '';
      const subjectGroup = subjectInput ? subjectInput.closest('.form-group') : null;
      if (!subjectVal) {
        if (subjectGroup) subjectGroup.classList.add('has-error');
        hasErrors = true;
      } else if (subjectGroup) {
        subjectGroup.classList.remove('has-error');
      }

      // Validate Message
      const messageVal = messageInput ? messageInput.value.trim() : '';
      const messageGroup = messageInput ? messageInput.closest('.form-group') : null;
      if (!messageVal) {
        if (messageGroup) messageGroup.classList.add('has-error');
        hasErrors = true;
      } else if (messageGroup) {
        messageGroup.classList.remove('has-error');
      }

      if (hasErrors) {
        if (formStatusBanner) {
          formStatusBanner.className = 'form-status-banner';
          formStatusBanner.style.display = 'none';
        }
        return;
      }

      // Construct Web Gmail Compose URL (opens Gmail directly in browser, avoids Outlook)
      const targetEmail = 'nishanthv4@gmail.com';
      const encodedSubject = encodeURIComponent(`[Portfolio Inquiry] ${subjectVal}`);
      const encodedBody = encodeURIComponent(
        `Hello Nishanth,\n\n${messageVal}\n\n---\nFrom: ${nameVal}\nEmail: ${emailVal}`
      );

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${targetEmail}&su=${encodedSubject}&body=${encodedBody}`;

      if (formStatusBanner) {
        formStatusBanner.className = 'form-status-banner success';
        formStatusBanner.innerHTML = `
          <strong>✓ Input Validated!</strong><br>
          Opening Gmail in your browser to dispatch your message to Nishanth V...<br>
          <a href="${gmailUrl}" target="_blank" rel="noopener noreferrer" class="link-inline" style="display:inline-block; margin-top:8px; font-weight:600;">
            Click here if Gmail did not open automatically ↗
          </a>
        `;
        formStatusBanner.style.display = 'block';
      }

      // Open Gmail directly in a new tab
      const newWin = window.open(gmailUrl, '_blank');
      if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
        // Fallback if popup blocker stops window.open
        window.location.href = gmailUrl;
      }
    });

    // Clear validation error on user input
    [senderNameInput, senderEmailInput, subjectInput, messageInput].forEach(field => {
      if (field) {
        field.addEventListener('input', () => {
          const group = field.closest('.form-group');
          if (group && group.classList.contains('has-error')) {
            group.classList.remove('has-error');
          }
        });
      }
    });
  }

  // =========================================================================
  // 12. SMOOTH KEYBOARD NAVIGATION & TERMINAL ACCESSIBILITY
  // =========================================================================
  window.addEventListener('keydown', (e) => {
    // Press 't' or 'T' to jump and focus terminal quick commands (when not typing in an input)
    if ((e.key === 't' || e.key === 'T') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      const firstPill = document.querySelector('.term-pill');
      if (firstPill) {
        firstPill.focus();
      }
    }
  });

})();
