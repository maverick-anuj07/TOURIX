/**
 * TOURIX — Main Application Shell
 * Handles screen routing, navigation, and app lifecycle
 */
import L from 'leaflet';
import { t, getLang, setLang, translatePage } from './i18n/i18n.js';
import { CONFIG } from './config.js';
import { NASHIK_PLACES, getCategories, getHighlights, filterByCategory, searchPlaces, getPlaceById, getNearbyPlaces, getCategoryIcon, getCategoryColor, haversine } from './data/nashik-places.js';
import { SimulatedLocationProvider, CITIES_CONFIG, DEMO_MEMBERS_MASTER, resolveMemberProfile, saveRegisteredUserRecord, getRegisteredUsersDb } from './location-provider.js';
import { PlaceImageProvider } from './image-provider.js';

if (typeof window !== 'undefined') { window.L = L; }

const locationProvider = new SimulatedLocationProvider('Nashik');

// ==========================================
// STATE
// ==========================================
const state = {
  currentScreen: 'language-select',
  previousScreen: null,
  authToken: localStorage.getItem('tourix_auth_token') || null,
  user: {
    name: '',
    phone: '',
    email: '',
    role: 'tourist',
    interests: [],
    pace: 'balanced',
    verified: false,
    touristId: null,
    emergencyContact: '',
    identityVerified: false,
  },
  onboardingStep: 1,
  exploreCategory: 'All',
  exploreSearch: '',
  exploreView: 'list', // 'list' or 'map'
  selectedPlaceId: null,
  groupSeparated: false,
  groupWs: null,
  wsConnected: false,
  riskAlertVisible: false,
  sosActive: false,
  sosTimer: null,
  sosSec: 3,
  savedPlaces: [],
  selectedTravelMode: 'car',
  selectedDestination: null,
  activeRoute: null,
  _routeCache: {},
  activeGroup: {
    name: 'Tourix Demo Group',
    code: 'TOURIX6',
    members: ['ANUJ001', 'ADITI002', 'OMKAR003', 'HASTI004', 'PALAK005', 'MAVERICK006'],
  },
  selectedCity: 'Nashik',
  selectedMemberId: null,
  formGroupModalOpen: false,
  memberProfileModalUser: null,
  bookTablePlace: null,
  currentItinerary: null,
  itineraryLoading: false,
  sortNearMe: false,
  userCoords: null,
  geoWatchId: null,
  userAccuracy: null,
  chatHistory: [],
  itineraryParams: {
    hours: 6,
    preference: 'Heritage',
    pace: 'balanced',
  },
  maps: {},
};

function persistTouristSession() {
  const payload = {
    token: state.authToken,
    user: state.user,
  };
  localStorage.setItem('tourix_session', JSON.stringify(payload));
  if (state.authToken) {
    localStorage.setItem('tourix_auth_token', state.authToken);
  }
}

function hydrateTouristSession() {
  try {
    const saved = localStorage.getItem('tourix_session');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (parsed?.user) {
      state.user = { ...state.user, ...parsed.user };
    }
    if (parsed?.token) {
      state.authToken = parsed.token;
    }
  } catch (err) {
    console.warn('Session hydration failed:', err);
  }
}

hydrateTouristSession();

// ==========================================
// INITIALIZATION
// ==========================================
export function initApp() {
  renderApp();

  // Check if user already selected language
  const savedLang = localStorage.getItem('tourix_lang');
  if (savedLang) {
    setLang(savedLang);
  }

  // Offline support & network status listeners
  window.addEventListener('online', () => showOfflineBanner(false));
  window.addEventListener('offline', () => showOfflineBanner(true));
  if (!navigator.onLine) {
    setTimeout(() => showOfflineBanner(true), 1000);
  }

  // Show language selection first
  showScreen('language-select');
}

function showOfflineBanner(isOffline) {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#dc2626;color:#fff;text-align:center;padding:8px;font-size:12px;font-weight:600;display:none;';
    document.body.appendChild(banner);
  }
  if (isOffline) {
    banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> You are offline. TOURIX is running in offline mode with cached data.';
    banner.style.display = 'block';
  } else {
    banner.innerHTML = '<i class="fa-solid fa-circle-check"></i> Back online!';
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 3000);
  }
}

// ==========================================
// RENDER MAIN APP SHELL
// ==========================================
function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="mobile-frame" id="mobile-frame">
      <!-- App Header -->
      <header class="app-header" id="app-header" style="display:none;">
        <div class="app-header__logo">
          <span class="app-header__brand">TOURIX</span>
          <span class="app-header__location">
            <i class="fa-solid fa-location-dot"></i>
            <span data-i18n="app.location">${t('app.location')}</span>
          </span>
        </div>
        <div class="app-header__actions">
          <button class="demo-btn" onclick="window.tourix.runDemo()">
            <i class="fa-solid fa-play"></i>
            <span data-i18n="demo.demoMode">${t('demo.demoMode')}</span>
          </button>
          <select class="lang-selector" id="header-lang-select" onchange="window.tourix.changeLang(this.value)">
            <option value="en" ${getLang() === 'en' ? 'selected' : ''}>EN</option>
            <option value="hi" ${getLang() === 'hi' ? 'selected' : ''}>हिंदी</option>
            <option value="mr" ${getLang() === 'mr' ? 'selected' : ''}>मराठी</option>
          </select>
        </div>
      </header>

      <!-- Screen Container -->
      <div id="screen-container">
        ${renderLanguageSelect()}
        ${renderAuthScreen()}
        ${renderOnboardingScreen()}
        ${renderHomeScreen()}
        ${renderExploreScreen()}
        ${renderPlaceDetailScreen()}
        ${renderGroupScreen()}
        ${renderTripScreen()}
        ${renderSOSScreen()}
        ${renderProfileScreen()}
      </div>

      <!-- AI Chat Modal -->
      ${renderAIChatModal()}

      <!-- Modals -->
      ${renderFormGroupModal()}
      ${renderMemberProfileModal()}
      ${renderBookTableModal()}

      <!-- Bottom Navigation -->
      ${renderBottomNav()}
    </div>
  `;

  // Expose methods to window for onclick handlers
  window.tourix = {
    showScreen,
    startOnboarding,
    nextStep,
    sendOtp,
    verifyOtp,
    finalizeRegistration,
    toggleInterest,
    switchCategory,
    searchExplore,
    toggleExploreView,
    openPlaceDetail,
    closePlaceDetail,
    toggleGroupSeparation,
    toggleRiskAlert,
    rerouteSafe,
    startSOSHold,
    cancelSOSHold,
    deactivateSOS,
    openAI,
    closeAI,
    sendChat,
    clearChat,
    changeLang: changeLanguage,
    runDemo,
    selectLanguage,
    confirmLanguage,
    savePlace,
    setItineraryOption,
    generateCustomItinerary,
    sortByNearMe,
    locateUserNow,
    navigateGroupDestination,
    navigatePlace,
    setTravelMode,
    centerMyLocation,
    fitRouteBounds,
    selectAlternativeRoute,
    openFormGroupModal,
    closeFormGroupModal,
    addMemberToFormGroup,
    removeMemberFromFormGroup,
    seedAllDemoMembers,
    confirmCreateGroup,
    openMemberProfile,
    closeMemberProfile,
    selectGroupMember,
    focusMemberOnMap,
    fitGroupBounds,
    changeCity,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    openBookTableModal,
    closeBookTableModal,
    confirmBookTable,
  };
}

// ==========================================
// SCREEN MANAGEMENT
// ==========================================
function showScreen(screenId) {
  state.previousScreen = state.currentScreen;
  state.currentScreen = screenId;

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Show target screen
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add('active');

  // Header visibility
  const header = document.getElementById('app-header');
  const showHeader = !['language-select', 'auth', 'onboarding'].includes(screenId);
  if (header) header.style.display = showHeader ? 'flex' : 'none';

  // Bottom nav visibility
  const nav = document.getElementById('bottom-nav');
  const showNav = ['home', 'explore', 'group', 'sos', 'trip', 'profile'].includes(screenId);
  if (nav) nav.classList.toggle('visible', showNav);

  // Update active nav item
  if (showNav) {
    document.querySelectorAll('.bottom-nav__item').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${screenId}`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  // Refresh dynamic content
  if (screenId === 'home') refreshHome();
  if (screenId === 'explore') refreshExplore();
  if (screenId === 'trip') initRouteMap();
  if (screenId === 'group') {
    initGroupMap();
    connectGroupWebSocket();
  }

  // Invalidate maps
  setTimeout(() => {
    Object.values(state.maps).forEach(m => { if (m && m.invalidateSize) m.invalidateSize(); });
  }, 250);
}

// ==========================================
// LANGUAGE SELECTION SCREEN
// ==========================================
let selectedLang = getLang();

function renderLanguageSelect() {
  return `
    <div id="screen-language-select" class="screen screen--full">
      <div class="lang-screen">
        <div class="lang-screen__icon">
          <i class="fa-solid fa-globe"></i>
        </div>
        <h1 class="lang-screen__title">TOURIX</h1>
        <p class="lang-screen__sub">Choose Your Language / भाषा चुनें / भाषा निवडा</p>

        <div class="lang-options" id="lang-options">
          <button class="lang-option ${selectedLang === 'en' ? 'selected' : ''}" onclick="window.tourix.selectLanguage('en', this)">
            <div>
              <div class="lang-option__text">English</div>
              <div class="lang-option__native">English</div>
            </div>
            <div class="lang-option__check"><i class="fa-solid fa-check"></i></div>
          </button>
          <button class="lang-option ${selectedLang === 'hi' ? 'selected' : ''}" onclick="window.tourix.selectLanguage('hi', this)">
            <div>
              <div class="lang-option__text">हिन्दी</div>
              <div class="lang-option__native">Hindi</div>
            </div>
            <div class="lang-option__check"><i class="fa-solid fa-check"></i></div>
          </button>
          <button class="lang-option ${selectedLang === 'mr' ? 'selected' : ''}" onclick="window.tourix.selectLanguage('mr', this)">
            <div>
              <div class="lang-option__text">मराठी</div>
              <div class="lang-option__native">Marathi</div>
            </div>
            <div class="lang-option__check"><i class="fa-solid fa-check"></i></div>
          </button>
        </div>

        <button class="btn btn--primary btn--full btn--lg mt-4" onclick="window.tourix.confirmLanguage()" style="margin-top:24px;">
          <span data-i18n="lang.continue">Continue</span>
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    </div>
  `;
}

function selectLanguage(lang, btn) {
  selectedLang = lang;
  document.querySelectorAll('.lang-option').forEach(el => el.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
}

function confirmLanguage() {
  setLang(selectedLang);
  renderApp();
  showScreen('auth');
}

function changeLanguage(lang) {
  setLang(lang);
  renderApp();
  showScreen(state.currentScreen);
}

// ==========================================
// AUTH SCREEN
// ==========================================
function renderAuthScreen() {
  return `
    <div id="screen-auth" class="screen screen--full">
      <div class="lang-screen">
        <div class="lang-screen__icon">
          <i class="fa-solid fa-compass"></i>
        </div>
        <h1 class="lang-screen__title">TOURIX</h1>
        <p class="lang-screen__sub" data-i18n="app.tagline">${t('app.tagline')}</p>

        <div class="lang-options" style="margin-top:32px;">
          <h3 style="font-size:var(--text-md);font-weight:700;color:var(--color-text-primary);text-align:center;margin-bottom:4px;" data-i18n="auth.selectRole">${t('auth.selectRole')}</h3>

          <button class="btn btn--primary btn--full btn--lg" onclick="window.tourix.startOnboarding()">
            <i class="fa-solid fa-user-shield"></i>
            <span data-i18n="auth.tourist">${t('auth.tourist')}</span>
          </button>
          <button class="btn btn--secondary btn--full" onclick="alert('${t('auth.guideSoon')}')">
            <i class="fa-solid fa-map-location-dot"></i>
            <span data-i18n="auth.guide">${t('auth.guide')}</span>
          </button>
          <button class="btn btn--secondary btn--full" onclick="alert('${t('auth.operatorSoon')}')">
            <i class="fa-solid fa-briefcase"></i>
            <span data-i18n="auth.tourOperator">${t('auth.tourOperator')}</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function startOnboarding() {
  state.onboardingStep = 1;
  showScreen('onboarding');
  renderOnboardingStep();
}

// ==========================================
// ONBOARDING WIZARD
// ==========================================
function renderOnboardingScreen() {
  return `
    <div id="screen-onboarding" class="screen" style="gap:0;">
      <div class="onboarding-progress">
        <div class="onboarding-progress__top">
          <span id="ob-step-title">${t('onboarding.step', { num: '1', title: t('onboarding.step1Title') })}</span>
          <span id="ob-step-count">${t('onboarding.stepCount', { current: '1', total: '5' })}</span>
        </div>
        <div class="onboarding-progress__bar">
          <div class="onboarding-progress__fill" id="ob-progress" style="width:20%;"></div>
        </div>
      </div>
      <div id="ob-content" style="padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-4);flex:1;overflow-y:auto;">
        <!-- Dynamic step content -->
      </div>
    </div>
  `;
}

function renderOnboardingStep() {
  const step = state.onboardingStep;
  const titles = [t('onboarding.step1Title'), t('onboarding.step2Title'), t('onboarding.step3Title'), t('onboarding.step4Title'), t('onboarding.step5Title')];

  // Update progress
  const titleEl = document.getElementById('ob-step-title');
  const countEl = document.getElementById('ob-step-count');
  const progressEl = document.getElementById('ob-progress');
  if (titleEl) titleEl.textContent = t('onboarding.step', { num: step, title: titles[step - 1] });
  if (countEl) countEl.textContent = t('onboarding.stepCount', { current: step, total: '5' });
  if (progressEl) progressEl.style.width = `${(step / 5) * 100}%`;

  const content = document.getElementById('ob-content');
  if (!content) return;

  const steps = {
    1: `
      <h2 style="font-size:var(--text-xl);font-weight:800;">${t('onboarding.verifyContact')}</h2>
      <p style="font-size:var(--text-base);color:var(--color-text-tertiary);">${t('onboarding.contactDesc')}</p>
      <input type="tel" id="ob-phone" class="form-input" placeholder="${t('onboarding.phonePlaceholder')}" />
      <input type="email" id="ob-email" class="form-input" placeholder="Email (optional)" />
      <button class="btn btn--secondary btn--full" id="btn-send-otp" onclick="window.tourix.sendOtp()">
        ${t('onboarding.sendOtp')}
      </button>
      <div id="otp-container" class="hidden" style="display:flex;flex-direction:column;gap:var(--space-3);">
        <div id="ob-dev-otp-banner" style="display:none;background:#f0fdf4;border:1px solid #16a34a;color:#15803d;padding:12px;border-radius:8px;font-weight:700;text-align:center;font-size:16px;"></div>
        <input type="number" id="ob-otp" class="form-input" placeholder="${t('onboarding.otpPlaceholder')}" style="text-align:center;letter-spacing:0.3em;" />
        <button class="btn btn--primary btn--full" id="btn-verify-otp" onclick="window.tourix.verifyOtp()">
          ${t('onboarding.verifyOtp')}
        </button>
      </div>
    `,
    2: `
      <h2 style="font-size:var(--text-xl);font-weight:800;">${t('onboarding.personalDetails')}</h2>
      <input type="text" id="ob-name" class="form-input" placeholder="${t('onboarding.namePlaceholder')}" />
      <div style="display:flex;gap:var(--space-2);">
        <input type="date" class="form-input" style="flex:1;" />
        <select class="form-input form-select" style="flex:1;">
          <option>${t('onboarding.nationality')}</option>
          <option>${t('onboarding.foreignNational')}</option>
        </select>
      </div>
      <button class="btn btn--primary btn--full" onclick="window.tourix.nextStep(3)" style="margin-top:auto;">
        ${t('onboarding.continue')}
      </button>
    `,
    3: `
      <h2 style="font-size:var(--text-xl);font-weight:800;">${t('onboarding.digitalIdentity')}</h2>
      <div class="card card--safety" style="border-color:#a7f3d0;">
        <p style="font-size:var(--text-xs);color:var(--color-safe-dark);">${t('onboarding.privacyNotice')}</p>
      </div>
      <button class="btn btn--primary btn--full" onclick="window.tourix.nextStep(4)" style="margin-top:auto;">
        ${t('onboarding.continue')}
      </button>
    `,
    4: `
      <h2 style="font-size:var(--text-xl);font-weight:800;">${t('onboarding.safetyProfile')}</h2>
      <p style="font-size:var(--text-base);color:var(--color-text-tertiary);">${t('onboarding.sosContact')}</p>
      <input type="text" class="form-input" placeholder="${t('onboarding.contactNamePlaceholder')}" />
      <input type="tel" id="ob-emergency" class="form-input" placeholder="${t('onboarding.emergencyNoPlaceholder')}" />
      <p style="font-size:var(--text-base);color:var(--color-text-tertiary);margin-top:var(--space-2);">${t('onboarding.liveness')}</p>
      <button class="btn btn--secondary btn--full" onclick="alert('${t('onboarding.selfieVerified')}')">
        <i class="fa-solid fa-camera" style="font-size:18px;"></i>
        ${t('onboarding.takeSelfie')}
      </button>
      <button class="btn btn--primary btn--full" onclick="window.tourix.nextStep(5)" style="margin-top:auto;">
        ${t('onboarding.continue')}
      </button>
    `,
    5: `
      <h2 style="font-size:var(--text-xl);font-weight:800;">${t('onboarding.aiPersonalization')}</h2>
      <p style="font-size:var(--text-base);color:var(--color-text-tertiary);">${t('onboarding.selectInterests')}</p>
      <div class="interest-tags" id="interest-tags">
        ${['heritage', 'spiritual', 'food', 'nature', 'photography', 'adventure', 'culture', 'vineyards', 'shopping', 'trekking', 'relaxation', 'family']
          .map(key => `<button class="interest-tag" data-interest="${key}" onclick="window.tourix.toggleInterest(this)">${t('interests.' + key)}</button>`)
          .join('')}
      </div>
      <p style="font-size:var(--text-base);color:var(--color-text-tertiary);margin-top:var(--space-2);">${t('onboarding.travelPace')}</p>
      <select class="form-input form-select" id="ob-pace">
        <option value="balanced">${t('onboarding.paceBalanced')}</option>
        <option value="relaxed">${t('onboarding.paceRelaxed')}</option>
        <option value="adventure">${t('onboarding.paceAdventure')}</option>
      </select>
      <button class="btn btn--success btn--full btn--lg" onclick="window.tourix.finalizeRegistration()" style="margin-top:auto;">
        <i class="fa-solid fa-id-card"></i>
        ${t('onboarding.generateId')}
      </button>
    `,
  };

  content.innerHTML = steps[step] || '';
}

function nextStep(step) {
  // Save data from current step
  const phoneInput = document.getElementById('ob-phone');
  if (phoneInput && phoneInput.value.trim()) {
    state.user.phone = phoneInput.value.trim();
  }
  const emailInput = document.getElementById('ob-email');
  if (emailInput && emailInput.value.trim()) {
    state.user.email = emailInput.value.trim();
  }
  const nameInput = document.getElementById('ob-name');
  if (nameInput && nameInput.value.trim()) {
    state.user.name = nameInput.value.trim();
  }
  state.onboardingStep = step;
  renderOnboardingStep();
}

async function sendOtp() {
  const phone = document.getElementById('ob-phone')?.value?.trim();
  const email = document.getElementById('ob-email')?.value?.trim() || '';
  const contact = phone || email;

  if (!contact) {
    alert(t('onboarding.phonePlaceholder') || 'Please enter phone or email');
    return;
  }

  state.user.phone = phone || '';
  state.user.email = email;

  const btn = document.getElementById('btn-send-otp');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${t('onboarding.sending')}`;
  }

  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, email }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Could not reach Tourix server');

    const otpVal = data.debug_otp;
    if (!/^\d{6}$/.test(otpVal || '')) {
      throw new Error('Prototype OTP is unavailable. Ensure SMS_PROVIDER=free and DEBUG=true in backend environment.');
    }

    const otpContainer = document.getElementById('otp-container');
    if (otpContainer) {
      otpContainer.classList.remove('hidden');
      otpContainer.style.display = 'flex';
    }

    const banner = document.getElementById('ob-dev-otp-banner');
    if (banner) {
      banner.innerHTML = `🔑 Prototype OTP: <strong>${otpVal}</strong>`;
      banner.style.display = 'block';
    }

    const otpInput = document.getElementById('ob-otp');
    if (otpInput) {
      otpInput.value = otpVal;
      otpInput.focus();
    }

    alert(`🔑 Your TOURIX Verification OTP is: ${otpVal}\n(It has been automatically filled in for you!)`);
  } catch (error) {
    alert(error.message || 'Could not reach Tourix server');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = t('onboarding.sendOtp');
    }
  }
}

async function verifyOtp() {
  const phone = document.getElementById('ob-phone')?.value?.trim();
  const email = document.getElementById('ob-email')?.value?.trim() || '';
  const otp = document.getElementById('ob-otp')?.value?.trim();
  const contact = phone || email;

  if (!contact || !otp) {
    alert('Please enter the OTP sent to your phone or email');
    return;
  }

  const btn = document.getElementById('btn-verify-otp');
  if (btn) btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${t('onboarding.verifying')}`;

  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact, otp }),
    });
    const data = await response.json();
    if (response.status === 401) throw new Error('Invalid OTP');
    if (!response.ok) throw new Error(data.detail || 'Could not reach Tourix server');

    state.authToken = data.token || state.authToken;
    state.user.verified = true;
    persistTouristSession();
    nextStep(2);
  } catch (error) {
    alert(error.message || 'Could not reach Tourix server');
  } finally {
    if (btn) btn.innerHTML = `${t('onboarding.verifyOtp')}`;
  }
}

function toggleInterest(btn) {
  btn.classList.toggle('selected');
  const interest = btn.dataset.interest;
  if (state.user.interests.includes(interest)) {
    state.user.interests = state.user.interests.filter(i => i !== interest);
  } else {
    state.user.interests.push(interest);
  }
}

async function finalizeRegistration() {
  const nameInput = document.getElementById('ob-name');
  const phoneInput = document.getElementById('ob-phone');
  const emailInput = document.getElementById('ob-email');

  if (nameInput && nameInput.value.trim()) state.user.name = nameInput.value.trim();
  if (phoneInput && phoneInput.value.trim()) state.user.phone = phoneInput.value.trim();
  if (emailInput && emailInput.value.trim()) state.user.email = emailInput.value.trim();

  const name = state.user.name || 'Tourist';
  const phone = state.user.phone || '+91 98765 43210';
  const email = state.user.email || '';
  const emergencyContact = document.getElementById('ob-emergency')?.value?.trim() || '';
  state.user.emergencyContact = emergencyContact;
  state.user.verified = true;
  state.user.role = 'tourist';
  state.user.pace = document.getElementById('ob-pace')?.value || state.user.pace;

  const touristId = 'TX-' + Math.floor(1000 + Math.random() * 9000) + '-' + name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  state.user.touristId = touristId;

  const userRecord = {
    id: touristId,
    userId: touristId,
    name: name,
    phone: phone,
    email: email,
    age: 20,
    photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f766e&color=fff`,
    role: 'Tourist / Current User',
    status: 'Online',
    isYou: true,
    createdAt: new Date().toISOString(),
  };

  saveRegisteredUserRecord(userRecord);

  if (state.activeGroup && !state.activeGroup.members.includes(touristId)) {
    state.activeGroup.members.unshift(touristId);
  }

  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.authToken || ''}`,
      },
      body: JSON.stringify({
        name: name,
        phone: phone,
        email: email,
        role: state.user.role,
        emergency_contact: emergencyContact,
        pace: state.user.pace,
        interests: state.user.interests,
        verified: true,
      }),
    });
    const data = await response.json();
    if (data.tourist_id) {
      state.user.touristId = data.tourist_id;
      userRecord.id = data.tourist_id;
      userRecord.userId = data.tourist_id;
      saveRegisteredUserRecord(userRecord);
    }
  } catch (err) {
    console.warn('Backend sync registration note:', err.message);
  }

  persistTouristSession();

  showScreen('profile');
  setTimeout(() => {
    alert(`🎉 Registration Complete!\n\nWelcome ${name}!\nYour Official Tourist ID is: ${state.user.touristId}\nLinked Mobile: ${phone}\n\nYour profile has been saved across Tourix!`);
    showScreen('home');
  }, 400);
}

// ==========================================
// HOME SCREEN
// ==========================================
function renderHomeScreen() {
  const name = state.user.name?.split(' ')[0] || 'Traveler';
  const highlights = getHighlights(6);
  const heroImage = PlaceImageProvider.getImageUrl({ id: 'hero-banner', category: 'Heritage' });

  return `
    <div id="screen-home" class="screen">
      <!-- Greeting & Search Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h2 id="home-greeting" style="font-size:var(--text-xl);font-weight:800;color:var(--color-text-primary);">Discover India, ${name}</h2>
          <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);">Smart Tourism, Safety & Road Navigation</p>
        </div>
        <div style="width:40px;height:40px;border-radius:50%;background:var(--color-primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;box-shadow:var(--shadow-primary);cursor:pointer;" onclick="window.tourix.showScreen('profile')">
          <i class="fa-solid fa-user"></i>
        </div>
      </div>

      <!-- Hero Image Card -->
      <div class="card" style="padding:0;overflow:hidden;position:relative;height:170px;border-radius:var(--radius-lg);box-shadow:var(--shadow-md);">
        <img src="${heroImage}" alt="Discover India" style="width:100%;height:100%;object-fit:cover;" />
        <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.2) 100%);padding:16px;display:flex;flex-direction:column;justify-content:flex-end;color:#ffffff;">
          <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-accent-light);"><i class="fa-solid fa-compass"></i> Featured Experience</span>
          <h3 style="font-size:18px;font-weight:900;color:#ffffff;margin-top:2px;">Explore India's Next Landmark</h3>
          <p style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:2px;">Discover authentic heritage, spiritual temples & adventures.</p>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="search-bar">
        <i class="fa-solid fa-magnifying-glass search-bar__icon"></i>
        <input type="text" class="search-bar__input" id="home-search-input"
          placeholder="Search places, restaurants, experiences..."
          oninput="window.tourix.searchExplore(this.value); window.tourix.showScreen('explore')" />
      </div>

      <!-- Experience Categories -->
      <div>
        <div class="section-header" style="margin-bottom:8px;">
          <span class="section-header__title">Explore by Experience</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;">
          ${[
            { cat: 'Heritage', icon: 'fa-landmark', img: PlaceImageProvider.getImageUrl({ category: 'Heritage' }) },
            { cat: 'Spiritual', icon: 'fa-place-of-worship', img: PlaceImageProvider.getImageUrl({ category: 'Spiritual' }) },
            { cat: 'Adventure', icon: 'fa-person-hiking', img: PlaceImageProvider.getImageUrl({ category: 'Adventure' }) },
            { cat: 'Nature', icon: 'fa-leaf', img: PlaceImageProvider.getImageUrl({ category: 'Nature' }) },
          ].map(c => `
            <div class="card" style="padding:0;overflow:hidden;text-align:center;cursor:pointer;border:1px solid var(--color-border);" onclick="window.tourix.switchCategory('${c.cat}'); window.tourix.showScreen('explore')">
              <div style="height:54px;overflow:hidden;position:relative;">
                <img src="${c.img}" alt="${c.cat}" style="width:100%;height:100%;object-fit:cover;" />
                <div style="position:absolute;inset:0;background:rgba(15,23,42,0.35);"></div>
              </div>
              <div style="padding:6px 4px;font-size:11px;font-weight:700;color:var(--color-text-primary);">${c.cat}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Popular Places Near You -->
      <div>
        <div class="section-header" style="margin-bottom:8px;">
          <span class="section-header__title">Popular Near You</span>
          <span class="section-header__link" onclick="window.tourix.showScreen('explore')">View All</span>
        </div>
        <div class="h-scroll" id="home-highlights" style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;">
          ${highlights.map(p => renderHighlightCard(p)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderHighlightCard(place) {
  const imageUrl = PlaceImageProvider.getImageUrl(place);
  return `
    <div class="h-scroll__item card" style="padding:0;overflow:hidden;cursor:pointer;width:210px;flex-shrink:0;border:1px solid var(--color-border);" onclick="window.tourix.openPlaceDetail('${place.id}')">
      <div style="height:115px;position:relative;overflow:hidden;background:#f1f5f9;">
        <img src="${imageUrl}" alt="${place.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=1200&auto=format&fit=crop';" />
        <span class="badge" style="position:absolute;top:8px;left:8px;background:rgba(15,23,42,0.85);color:#fff;font-size:10px;padding:2px 6px;backdrop-filter:blur(4px);">
          ★ ${place.rating || 4.5}
        </span>
      </div>
      <div style="padding:10px;">
        <div style="font-size:13px;font-weight:700;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.name}</div>
        <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${place.city || 'Nashik'} • ${place.category}</div>
      </div>
    </div>
  `;
}

function refreshHome() {
  const greeting = document.getElementById('home-greeting');
  if (greeting) {
    const name = state.user.name?.split(' ')[0] || 'Tourist';
    greeting.textContent = t('home.greeting', { name });
  }
}

// ==========================================
// EXPLORE SCREEN
// ==========================================
function renderExploreScreen() {
  const categories = getCategories();
  return `
    <div id="screen-explore" class="screen" style="gap:var(--space-3);">
      <div>
        <h2 style="font-size:var(--text-xl);font-weight:800;" data-i18n="explore.title">${t('explore.title')}</h2>
        <p style="font-size:var(--text-base);color:var(--color-text-tertiary);" data-i18n="explore.subtitle">${t('explore.subtitle')}</p>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <i class="fa-solid fa-magnifying-glass search-bar__icon"></i>
        <input type="text" class="search-bar__input" id="explore-search-input"
          placeholder="${t('explore.searchPlaceholder')}"
          oninput="window.tourix.searchExplore(this.value)" />
      </div>

      <!-- View Toggle + Filters Row -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);">
        <div class="filter-chips" style="flex:1;" id="explore-filters">
          <button class="filter-chip ${state.sortNearMe ? 'active' : ''}" id="filter-chip-nearme" onclick="window.tourix.sortByNearMe()" style="display:flex;align-items:center;gap:4px;">
            <i class="fa-solid fa-location-crosshairs"></i> Near Me
          </button>
          ${categories.map(cat => `
            <button class="filter-chip ${cat === 'All' && !state.sortNearMe ? 'active' : ''}" onclick="window.tourix.switchCategory('${cat}')" data-cat="${cat}">
              ${t('categories.' + cat.toLowerCase()) || cat}
            </button>
          `).join('')}
        </div>
        <div class="view-toggle">
          <button class="view-toggle__btn active" id="view-list-btn" onclick="window.tourix.toggleExploreView('list')">
            <i class="fa-solid fa-list"></i>
          </button>
          <button class="view-toggle__btn" id="view-map-btn" onclick="window.tourix.toggleExploreView('map')">
            <i class="fa-solid fa-map"></i>
          </button>
        </div>
      </div>

      <!-- Map Container (hidden by default) -->
      <div id="explore-map-container" class="map-container map-container--large hidden"></div>

      <!-- Places List -->
      <div id="explore-places-list" style="display:flex;flex-direction:column;gap:var(--space-3);"></div>
    </div>
  `;
}

function refreshExplore() {
  let places = state.exploreCategory === 'All'
    ? NASHIK_PLACES
    : filterByCategory(state.exploreCategory);

  if (state.exploreSearch) {
    places = searchPlaces(state.exploreSearch).filter(p =>
      state.exploreCategory === 'All' || p.category === state.exploreCategory
    );
  }

  // If sortNearMe is active, compute precise distance to user coords
  if (state.sortNearMe && state.userCoords) {
    places = places.map(p => ({
      ...p,
      _userDist: haversine(state.userCoords.lat, state.userCoords.lng, p.latitude, p.longitude)
    })).sort((a, b) => a._userDist - b._userDist);
  }

  const container = document.getElementById('explore-places-list');
  if (!container) return;

  if (places.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon"><i class="fa-solid fa-magnifying-glass"></i></div>
        <div class="empty-state__title" data-i18n="explore.noResults">${t('explore.noResults')}</div>
        <div class="empty-state__desc" data-i18n="explore.noResultsDesc">${t('explore.noResultsDesc')}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = places.map(p => renderPlaceCard(p)).join('');
}

function renderPlaceCard(place) {
  const imageUrl = PlaceImageProvider.getImageUrl(place);
  const isSaved = state.savedPlaces.includes(place.id);
  const distanceText = place._userDist !== undefined
    ? (place._userDist < 1 ? Math.round(place._userDist * 1000) + ' m away' : place._userDist.toFixed(1) + ' km away')
    : (place.distance_from_nashik_km ? place.distance_from_nashik_km + ' km' : 'Nearby');

  return `
    <div class="card" style="padding:0;overflow:hidden;border:1px solid var(--color-border);margin-bottom:12px;cursor:pointer;box-shadow:var(--shadow-sm);" onclick="window.tourix.openPlaceDetail('${place.id}')">
      <div style="height:160px;position:relative;background:#f1f5f9;overflow:hidden;">
        <img src="${imageUrl}" alt="${place.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=1200&auto=format&fit=crop';" />
        <div style="position:absolute;bottom:0;inset-x:0;background:linear-gradient(to top, rgba(15,23,42,0.88) 0%, transparent 100%);padding:12px 14px;color:#fff;">
          <div style="font-size:16px;font-weight:800;color:#fff;">${place.name}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.85);font-weight:500;">${place.city || 'Nashik'}, Maharashtra</div>
        </div>
        <span class="badge" style="position:absolute;top:10px;right:10px;font-size:11px;background:#ffffff;color:#0f172a;box-shadow:0 2px 6px rgba(0,0,0,0.15);font-weight:700;">
          ★ ${place.rating || 4.5}
        </span>
      </div>
      <div style="padding:12px;display:flex;justify-content:space-between;align-items:center;background:#fff;">
        <div style="font-size:12px;color:var(--color-text-secondary);font-weight:600;">
          <span style="color:var(--color-primary);font-weight:700;">${place.category}</span>
          • ${distanceText}
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn--sm btn--primary" style="padding:4px 10px;font-size:11px;" onclick="event.stopPropagation();window.tourix.navigatePlace('${place.id}')">
            <i class="fa-solid fa-route"></i> Navigate
          </button>
        </div>
      </div>
    </div>
  `;
}

function sortByNearMe() {
  state.sortNearMe = !state.sortNearMe;
  const chip = document.getElementById('filter-chip-nearme');
  if (chip) chip.classList.toggle('active', state.sortNearMe);

  if (!state.sortNearMe) {
    refreshExplore();
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        refreshExplore();
      },
      () => {
        state.userCoords = { lat: CONFIG.defaultCenter.lat, lng: CONFIG.defaultCenter.lng };
        refreshExplore();
      },
      { timeout: 4000 }
    );
  } else {
    state.userCoords = { lat: CONFIG.defaultCenter.lat, lng: CONFIG.defaultCenter.lng };
    refreshExplore();
  }
}

function switchCategory(cat) {
  state.exploreCategory = cat;
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.cat === cat);
  });
  refreshExplore();
}

function searchExplore(query) {
  state.exploreSearch = query;
  refreshExplore();
}

function toggleExploreView(view) {
  state.exploreView = view;
  const listBtn = document.getElementById('view-list-btn');
  const mapBtn = document.getElementById('view-map-btn');
  const mapC = document.getElementById('explore-map-container');
  const listC = document.getElementById('explore-places-list');

  if (view === 'map') {
    mapBtn.classList.add('active');
    listBtn.classList.remove('active');
    mapC.classList.remove('hidden');
    listC.style.display = 'none';
    initExploreMap();
  } else {
    listBtn.classList.add('active');
    mapBtn.classList.remove('active');
    mapC.classList.add('hidden');
    listC.style.display = 'flex';
  }
}

function initExploreMap() {
  if (state.maps.explore) {
    state.maps.explore.invalidateSize();
    return;
  }
  const container = document.getElementById('explore-map-container');
  if (!container || typeof L === 'undefined') return;

  const map = L.map(container).setView([CONFIG.defaultCenter.lat, CONFIG.defaultCenter.lng], CONFIG.defaultZoom);
  L.tileLayer(CONFIG.tileUrl, { maxZoom: 18, attribution: CONFIG.tileAttribution }).addTo(map);

  NASHIK_PLACES.forEach(p => {
    if (p.latitude && p.longitude) {
      L.marker([p.latitude, p.longitude])
        .addTo(map)
        .bindPopup(`<strong>${p.name}</strong><br>${p.category}<br>${p.short_description}`);
    }
  });

  state.maps.explore = map;
  setTimeout(() => map.invalidateSize(), 300);
}

// ==========================================
// PLACE DETAIL SCREEN
// ==========================================
function renderPlaceDetailScreen() {
  return `<div id="screen-place-detail" class="screen screen--no-pad" style="gap:0;"></div>`;
}

function openPlaceDetail(placeId) {
  state.selectedPlaceId = placeId;
  const place = getPlaceById(placeId);
  if (!place) return;

  const color = getCategoryColor(place.category);
  const nearby = getNearbyPlaces(placeId, 3);
  const isSaved = state.savedPlaces.includes(placeId);

  const imageUrl = PlaceImageProvider.getImageUrl(place);
  const screen = document.getElementById('screen-place-detail');
  screen.innerHTML = `
    <!-- Real Destination Photo Hero -->
    <div style="position:relative;height:240px;width:100%;background:#0f172a;overflow:hidden;">
      <img src="${imageUrl}" alt="${place.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=1200&auto=format&fit=crop';" />
      <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(15,23,42,0.9) 0%, transparent 60%);"></div>
      <button class="place-detail__back" style="position:absolute;top:16px;left:16px;z-index:10;background:rgba(15,23,42,0.6);color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);border:none;" onclick="window.tourix.closePlaceDetail()">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div style="position:absolute;bottom:16px;left:16px;right:16px;color:#fff;">
        <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff;backdrop-filter:blur(4px);font-size:11px;">${place.category}${place.subcategory ? ' • ' + place.subcategory : ''}</span>
        <h2 style="font-size:22px;font-weight:900;color:#fff;margin-top:4px;">${place.name}</h2>
        <p style="font-size:12px;color:rgba(255,255,255,0.85);">${place.city || 'Nashik'}, ${place.district || 'Maharashtra'}</p>
      </div>
    </div>

    <!-- Content -->
    <div class="place-detail__content">
      <div>
        <span class="place-card__cat" style="background:${color.bg};color:${color.text};">${place.category}${place.subcategory ? ' • ' + place.subcategory : ''}</span>
        <h2 class="place-detail__title" style="margin-top:8px;">${place.name}</h2>
        <p style="font-size:var(--text-base);color:var(--color-text-secondary);margin-top:4px;">${place.city}, ${place.district}</p>
      </div>

      <!-- Rating -->
      <div style="display:flex;align-items:center;gap:var(--space-3);">
        <span style="font-size:var(--text-lg);font-weight:800;color:var(--color-text-primary);">${place.rating} ★</span>
        <span style="font-size:var(--text-base);color:var(--color-text-tertiary);">${place.review_count?.toLocaleString() || 'N/A'} reviews</span>
      </div>

      <!-- Info Grid -->
      <div class="place-detail__info-grid">
        <div class="place-detail__info-item">
          <div class="place-detail__info-label">${t('placeDetail.distance')}</div>
          <div class="place-detail__info-value">${place.distance_from_nashik_km === 0 ? t('common.nearby') : place.distance_from_nashik_km + ' km'}</div>
        </div>
        <div class="place-detail__info-item">
          <div class="place-detail__info-label">${t('placeDetail.visitTime')}</div>
          <div class="place-detail__info-value">${place.estimated_visit_duration || t('placeDetail.infoUnavailable')}</div>
        </div>
        <div class="place-detail__info-item">
          <div class="place-detail__info-label">${t('placeDetail.entryFee')}</div>
          <div class="place-detail__info-value">${place.entry_fee || t('placeDetail.infoUnavailable')}</div>
        </div>
        <div class="place-detail__info-item">
          <div class="place-detail__info-label">${t('placeDetail.bestTime')}</div>
          <div class="place-detail__info-value">${place.best_time || t('placeDetail.infoUnavailable')}</div>
        </div>
      </div>

      <!-- Description -->
      <p style="font-size:var(--text-md);color:var(--color-text-secondary);line-height:1.6;">${place.description}</p>

      ${place.safety_notes ? `
        <div class="card card--caution" style="border-color:#fde68a;">
          <div style="display:flex;align-items:flex-start;gap:var(--space-2);">
            <i class="fa-solid fa-shield-halved" style="color:var(--color-caution-dark);margin-top:2px;"></i>
            <div>
              <div style="font-weight:700;font-size:var(--text-base);color:var(--color-caution-dark);">${t('placeDetail.safety')}</div>
              <div style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-top:2px;">${place.safety_notes}</div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Open Hours -->
      ${place.opening_time && place.closing_time ? `
        <div style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-base);">
          <i class="fa-regular fa-clock" style="color:var(--color-text-tertiary);"></i>
          <span style="font-weight:600;">${t('placeDetail.openHours')}:</span>
          <span style="color:var(--color-text-secondary);">${place.opening_time} — ${place.closing_time}</span>
        </div>
      ` : ''}

      <!-- Tags -->
      ${place.tags?.length ? `
        <div>
          <div style="font-size:var(--text-xs);font-weight:700;color:var(--color-text-tertiary);text-transform:uppercase;margin-bottom:var(--space-2);">${t('placeDetail.tags')}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${place.tags.map(tag => `<span class="badge badge--primary">${tag}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Suitability -->
      <div>
        <div style="font-size:var(--text-xs);font-weight:700;color:var(--color-text-tertiary);text-transform:uppercase;margin-bottom:var(--space-2);">${t('placeDetail.suitableFor')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${place.family_friendly ? `<span class="badge badge--safe">${t('placeDetail.familyFriendly')}</span>` : ''}
          ${place.couple_friendly ? `<span class="badge badge--safe">${t('placeDetail.coupleFriendly')}</span>` : ''}
          ${place.solo_friendly ? `<span class="badge badge--safe">${t('placeDetail.soloFriendly')}</span>` : ''}
        </div>
      </div>

      <!-- Amenities -->
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);font-size:var(--text-sm);">
        ${place.parking_available ? `<span class="badge" style="background:var(--color-bg-tertiary);border:1px solid var(--color-border);color:var(--color-text-secondary);"><i class="fa-solid fa-square-parking" style="margin-right:4px;"></i>${t('placeDetail.parking')}</span>` : ''}
        ${place.washroom_available ? `<span class="badge" style="background:var(--color-bg-tertiary);border:1px solid var(--color-border);color:var(--color-text-secondary);"><i class="fa-solid fa-restroom" style="margin-right:4px;"></i>${t('placeDetail.washroom')}</span>` : ''}
        ${place.food_available ? `<span class="badge" style="background:var(--color-bg-tertiary);border:1px solid var(--color-border);color:var(--color-text-secondary);"><i class="fa-solid fa-utensils" style="margin-right:4px;"></i>${t('placeDetail.foodAvailable')}</span>` : ''}
        ${place.public_transport ? `<span class="badge" style="background:var(--color-bg-tertiary);border:1px solid var(--color-border);color:var(--color-text-secondary);"><i class="fa-solid fa-bus" style="margin-right:4px;"></i>${t('placeDetail.publicTransport')}</span>` : ''}
      </div>

      <!-- Action Buttons -->
      <div style="display:flex;gap:var(--space-2);">
        <button class="btn btn--primary" style="flex:1;" onclick="window.tourix.navigatePlace('${place.id}')">
          <i class="fa-solid fa-route"></i> ${t('placeDetail.startRoute')}
        </button>
        <button class="btn btn--secondary" onclick="window.tourix.savePlace('${place.id}')">
          <i class="fa-${isSaved ? 'solid' : 'regular'} fa-bookmark"></i>
        </button>
      </div>

      <!-- Nearby Places -->
      ${nearby.length ? `
        <div>
          <div class="section-header" style="margin-bottom:var(--space-2);">
            <span class="section-header__title">${t('placeDetail.nearbyPlaces')}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">
            ${nearby.map(np => `
              <div class="place-card" style="padding:10px;" onclick="window.tourix.openPlaceDetail('${np.id}')">
                <div class="place-card__image" style="width:48px;height:48px;font-size:16px;background:${getCategoryColor(np.category).bg};color:${getCategoryColor(np.category).text};">
                  <i class="fa-solid ${getCategoryIcon(np.category)}"></i>
                </div>
                <div class="place-card__body">
                  <div class="place-card__name" style="font-size:var(--text-base);">${np.name}</div>
                  <div class="place-card__meta">
                    <span class="place-card__dist">${np._dist ? np._dist.toFixed(1) + ' km' : ''}</span>
                    <span>${np.rating} ★</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  showScreen('place-detail');
}

function closePlaceDetail() {
  showScreen(state.previousScreen || 'explore');
}

function savePlace(placeId) {
  if (state.savedPlaces.includes(placeId)) {
    state.savedPlaces = state.savedPlaces.filter(id => id !== placeId);
  } else {
    state.savedPlaces.push(placeId);
  }
  // Re-open to refresh save button
  openPlaceDetail(placeId);
}

// ==========================================
// GROUP SAFETY SCREEN (Live Satellite GPS & Radar)
// ==========================================
function renderGroupScreen() {
  const activeGroup = state.activeGroup || {
    name: 'Tourix Demo Group',
    code: 'TOURIX6',
    members: ['ANUJ001', 'ADITI002', 'OMKAR003', 'HASTI004', 'PALAK005', 'MAVERICK006'],
  };
  const memberLocations = locationProvider.getMemberLocations(activeGroup.members);

  return `
    <div id="screen-group" class="screen">
      <!-- Header with Status, City Selector & Form Group Button -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div>
          <div style="display:flex;align-items:center;gap:6px;">
            <h2 style="font-size:var(--text-xl);font-weight:800;color:var(--color-text-primary);">${activeGroup.name}</h2>
            <span class="badge badge--safe" style="font-size:10px;">${activeGroup.code}</span>
          </div>
          <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);" id="group-subtitle">
            ${memberLocations.length} Group Members • Active Live Tracking
          </p>
        </div>
        <button class="btn btn--primary btn--sm" style="white-space:nowrap;" onclick="window.tourix.openFormGroupModal()">
          <i class="fa-solid fa-plus"></i> Form New Group
        </button>
      </div>

      <!-- City Selector & Simulation Control Bar -->
      <div class="card" style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--color-surface);border:1px solid var(--color-border-light);">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;font-weight:700;color:var(--color-text-secondary);"><i class="fa-solid fa-city"></i> City:</span>
          <select id="group-city-select" class="form-input form-select" style="font-size:11px;padding:4px 8px;" onchange="window.tourix.changeCity(this.value)">
            <option value="Nashik" ${locationProvider.cityName === 'Nashik' ? 'selected' : ''}>Nashik</option>
            <option value="Pune" ${locationProvider.cityName === 'Pune' ? 'selected' : ''}>Pune</option>
            <option value="Mumbai" ${locationProvider.cityName === 'Mumbai' ? 'selected' : ''}>Mumbai</option>
          </select>
        </div>

        <div style="display:flex;align-items:center;gap:4px;">
          <button class="btn btn--sm" style="padding:4px 8px;font-size:11px;background:#f0fdf4;color:#15803d;border:1px solid #a7f3d0;" onclick="window.tourix.startSimulation()" title="Start Location Simulation">
            ▶ Play
          </button>
          <button class="btn btn--sm" style="padding:4px 8px;font-size:11px;background:#fffbeb;color:#b45309;border:1px solid #fde68a;" onclick="window.tourix.pauseSimulation()" title="Pause Simulation">
            ⏸ Pause
          </button>
          <button class="btn btn--sm" style="padding:4px 8px;font-size:11px;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;" onclick="window.tourix.resetSimulation()" title="Reset Simulation Positions">
            ↻ Reset
          </button>
        </div>
      </div>

      <!-- 10-Meter Separation Alert -->
      <div id="separation-alert" class="card card--danger hidden" style="border-color:#fca5a5;">
        <div class="alert-box__header" style="color:var(--color-danger);">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span id="separation-alert-title">⚠️ GROUP SAFETY ALERT: Member Moving Away</span>
        </div>
        <p class="alert-box__body" id="separation-alert-desc">Movement detected beyond 10m safety threshold.</p>
        <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:10px;margin-top:6px;">
          <div>
            <div style="font-size:9px;font-weight:700;color:var(--color-text-tertiary);text-transform:uppercase;">${t('group.regroupPoint')}</div>
            <div style="font-weight:700;font-size:var(--text-md);" id="regroup-point-name">Safe Meeting Point</div>
            <div style="font-size:var(--text-xs);color:var(--color-safe);" id="regroup-point-desc">${t('group.safeMeeting')}</div>
          </div>
          <button class="btn btn--primary btn--sm" onclick="window.tourix.fitGroupBounds()">
            📍 Focus Group
          </button>
        </div>
      </div>

      <!-- Live Group Map Dashboard -->
      <div style="position:relative;border-radius:var(--radius-lg);overflow:hidden;">
        <div id="group-map-container" class="map-container" style="height:280px;"></div>
        <div style="position:absolute;bottom:10px;left:10px;z-index:999;background:rgba(15,23,42,0.85);backdrop-filter:blur(6px);color:#fff;padding:4px 10px;border-radius:12px;font-size:10px;font-weight:600;display:flex;align-items:center;gap:6px;pointer-events:none;">
          <span style="display:inline-block;width:6px;height:6px;background:#10b981;border-radius:50%;"></span>
          <span>10m Safety Radar • ${activeGroup.members.length} Members Live</span>
        </div>
        <button class="btn btn--sm" style="position:absolute;top:10px;right:10px;z-index:999;background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;box-shadow:0 2px 6px rgba(0,0,0,0.15);" onclick="window.tourix.fitGroupBounds()">
          🔍 Fit All 6 Members
        </button>
      </div>

      <!-- Vertically Scrollable Members List Header & Container -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:800;color:var(--color-text-primary);text-transform:uppercase;letter-spacing:0.05em;">
            GROUP MEMBERS (${activeGroup.members.length})
          </span>
          <span style="font-size:11px;color:var(--color-text-tertiary);">↕ Scroll to view all members</span>
        </div>
        <div class="card" id="group-members-list" style="padding:0;max-height:380px;overflow-y:auto;border:1px solid var(--color-border);border-radius:8px;">
          ${renderGroupMembersRows()}
        </div>
      </div>
    </div>
  `;
}

function renderGroupMembersRows() {
  const memberLocations = locationProvider.getMemberLocations(state.activeGroup.members);
  const anchor = memberLocations.find(m => m.isYou) || memberLocations[0];

  return memberLocations.map(m => {
    const dist = haversineMeters(m.lat, m.lng, anchor.lat, anchor.lng);
    const isSeparated = !m.isYou && dist > 10.0;
    const isSelected = state.selectedMemberId === m.id;

    return `
      <div class="member-row ${isSelected ? 'selected-member-row' : ''}" style="border-bottom:1px solid var(--color-border-light);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;background:${isSelected ? 'var(--color-primary-lighter)' : 'transparent'};" onclick="window.tourix.selectGroupMember('${m.id}')">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${m.photo}" alt="${m.name}" style="width:36px;height:36px;border-radius:50%;border:2px solid ${m.isYou ? 'var(--color-primary)' : (isSeparated ? '#dc2626' : '#0284c7')};object-fit:cover;" />
          <div>
            <div style="font-weight:700;font-size:13px;color:var(--color-text-primary);">
              ${m.name} <span style="font-size:10px;color:var(--color-text-tertiary);font-weight:600;">(${m.id})</span> ${m.isYou ? '<b>(You)</b>' : ''}
            </div>
            <div style="font-size:11px;color:var(--color-text-tertiary);" id="member-dist-${m.id}">
              ${m.isYou ? '🟢 Live GPS Anchor' : (isSeparated ? `⚠️ ${dist.toFixed(1)}m away (Outside 10m Threshold)` : `🟢 ${dist.toFixed(1)}m away`)}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="badge ${m.isYou ? 'badge--safe' : (isSeparated ? 'badge--danger' : 'badge--safe')}">
            ${m.isYou ? 'Live' : (isSeparated ? `Separated (${dist.toFixed(1)}m)` : 'With Group')}
          </span>
          <button class="btn btn--sm" style="padding:3px 8px;font-size:10px;" onclick="event.stopPropagation();window.tourix.openMemberProfile('${m.id}')">
            Profile
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function updateGroupMembersDisplay() {
  const container = document.getElementById('group-members-list');
  if (container) {
    container.innerHTML = renderGroupMembersRows();
  }
}

function createProfileMarkerIcon(member, isSeparated) {
  const borderColor = member.isYou ? '#0f766e' : (isSeparated ? '#dc2626' : '#0284c7');
  const badgeHtml = isSeparated ? '<span style="position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:800;">⚠️</span>' : '';

  return L.divIcon({
    className: 'profile-map-marker',
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;" onclick="window.tourix.openMemberProfile('${member.id}')">
        <div style="width:42px;height:42px;border-radius:50%;border:3px solid ${borderColor};box-shadow:0 3px 10px rgba(0,0,0,0.3);overflow:hidden;background:#fff;">
          <img src="${member.photo}" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0f766e&color=fff';" />
        </div>
        ${badgeHtml}
        <span style="background:rgba(15,23,42,0.88);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;margin-top:2px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);">
          ${member.name} ${isSeparated ? '⚠️' : ''}
        </span>
      </div>
    `,
    iconSize: [46, 62],
    iconAnchor: [23, 62],
  });
}

function initGroupMap() {
  const container = document.getElementById('group-map-container');
  if (!container) return;

  const Leaflet = typeof L !== 'undefined' ? L : window.L;
  if (!Leaflet) return;

  // Clean up any detached map instance if container element was replaced by re-render
  if (state.maps.group) {
    try {
      const currentContainer = state.maps.group.getContainer();
      if (!currentContainer || !document.body.contains(currentContainer) || currentContainer !== container) {
        state.maps.group.remove();
        state.maps.group = null;
        state._groupMemberMapMarkers = {};
      }
    } catch (e) {
      state.maps.group = null;
      state._groupMemberMapMarkers = {};
    }
  }

  if (!state.maps.group) {
    if (container._leaflet_id) {
      container._leaflet_id = null;
    }
    const map = Leaflet.map(container).setView([locationProvider.cityCenter.lat, locationProvider.cityCenter.lng], 15);
    Leaflet.tileLayer(CONFIG.tileUrl, { maxZoom: 19, attribution: CONFIG.tileAttribution }).addTo(map);
    state.maps.group = map;
  }

  const map = state.maps.group;

  updateGroupMapMarkers();

  if (!state._locationProviderSub) {
    state._locationProviderSub = locationProvider.subscribe(() => {
      updateGroupMapMarkers();
    });
  }

  requestAnimationFrame(() => {
    if (map) {
      map.invalidateSize();
      updateGroupMapMarkers();
    }
  });

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
      updateGroupMapMarkers();
    }
  }, 150);
}

function updateGroupMapMarkers() {
  if (!state.maps.group) return;
  const map = state.maps.group;

  const Leaflet = typeof L !== 'undefined' ? L : window.L;
  if (!Leaflet) return;

  const activeGroup = state.activeGroup || {
    name: 'Tourix Demo Group',
    code: 'TOURIX6',
    members: ['ANUJ001', 'ADITI002', 'OMKAR003', 'HASTI004', 'PALAK005', 'MAVERICK006'],
  };

  const memberLocations = locationProvider.getMemberLocations(activeGroup.members);
  const anchor = memberLocations.find(m => m.isYou) || memberLocations[0];

  state._groupMemberMapMarkers = state._groupMemberMapMarkers || {};

  let separatedMember = null;

  memberLocations.forEach(m => {
    const dist = haversineMeters(m.lat, m.lng, anchor.lat, anchor.lng);
    const isSeparated = !m.isYou && dist > 10.0;

    if (isSeparated && !separatedMember) {
      separatedMember = { member: m, dist };
    }

    const customIcon = createProfileMarkerIcon(m, isSeparated);

    if (state._groupMemberMapMarkers[m.id]) {
      state._groupMemberMapMarkers[m.id].setLatLng([m.lat, m.lng]);
      state._groupMemberMapMarkers[m.id].setIcon(customIcon);
    } else {
      const marker = Leaflet.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);
      marker.on('click', () => {
        openMemberProfile(m.id);
      });
      state._groupMemberMapMarkers[m.id] = marker;
    }
  });

  // Handle 10-meter separation alert
  const alertEl = document.getElementById('separation-alert');
  if (separatedMember) {
    if (alertEl) {
      alertEl.classList.remove('hidden');
      const titleEl = document.getElementById('separation-alert-title');
      if (titleEl) titleEl.innerHTML = `⚠️ GROUP SAFETY ALERT: ${separatedMember.member.name} is ${separatedMember.dist.toFixed(1)}m away from group.`;
    }
    triggerSeparationAudioAlert();
  } else {
    if (alertEl) alertEl.classList.add('hidden');
  }

  // Update member list display
  updateGroupMembersDisplay();
}

function startLiveGpsTracking() {
  if (!navigator.geolocation) {
    const statusEl = document.getElementById('group-gps-status');
    const accEl = document.getElementById('group-gps-accuracy');
    if (statusEl) statusEl.textContent = 'GPS Unavailable (Device)';
    if (accEl) accEl.textContent = '(Using Default)';
    return;
  }

  // 1. Initial quick high-accuracy fix
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      applyLiveUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, true);
    },
    (err) => {
      console.warn('Live GPS initial acquire notice:', err.message);
      const accEl = document.getElementById('group-gps-accuracy');
      if (accEl) accEl.textContent = '(Searching fix...)';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );

  // 2. Real-time dynamic location watcher
  if (state.geoWatchId === null) {
    state.geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        applyLiveUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, false);
      },
      (err) => {
        console.warn('GPS watch error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
  }
}

function applyLiveUserLocation(lat, lng, accuracy, autoFly = false) {
  state.userCoords = { lat, lng, accuracy: accuracy || 15 };
  state.userAccuracy = accuracy || 15;

  // Update UI telemetry badges
  const statusEl = document.getElementById('group-gps-status');
  const accEl = document.getElementById('group-gps-accuracy');
  const coordsEl = document.getElementById('group-coords-text');
  const dotEl = document.getElementById('group-gps-dot');

  if (statusEl) statusEl.textContent = 'Live Satellite GPS';
  if (accEl) {
    accEl.textContent = `(±${Math.round(accuracy || 12)}m accuracy)`;
    accEl.style.color = 'var(--color-safe)';
  }
  if (coordsEl) {
    coordsEl.textContent = `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E • Live`;
  }
  if (dotEl) {
    dotEl.style.background = '#10b981';
    dotEl.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.25)';
  }

  // Update Map Elements
  if (state.maps.group) {
    const map = state.maps.group;

    if (autoFly) {
      map.setView([lat, lng], 16, { animate: true });
    }

    if (state._groupUserMarker) {
      state._groupUserMarker.setLatLng([lat, lng]);
    }
    if (state._groupAccuracyCircle) {
      state._groupAccuracyCircle.setLatLng([lat, lng]).setRadius(Math.max(accuracy || 15, 10));
    }
    if (state._groupSafetyCircle) {
      state._groupSafetyCircle.setLatLng([lat, lng]);
    }

    // Update group members dynamically relative to user's real location
    const palakCoords = [lat + 0.00032, lng + 0.00038];
    if (state._memberMarkers && state._memberMarkers.palak) {
      state._memberMarkers.palak.setLatLng(palakCoords);
    }

    const hastiOffsetLat = state.groupSeparated ? 0.0031 : 0.00042;
    const hastiOffsetLng = state.groupSeparated ? 0.0032 : -0.00028;
    const hastiCoords = [lat + hastiOffsetLat, lng + hastiOffsetLng];
    if (state._memberMarkers && state._memberMarkers.hasti) {
      state._memberMarkers.hasti.setLatLng(hastiCoords);
    }
  }

  // Refresh members list DOM
  updateGroupMembersDisplay();

  // Send real live WebSocket anchor ping
  if (state.groupWs && state.groupWs.readyState === WebSocket.OPEN) {
    state.groupWs.send(JSON.stringify({
      user: state.user.name || 'Aditi',
      user_id: 'aditi',
      lat: lat,
      lng: lng,
      is_anchor: true
    }));
  }
}

function locateUserNow() {
  const statusEl = document.getElementById('group-gps-status');
  const accEl = document.getElementById('group-gps-accuracy');
  if (statusEl) statusEl.textContent = 'Locating Device...';
  if (accEl) accEl.textContent = '(Acquiring fix)';

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      applyLiveUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, false);
      if (state.maps.group) {
        state.maps.group.flyTo([pos.coords.latitude, pos.coords.longitude], 17, { duration: 1.2 });
      }
    },
    (err) => {
      alert('Could not acquire your current location: ' + (err.message || 'Permission denied'));
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

async function navigateGroupDestination(forcedTarget = '') {
  const targetId = forcedTarget || document.getElementById('group-navigation-target')?.value;
  if (!targetId) {
    alert('Choose a group member or tourist spot first.');
    return;
  }

  let destination;
  if (targetId.startsWith('member:')) {
    const memberId = targetId.slice('member:'.length);
    const member = CONFIG.demoGroupMembers.find(item => item.id === memberId);
    const markerPoint = state._memberMarkers?.[memberId]?.getLatLng?.();
    if (member) {
      destination = {
        lat: markerPoint?.lat ?? member.lat,
        lng: markerPoint?.lng ?? member.lng,
        name: member.name,
      };
    }
  } else if (targetId.startsWith('spot:')) {
    const place = getPlaceById(targetId.slice('spot:'.length));
    if (place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
      destination = { lat: place.latitude, lng: place.longitude, name: place.name };
    }
  }

  if (!destination) {
    alert('The selected destination has no available coordinates.');
    return;
  }

  let origin = state.userCoords;
  if (!origin && navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
      });
      origin = { lat: position.coords.latitude, lng: position.coords.longitude };
      state.userCoords = origin;
    } catch {
      alert('Your location is unavailable. Allow location access or enable GPS, then try again.');
      return;
    }
  }
  if (!origin) {
    alert('Your location is unavailable. Allow location access or enable GPS, then try again.');
    return;
  }

  const summary = document.getElementById('group-route-summary');
  const mapsLink = document.getElementById('group-turn-by-turn');
  if (summary) {
    summary.textContent = `Finding route to ${destination.name}...`;
    summary.classList.remove('hidden');
  }

  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/ai/route-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Route lookup failed');

    const route = result.route || {};
    const roadGeometry = Array.isArray(route.geometry) && route.geometry.length > 1;
    const latLngs = roadGeometry
      ? route.geometry.map(([lng, lat]) => [lat, lng])
      : [[origin.lat, origin.lng], [destination.lat, destination.lng]];

    if (state._groupRouteLine && state.maps.group) state.maps.group.removeLayer(state._groupRouteLine);
    if (state.maps.group) {
      state._groupRouteLine = L.polyline(latLngs, {
        color: result.is_safe ? '#0f766e' : '#dc2626',
        weight: 5,
        opacity: 0.9,
        dashArray: roadGeometry ? null : '8, 8',
      }).addTo(state.maps.group);
      state.maps.group.fitBounds(state._groupRouteLine.getBounds(), { padding: [28, 28] });
    }

    if (summary) {
      const routeKind = roadGeometry ? 'Road route' : 'Direct-line estimate';
      const warningText = route.warnings?.length ? ' · safety warning on route' : '';
      summary.textContent = `${routeKind} to ${destination.name} · ${route.distance_km ?? '—'} km · about ${route.estimated_duration_minutes ?? '—'} min${warningText}${roadGeometry ? '' : ' · open Maps for turn-by-turn directions'}`;
    }
    if (mapsLink) {
      mapsLink.href = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=walking`;
      mapsLink.classList.remove('hidden');
    }
  } catch (error) {
    if (summary) summary.textContent = error.message || 'Could not calculate route.';
    if (mapsLink) mapsLink.classList.add('hidden');
  }
}

function connectGroupWebSocket() {
  if (state.groupWs && (state.groupWs.readyState === WebSocket.OPEN || state.groupWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const groupId = 'nashik-tourists';
  const apiUrl = CONFIG.apiUrl || 'http://localhost:8000';
  const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws/group/${groupId}`;

  try {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      state.wsConnected = true;
      updateWsBadge(true);
      // Register current user as anchor with real GPS if available
      const lat = state.userCoords ? state.userCoords.lat : CONFIG.defaultCenter.lat;
      const lng = state.userCoords ? state.userCoords.lng : CONFIG.defaultCenter.lng;
      ws.send(JSON.stringify({
        user: state.user.name || 'Aditi',
        user_id: 'aditi',
        lat: lat,
        lng: lng,
        is_anchor: true
      }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleGroupSocketMessage(payload);
      } catch (err) {
        console.warn('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      state.wsConnected = false;
      updateWsBadge(false);
      state.groupWs = null;
    };

    ws.onerror = () => {
      state.wsConnected = false;
      updateWsBadge(false);
    };

    state.groupWs = ws;
  } catch (e) {
    state.wsConnected = false;
    updateWsBadge(false);
  }
}

function updateWsBadge(connected) {
  const badge = document.getElementById('group-ws-badge');
  const text = document.getElementById('group-ws-text');
  if (badge && text) {
    badge.className = `badge ${connected ? 'badge--safe' : 'badge--caution'}`;
    text.textContent = connected ? 'Live Radar' : 'Local Mode';
  }
}

function handleGroupSocketMessage(data) {
  const alertEl = document.getElementById('separation-alert');
  const alertTitle = document.getElementById('separation-alert-title');
  const alertDesc = document.getElementById('separation-alert-desc');
  const regroupName = document.getElementById('regroup-point-name');
  const regroupDesc = document.getElementById('regroup-point-desc');
  const badge = document.getElementById(`member-badge-${data.user_id || (data.user ? data.user.toLowerCase() : 'hasti')}`);
  const distEl = document.getElementById(`member-dist-${data.user_id || (data.user ? data.user.toLowerCase() : 'hasti')}`);

  if (data.is_separated) {
    state.groupSeparated = true;
    alertEl?.classList.remove('hidden');
    if (alertTitle) alertTitle.textContent = `${t('group.separationAlert')}: ${data.user} is away (${data.distance}m)`;
    if (alertDesc) alertDesc.textContent = `Movement trend detected beyond ${data.threshold_meters || 300}m safety threshold.`;
    if (regroupName && data.regroup_suggestion) regroupName.textContent = data.regroup_suggestion;
    if (regroupDesc && data.regroup_point) regroupDesc.textContent = `${data.regroup_point.address || 'Safe Meeting Hub'} (${data.regroup_point.distance_meters || 210}m)`;
    if (badge) {
      badge.textContent = `${t('group.separated')} (${data.distance}m)`;
      badge.className = 'badge badge--danger';
    }
    if (distEl) distEl.textContent = `${data.distance}m away (Outside Safety Zone)`;

    if (state._hastiMarker && data.lat && data.lng) {
      state._hastiMarker.setLatLng([data.lat, data.lng]).setStyle({
        color: '#dc2626',
        fillColor: '#ef4444'
      });
      state._hastiMarker.setPopupContent(`<b>${data.user || 'Hasti'}</b><br><small style="color:red">Separated (${data.distance}m away)</small>`);

      if (state.maps.group && state.userCoords) {
        state.maps.group.fitBounds([[state.userCoords.lat, state.userCoords.lng], [data.lat, data.lng]], { padding: [40, 40] });
      }
    }
  } else {
    state.groupSeparated = false;
    alertEl?.classList.add('hidden');
    if (badge) {
      badge.textContent = t('group.withGroup');
      badge.className = 'badge badge--safe';
    }
    if (distEl) distEl.textContent = `${data.distance || 52}m away`;

    if (state._hastiMarker && data.lat && data.lng) {
      state._hastiMarker.setLatLng([data.lat, data.lng]).setStyle({
        color: '#0284c7',
        fillColor: '#38bdf8'
      });
      state._hastiMarker.setPopupContent(`<b>${data.user || 'Hasti'}</b><br><small>With Group (${data.distance || 52}m)</small>`);
    }
  }
}

function toggleGroupSeparation() {
  state.groupSeparated = !state.groupSeparated;

  const userLat = state.userCoords ? state.userCoords.lat : CONFIG.defaultCenter.lat;
  const userLng = state.userCoords ? state.userCoords.lng : CONFIG.defaultCenter.lng;

  const hastiLat = state.groupSeparated ? userLat + 0.0031 : userLat + 0.00042;
  const hastiLng = state.groupSeparated ? userLng + 0.0032 : userLng - 0.00028;

  // Send real live WebSocket ping if connected
  if (state.groupWs && state.groupWs.readyState === WebSocket.OPEN) {
    const ping = {
      user: 'Hasti',
      user_id: 'hasti',
      lat: hastiLat,
      lng: hastiLng,
      is_anchor: false
    };
    state.groupWs.send(JSON.stringify(ping));
    return;
  }

  // Graceful offline fallback simulation
  const alert = document.getElementById('separation-alert');
  const badge = document.getElementById('member-badge-hasti');
  const distEl = document.getElementById('member-dist-hasti');

  if (state.groupSeparated) {
    alert?.classList.remove('hidden');
    if (badge) {
      badge.textContent = `${t('group.separated')} (420m)`;
      badge.className = 'badge badge--danger';
    }
    if (distEl) distEl.textContent = '420m away (Outside Safety Zone)';

    if (state._hastiMarker) {
      state._hastiMarker.setLatLng([hastiLat, hastiLng]).setStyle({
        color: '#dc2626',
        fillColor: '#ef4444'
      });
      state._hastiMarker.setPopupContent('<b>Hasti</b><br><small style="color:red">Separated (420m away)</small>');
    }
    if (state.maps.group) {
      state.maps.group.fitBounds([[userLat, userLng], [hastiLat, hastiLng]], { padding: [40, 40] });
    }
  } else {
    alert?.classList.add('hidden');
    if (badge) {
      badge.textContent = t('group.withGroup');
      badge.className = 'badge badge--safe';
    }
    if (distEl) distEl.textContent = '52m away';

    if (state._hastiMarker) {
      state._hastiMarker.setLatLng([hastiLat, hastiLng]).setStyle({
        color: '#0284c7',
        fillColor: '#38bdf8'
      });
      state._hastiMarker.setPopupContent('<b>Hasti</b><br><small>With Group (52m)</small>');
    }
  }
}

// ==========================================
// TRIP / SAFE ROUTE SCREEN (AI Planner & Radar)
// ==========================================
function renderTripScreen() {
  const p = state.itineraryParams;
  const destName = state.selectedDestination ? state.selectedDestination.name : 'Trimbakeshwar Temple';
  const mode = state.selectedTravelMode || 'car';

  return `
    <div id="screen-trip" class="screen">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h2 style="font-size:var(--text-lg);font-weight:800;color:var(--color-text-primary);">Navigate to ${destName}</h2>
          <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);">Road Network Navigation & Safety Engine</p>
        </div>
        <button class="btn btn--sm" style="background:var(--color-caution-light);color:var(--color-caution-dark);border:1px solid #fde68a;" onclick="window.tourix.toggleRiskAlert()">
          ${t('trip.triggerRisk')}
        </button>
      </div>

      <!-- Travel Mode Selection Bar -->
      <div style="display:flex;gap:var(--space-2);margin-top:var(--space-2);margin-bottom:var(--space-2);overflow-x:auto;padding-bottom:4px;">
        <button class="filter-chip ${mode === 'car' ? 'active' : ''}" onclick="window.tourix.setTravelMode('car')">
          🚗 Car
        </button>
        <button class="filter-chip ${mode === 'bike' ? 'active' : ''}" onclick="window.tourix.setTravelMode('bike')">
          🏍️ Bike
        </button>
        <button class="filter-chip ${mode === 'walk' ? 'active' : ''}" onclick="window.tourix.setTravelMode('walk')">
          🚶 Walk
        </button>
        <button class="filter-chip ${mode === 'transit' ? 'active' : ''}" onclick="window.tourix.setTravelMode('transit')">
          🚌 Transit
        </button>
      </div>

      <!-- Route Map Container with Floating Controls -->
      <div style="position:relative;">
        <div id="route-map-container" class="map-container map-container--large"></div>
        <div style="position:absolute;top:10px;right:10px;z-index:1000;display:flex;flex-direction:column;gap:6px;">
          <button class="btn btn--sm" style="background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;box-shadow:0 2px 6px rgba(0,0,0,0.15);" onclick="window.tourix.centerMyLocation()" title="Center My Location">
            🎯 My Location
          </button>
          <button class="btn btn--sm" style="background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;box-shadow:0 2px 6px rgba(0,0,0,0.15);" onclick="window.tourix.fitRouteBounds()" title="Fit Route Bounds">
            🔍 Fit Route
          </button>
        </div>
      </div>

      <!-- Route Info Panel -->
      <div id="route-info-panel" style="margin-top:var(--space-2);">
        ${renderRouteInfoPanelHtml()}
      </div>

      <!-- Risk Alert -->
      <div id="risk-alert" class="card card--danger hidden" style="border-color:#fca5a5;margin-top:var(--space-2);">
        <div class="alert-box__header" style="color:var(--color-danger);">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span data-i18n="trip.riskAlert">${t('trip.riskAlert')}</span>
        </div>
        <p class="alert-box__body" data-i18n="trip.riskDesc">${t('trip.riskDesc')}</p>
        <button class="btn btn--primary btn--full btn--sm" onclick="window.tourix.rerouteSafe()">
          ${t('trip.reroute')}
        </button>
      </div>

      <!-- AI Itinerary Generator -->
      <div class="card" style="margin-top:var(--space-4);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);">
          <div>
            <h3 style="font-size:var(--text-md);font-weight:700;display:flex;align-items:center;gap:6px;">
              <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--color-primary);"></i>
              AI Safe Itinerary Generator
            </h3>
            <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);">Daylight-optimized schedules with Nashik safety scoring</p>
          </div>
        </div>

        <!-- Duration Select -->
        <div style="margin-bottom:var(--space-3);">
          <label style="font-size:10px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:6px;">Available Time</label>
          <div style="display:flex;gap:var(--space-2);" id="itinerary-hours-chips">
            <button class="filter-chip ${p.hours === 4 ? 'active' : ''}" onclick="window.tourix.setItineraryOption('hours', 4)">4 Hours</button>
            <button class="filter-chip ${p.hours === 6 ? 'active' : ''}" onclick="window.tourix.setItineraryOption('hours', 6)">6 Hours</button>
            <button class="filter-chip ${p.hours === 8 ? 'active' : ''}" onclick="window.tourix.setItineraryOption('hours', 8)">8 Hours</button>
            <button class="filter-chip ${p.hours === 12 ? 'active' : ''}" onclick="window.tourix.setItineraryOption('hours', 12)">Full Day</button>
          </div>
        </div>

        <!-- Preference Select -->
        <div style="margin-bottom:var(--space-3);">
          <label style="font-size:10px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:6px;">Travel Preference</label>
          <div style="display:flex;gap:var(--space-2);overflow-x:auto;padding-bottom:4px;" id="itinerary-pref-chips">
            <button class="filter-chip ${p.preference === 'Heritage' ? 'active' : ''}" onclick="window.tourix.setItineraryOption('preference', 'Heritage')">Heritage</button>
            <button class="filter-chip ${p.preference === 'Spiritual' ? 'active' : ''}" onclick="window.tourix.setItineraryOption('preference', 'Spiritual')">Spiritual</button>
            <button class="filter-chip ${p.preference === 'Vineyards' ? 'active' : ''}" onclick="window.tourix.setItineraryOption('preference', 'Vineyards')">Vineyards</button>
            <button class="filter-chip ${p.preference === 'Nature' ? 'active' : ''}" onclick="window.tourix.setItineraryOption('preference', 'Nature')">Nature</button>
            <button class="filter-chip ${p.preference === 'Adventure' ? 'active' : ''}" onclick="window.tourix.setItineraryOption('preference', 'Adventure')">Adventure</button>
          </div>
        </div>

        <!-- Generate Button -->
        <button id="generate-itinerary-btn" class="btn btn--primary btn--full" onclick="window.tourix.generateCustomItinerary()">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span id="generate-itin-btn-text">Generate AI Itinerary</span>
        </button>
      </div>

      <!-- Generated Timeline Output -->
      <div id="itinerary-timeline-container" style="margin-top:var(--space-4);">
        ${renderItineraryTimelineHtml()}
      </div>
    </div>
  `;
}

function renderItineraryTimelineHtml() {
  if (state.itineraryLoading) {
    return `
      <div class="card" style="text-align:center;padding:var(--space-6);">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size:28px;color:var(--color-primary);margin-bottom:var(--space-2);"></i>
        <div style="font-weight:700;font-size:var(--text-base);">Crafting Safe Itinerary...</div>
        <p style="font-size:var(--text-xs);color:var(--color-text-tertiary);margin-top:4px;">Optimizing routes, daylight windows, and safety scores in Nashik</p>
      </div>
    `;
  }

  if (!state.currentItinerary) {
    return `
      <div class="card card--safety" style="text-align:center;padding:var(--space-4);">
        <i class="fa-solid fa-map-location-dot" style="font-size:24px;color:var(--color-primary);margin-bottom:var(--space-2);"></i>
        <div style="font-weight:700;font-size:var(--text-base);">AI Itinerary Ready to Plan</div>
        <p style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:4px;">
          Choose your hours and interest above, then tap <b>Generate AI Itinerary</b> to get a verified timeline with real-time safety scores.
        </p>
      </div>
    `;
  }

  const itin = state.currentItinerary;
  const stops = itin.itinerary || [];

  return `
    <div class="card card--safe" style="margin-bottom:var(--space-3);background:var(--color-safe-lighter);border-color:#bbf7d0;">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <i class="fa-solid fa-shield-halved" style="color:var(--color-safe);margin-top:2px;"></i>
        <div>
          <div style="font-weight:700;font-size:var(--text-sm);color:var(--color-safe-dark);">AI Safety Briefing</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary);margin-top:2px;">
            ${itin.safety_briefing || 'Tour completed during verified daylight hours with lower-risk corridors.'}
          </div>
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);">
      <h3 style="font-weight:800;font-size:var(--text-md);">${itin.preference} Schedule (${itin.total_hours || state.itineraryParams.hours}h)</h3>
      <span class="badge badge--safe" style="font-size:10px;">Saved to Cloud ✓</span>
    </div>

    <div class="timeline">
      ${stops.map(stop => `
        <div class="timeline-item">
          <span class="timeline-item__badge">${stop.time}</span>
          <div class="card" style="margin-bottom:var(--space-3);padding:12px;">
            <div style="font-weight:700;font-size:var(--text-base);color:var(--color-text-primary);">${stop.title}</div>
            <p style="font-size:var(--text-xs);color:var(--color-text-secondary);line-height:1.4;margin:4px 0 8px 0;">${stop.desc}</p>
            <div style="display:flex;gap:6px;align-items:center;">
              <span class="badge badge--safe" style="font-size:9px;">
                <i class="fa-solid fa-check" style="font-size:8px;margin-right:2px;"></i>${stop.safety_level || 'Safe'}
              </span>
              ${stop.est_duration ? `<span class="badge" style="font-size:9px;background:var(--color-bg-tertiary);">${stop.est_duration}</span>` : ''}
              ${stop.category ? `<span class="badge" style="font-size:9px;background:var(--color-primary-lighter);color:var(--color-primary);">${stop.category}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function setItineraryOption(key, val) {
  state.itineraryParams[key] = val;
  const hoursChips = document.querySelectorAll('#itinerary-hours-chips .filter-chip');
  const prefChips = document.querySelectorAll('#itinerary-pref-chips .filter-chip');

  if (key === 'hours') {
    hoursChips.forEach(btn => {
      btn.classList.toggle('active', btn.textContent.includes(`${val} Hour`) || (val === 12 && btn.textContent.includes('Full Day')));
    });
  } else if (key === 'preference') {
    prefChips.forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === val.toLowerCase());
    });
  }
}

async function generateCustomItinerary() {
  state.itineraryLoading = true;
  const container = document.getElementById('itinerary-timeline-container');
  const btnText = document.getElementById('generate-itin-btn-text');
  if (container) container.innerHTML = renderItineraryTimelineHtml();
  if (btnText) btnText.textContent = 'Generating Safe Schedule...';

  const payload = {
    hours: state.itineraryParams.hours,
    preference: state.itineraryParams.preference,
    pace: state.itineraryParams.pace,
    budget: 'moderate',
    user_id: state.user.name ? state.user.name.toLowerCase().replace(/\s+/g, '_') : 'aditi_sharma'
  };

  try {
    const res = await fetch(`${CONFIG.apiUrl}/api/ai/generate-itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.currentItinerary = data;
  } catch (err) {
    console.warn('AI Itinerary API error, using smart local fallback:', err);
    let fallbackStops = [];
    if (payload.preference.toLowerCase() === 'spiritual') {
      fallbackStops = [
        { time: '08:30 AM', title: 'Trimbakeshwar Jyotirlinga Temple', desc: 'Visit early for peaceful morning darshan.', safety_level: 'Safe daylight hours', category: 'Spiritual', est_duration: '2 hours' },
        { time: '12:00 PM', title: 'Panchavati & Kalaram Temple', desc: 'Explore historic Ramayana sacred quarter.', safety_level: 'Well-monitored area', category: 'Heritage', est_duration: '1.5 hours' },
        { time: '02:30 PM', title: 'Ramkund & Godavari Ghats', desc: 'Serene riverfront rituals and photography.', safety_level: 'Step caution near water', category: 'Spiritual', est_duration: '1 hour' }
      ];
    } else if (payload.preference.toLowerCase() === 'vineyards') {
      fallbackStops = [
        { time: '11:00 AM', title: 'Sula Vineyards', desc: 'Guided winery tasting and grape garden walk.', safety_level: 'Verified tourist estate', category: 'Vineyards', est_duration: '2.5 hours' },
        { time: '02:30 PM', title: 'York Winery & Tasting Room', desc: 'Wine tasting overlooking Gangapur backwaters.', safety_level: 'Safe daylight hours', category: 'Vineyards', est_duration: '1.5 hours' },
        { time: '04:30 PM', title: 'Gangapur Dam Promenade', desc: 'Sunset lakeside promenade with MTDC kiosk.', safety_level: 'Return before dusk', category: 'Nature', est_duration: '1 hour' }
      ];
    } else {
      fallbackStops = [
        { time: '09:00 AM', title: 'Pandavleni Buddhist Caves', desc: 'Hike 2nd-century BCE rock-cut caves.', safety_level: 'Sports shoes recommended', category: 'Heritage', est_duration: '2 hours' },
        { time: '12:00 PM', title: 'Old Nashik Cultural Heritage Walk', desc: 'Sarkarwada and traditional culinary bazaars.', safety_level: 'Safe pedestrian market', category: 'Culture', est_duration: '1.5 hours' },
        { time: '03:30 PM', title: 'Someshwar Waterfalls', desc: 'Scenic Godavari waterfall & nature trail.', safety_level: 'Caution on wet rocks', category: 'Nature', est_duration: '1.5 hours' }
      ];
    }

    state.currentItinerary = {
      status: 'fallback',
      total_hours: payload.hours,
      preference: payload.preference,
      itinerary: fallbackStops,
      safety_briefing: 'Tour organized strictly within verified daylight hours and lower-risk tourist corridors in Nashik.'
    };
  } finally {
    state.itineraryLoading = false;
    if (container) container.innerHTML = renderItineraryTimelineHtml();
    if (btnText) btnText.textContent = 'Generate AI Itinerary';
  }
}

function renderRouteInfoPanelHtml() {
  const mode = state.selectedTravelMode || 'car';
  if (mode === 'transit') {
    return `
      <div class="card card--caution" style="border-color:#fde68a;background:#fffbeb;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;color:#d97706;font-weight:700;font-size:14px;">
          <i class="fa-solid fa-bus"></i>
          Public transport routing is currently unavailable for this destination.
        </div>
        <p style="font-size:12px;color:#92400e;margin-top:4px;">
          Please select Car 🚗, Bike 🏍️, or Walking 🚶 for actual road-based directions.
        </p>
      </div>
    `;
  }

  const route = state.activeRoute;
  if (!route) {
    return `
      <div class="card" style="padding:12px;text-align:center;">
        <i class="fa-solid fa-circle-notch fa-spin" style="color:var(--color-primary);"></i> Calculating road route...
      </div>
    `;
  }

  if (route.error) {
    return `
      <div class="card card--danger" style="padding:12px;">
        <div style="color:var(--color-danger);font-weight:700;">No route could be calculated.</div>
        <p style="font-size:12px;color:var(--color-text-tertiary);">${route.error}</p>
      </div>
    `;
  }

  const modeIconMap = { car: '🚗 Car', bike: '🏍️ Bike', walk: '🚶 Walking' };
  const modeLabel = modeIconMap[mode] || '🚗 Car';

  return `
    <div class="card" style="padding:12px;border-left:4px solid var(--color-primary);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:11px;font-weight:700;color:var(--color-primary);text-transform:uppercase;">${modeLabel} • Recommended Route</span>
          <div style="font-size:18px;font-weight:800;color:var(--color-text-primary);margin-top:2px;">
            ${route.estimated_duration_minutes ? route.estimated_duration_minutes + ' min' : '—'}
            <span style="font-size:14px;font-weight:600;color:var(--color-text-secondary);">(${route.distance_km ? route.distance_km + ' km' : '—'})</span>
          </div>
        </div>
        <button class="btn btn--primary btn--sm" onclick="alert('Navigation started!')">
          <i class="fa-solid fa-location-arrow"></i> Start
        </button>
      </div>

      ${route.warnings && route.warnings.length ? `
        <div style="margin-top:8px;font-size:11px;color:#dc2626;background:#fee2e2;padding:6px 10px;border-radius:6px;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-triangle-exclamation"></i> ${route.warnings[0].description}
        </div>
      ` : ''}

      ${route.alternatives && route.alternatives.length ? `
        <div style="margin-top:10px;border-top:1px solid var(--color-border);padding-top:8px;">
          <div style="font-size:11px;font-weight:700;color:var(--color-text-tertiary);margin-bottom:6px;">ALTERNATIVE ROUTES</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${route.alternatives.map((alt, idx) => `
              <div style="display:flex;justify-content:space-between;align-items:center;background:var(--color-bg-secondary);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;" onclick="window.tourix.selectAlternativeRoute(${idx})">
                <span style="font-weight:600;">Alternative ${idx + 1}</span>
                <span><strong>${alt.estimated_duration_minutes} min</strong> (${alt.distance_km} km)</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

async function calculateAndRenderRoute() {
  const container = document.getElementById('route-map-container');
  if (!container || typeof L === 'undefined') return;

  if (!state.maps.route) {
    const map = L.map(container).setView([CONFIG.defaultCenter.lat, CONFIG.defaultCenter.lng], 11);
    L.tileLayer(CONFIG.tileUrl, { maxZoom: 18, attribution: CONFIG.tileAttribution }).addTo(map);
    state.maps.route = map;
  }
  const map = state.maps.route;
  setTimeout(() => map.invalidateSize(), 200);

  const origin = state.userCoords || { lat: 20.0059, lng: 73.7903, name: 'My Location' };
  const destination = state.selectedDestination || { lat: 19.9328, lng: 73.5308, name: 'Trimbakeshwar Temple' };
  const mode = state.selectedTravelMode || 'car';

  // Clear existing markers & route layer
  if (state._routeMarkers) {
    state._routeMarkers.forEach(m => map.removeLayer(m));
  }
  state._routeMarkers = [];

  if (state._routePolyline) {
    map.removeLayer(state._routePolyline);
    state._routePolyline = null;
  }

  // Add start and destination markers
  const startMarker = L.marker([origin.lat, origin.lng]).addTo(map).bindPopup(`<b>Start:</b> ${origin.name || 'My Location'}`);
  const destMarker = L.marker([destination.lat, destination.lng]).addTo(map).bindPopup(`<b>Destination:</b> ${destination.name}`);
  state._routeMarkers.push(startMarker, destMarker);

  const infoPanel = document.getElementById('route-info-panel');

  if (mode === 'transit') {
    state.activeRoute = null;
    if (infoPanel) infoPanel.innerHTML = renderRouteInfoPanelHtml();
    map.fitBounds(L.featureGroup([startMarker, destMarker]).getBounds(), { padding: [40, 40] });
    return;
  }

  // Cache key
  const cacheKey = `${origin.lat.toFixed(4)}_${origin.lng.toFixed(4)}_${destination.lat.toFixed(4)}_${destination.lng.toFixed(4)}_${mode}`;
  state._routeCache = state._routeCache || {};

  let routeData = state._routeCache[cacheKey];

  if (!routeData) {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/api/ai/route-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, mode }),
      });
      if (!response.ok) throw new Error('Routing service unavailable');
      const result = await response.json();
      routeData = result.route;
      state._routeCache[cacheKey] = routeData;
    } catch (err) {
      console.warn('Road routing fetch failed:', err);
      routeData = {
        error: 'No route could be calculated. Please check network connection.',
        geometry: [],
        distance_km: 0,
        estimated_duration_minutes: 0
      };
    }
  }

  state.activeRoute = routeData;
  if (infoPanel) infoPanel.innerHTML = renderRouteInfoPanelHtml();

  if (routeData && routeData.geometry && routeData.geometry.length) {
    // GeoJSON [lng, lat] to Leaflet [lat, lng]
    const latLngs = routeData.geometry.map(([lng, lat]) => [lat, lng]);
    state._routePolyline = L.polyline(latLngs, {
      color: '#0f766e',
      weight: 5,
      opacity: 0.85
    }).addTo(map);

    map.fitBounds(state._routePolyline.getBounds(), { padding: [30, 30] });
  } else {
    map.fitBounds(L.featureGroup([startMarker, destMarker]).getBounds(), { padding: [40, 40] });
  }
}

function initRouteMap() {
  calculateAndRenderRoute();
}

function setTravelMode(mode) {
  state.selectedTravelMode = mode;
  const container = document.getElementById('screen-trip');
  if (container) {
    container.innerHTML = renderTripScreen().replace(/<div id="screen-trip" class="screen">/g, '').replace(/<\/div>$/g, '');
  }
  calculateAndRenderRoute();
}

function navigatePlace(placeId) {
  const place = getPlaceById(placeId);
  if (place) {
    state.selectedDestination = {
      id: place.id,
      name: place.name,
      lat: place.latitude,
      lng: place.longitude,
      category: place.category
    };
  }
  showScreen('trip');
  setTimeout(() => calculateAndRenderRoute(), 100);
}

function selectAlternativeRoute(idx) {
  if (state.activeRoute && state.activeRoute.alternatives && state.activeRoute.alternatives[idx]) {
    const alt = state.activeRoute.alternatives[idx];
    const latLngs = alt.geometry.map(([lng, lat]) => [lat, lng]);
    if (state._routePolyline && state.maps.route) {
      state._routePolyline.setLatLngs(latLngs);
      state.maps.route.fitBounds(state._routePolyline.getBounds(), { padding: [30, 30] });
    }
    state.activeRoute.distance_km = alt.distance_km;
    state.activeRoute.estimated_duration_minutes = alt.estimated_duration_minutes;
    const infoPanel = document.getElementById('route-info-panel');
    if (infoPanel) infoPanel.innerHTML = renderRouteInfoPanelHtml();
  }
}

function centerMyLocation() {
  if (state.userCoords && state.maps.route) {
    state.maps.route.setView([state.userCoords.lat, state.userCoords.lng], 14);
  } else {
    alert('Your current GPS location is unavailable. Please enable location services.');
  }
}

function fitRouteBounds() {
  if (state._routePolyline && state.maps.route) {
    state.maps.route.fitBounds(state._routePolyline.getBounds(), { padding: [30, 30] });
  } else if (state._routeMarkers && state._routeMarkers.length && state.maps.route) {
    state.maps.route.fitBounds(L.featureGroup(state._routeMarkers).getBounds(), { padding: [40, 40] });
  }
}

function toggleRiskAlert() {
  state.riskAlertVisible = !state.riskAlertVisible;
  document.getElementById('risk-alert')?.classList.toggle('hidden', !state.riskAlertVisible);
}

function rerouteSafe() {
  alert(t('trip.rerouted'));
  state.riskAlertVisible = false;
  document.getElementById('risk-alert')?.classList.add('hidden');
}

// ==========================================
// SOS SCREEN
// ==========================================
function renderSOSScreen() {
  return `
    <div id="screen-sos" class="screen" style="text-align:center;">
      <div>
        <h2 style="font-size:var(--text-xl);font-weight:900;color:var(--color-danger);" data-i18n="sos.title">${t('sos.title')}</h2>
        <p style="font-size:var(--text-base);color:var(--color-text-tertiary);" data-i18n="sos.subtitle">${t('sos.subtitle')}</p>
      </div>

      <div style="display:flex;flex-direction:column;align-items:center;padding:var(--space-4) 0;">
        <div class="sos-ring" id="sos-ring">
          <button class="sos-button" id="sos-btn"
            onmousedown="window.tourix.startSOSHold()"
            onmouseup="window.tourix.cancelSOSHold()"
            ontouchstart="window.tourix.startSOSHold()"
            ontouchend="window.tourix.cancelSOSHold()">
            <i class="fa-solid fa-hand-holding-hand"></i>
            <span id="sos-btn-text">${t('sos.holdToActivate')}<br>${t('sos.holdSeconds')}</span>
          </button>
        </div>
        <p style="font-size:var(--text-base);color:var(--color-text-tertiary);margin-top:var(--space-3);font-weight:500;" data-i18n="sos.holdInstruction">${t('sos.holdInstruction')}</p>
      </div>

      <!-- Emergency Active Panel -->
      <div id="sos-active-panel" class="card card--danger hidden" style="text-align:left;border-color:#fca5a5;">
        <div style="display:flex;align-items:center;gap:var(--space-2);color:var(--color-danger);font-weight:700;font-size:var(--text-base);">
          <i class="fa-solid fa-tower-broadcast"></i>
          <span data-i18n="sos.emergencyActive">${t('sos.emergencyActive')}</span>
        </div>
        <p style="font-size:var(--text-sm);color:var(--color-text-secondary);" data-i18n="sos.emergencyDesc">${t('sos.emergencyDesc')}</p>
        <button class="btn btn--secondary btn--sm" onclick="window.tourix.deactivateSOS()">
          ${t('sos.cancelEmergency')}
        </button>
      </div>

      <!-- Helplines -->
      <div style="text-align:left;">
        <h4 style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--color-text-tertiary);margin-bottom:var(--space-2);" data-i18n="sos.helplines">${t('sos.helplines')}</h4>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">
          ${CONFIG.emergencyHelplines.map(h => `
            <div class="helpline-row">
              <span class="helpline-row__name">${t('sos.' + h.id) || h.name}</span>
              <a href="tel:${h.number}" class="helpline-row__number">${h.number}</a>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

async function dispatchSOSAlert() {
  let location = state.userCoords;
  if (navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 15000,
        });
      });
      location = { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (error) {
      if (!location) {
        alert('Current location is unavailable. Call 112 directly and share your location.');
        return;
      }
    }
  }

  if (!location) {
    alert('Current location is unavailable. Call 112 directly and share your location.');
    return;
  }

  let batteryLevel = null;
  try {
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      batteryLevel = Math.round(battery.level * 100);
    }
  } catch (error) {
    console.warn('Battery status unavailable:', error);
  }

  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/emergency/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: state.user.touristId,
        user_name: state.user.name || 'Tourist',
        emergency_contact: state.user.emergencyContact || null,
        latitude: location.lat,
        longitude: location.lng,
        battery_level: batteryLevel,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'SOS request failed');

    if (result.dispatch?.notifications_sent > 0) {
      alert(`SOS ${result.alert_id}: notification sent. Call 112 if immediate help is needed.`);
    } else {
      alert(`SOS ${result.alert_id} was recorded, but no notification provider is configured. Call 112 now.`);
    }
  } catch (error) {
    console.error('Backend SOS dispatch failed:', error);
    alert('SOS could not be confirmed by the server. Call 112 directly now.');
  }
}

function startSOSHold() {
  const btnText = document.getElementById('sos-btn-text');
  const ring = document.getElementById('sos-ring');
  ring.classList.add('pulsing');
  state.sosSec = 3;
  btnText.innerHTML = `${t('sos.holding')}<br>${state.sosSec}`;

  state.sosTimer = setInterval(() => {
    state.sosSec--;
    if (state.sosSec > 0) {
      btnText.innerHTML = `${t('sos.holding')}<br>${state.sosSec}`;
    } else {
      clearInterval(state.sosTimer);
      state.sosActive = true;
      document.getElementById('sos-active-panel')?.classList.remove('hidden');

      dispatchSOSAlert();
    }
  }, 1000);
}

function cancelSOSHold() {
  if (state.sosTimer) clearInterval(state.sosTimer);
  document.getElementById('sos-ring')?.classList.remove('pulsing');
  document.getElementById('sos-btn-text').innerHTML = `${t('sos.holdToActivate')}<br>${t('sos.holdSeconds')}`;
}

function deactivateSOS() {
  state.sosActive = false;
  document.getElementById('sos-active-panel')?.classList.add('hidden');
  cancelSOSHold();
}

// ==========================================
// PROFILE SCREEN
// ==========================================
function renderProfileScreen() {
  const name = state.user.name || 'Tourist';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const touristId = state.user.touristId || 'TX-8921-NSK';
  const phoneDisplay = state.user.phone || state.user.emergencyContact || '+91 98765 43210';

  return `
    <div id="screen-profile" class="screen">
      <div>
        <h2 style="font-size:var(--text-xl);font-weight:800;" data-i18n="profile.title">${t('profile.title')}</h2>
        <p style="font-size:var(--text-base);color:var(--color-text-tertiary);" data-i18n="profile.subtitle">${t('profile.subtitle')}</p>
      </div>

      <!-- Tourist ID Card -->
      <div class="tourist-id">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4);position:relative;z-index:2;">
          <span style="font-size:9px;font-weight:900;letter-spacing:0.1em;color:rgba(255,255,255,0.6);" data-i18n="profile.digitalId">${t('profile.digitalId')}</span>
          <span style="font-size:9px;font-weight:700;background:rgba(255,255,255,0.2);padding:3px 8px;border-radius:var(--radius-full);" data-i18n="profile.verified">${t('profile.verified')}</span>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3);position:relative;z-index:2;">
          <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--text-lg);" id="profile-avatar">
            ${initials}
          </div>
          <div>
            <h3 style="font-weight:700;font-size:var(--text-md);" id="profile-name">${name}</h3>
            <p style="font-size:var(--text-base);color:rgba(255,255,255,0.7);">ID: ${touristId}</p>
            <p style="font-size:var(--text-xs);color:rgba(255,255,255,0.5);">Indian National • Safety-Aware</p>
          </div>
        </div>
        <div style="margin-top:var(--space-4);padding-top:var(--space-3);border-top:1px solid rgba(255,255,255,0.15);display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2;">
          <div>
            <span style="font-size:8px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5);display:block;">${t('profile.emergencyContact')}</span>
            <span style="font-size:var(--text-base);font-weight:600;">${phoneDisplay}</span>
          </div>
          <div style="width:40px;height:40px;background:white;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--color-text-primary);font-size:20px;">
            <i class="fa-solid fa-qrcode"></i>
          </div>
        </div>
      </div>

      <!-- Offline Pack -->
      <div class="card card--safety" style="border-color:#a7f3d0;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <i class="fa-solid fa-cloud-arrow-down" style="color:var(--color-safe);font-size:16px;"></i>
          <div>
            <div style="font-weight:700;font-size:var(--text-md);color:var(--color-safe-dark);" data-i18n="profile.offlinePack">${t('profile.offlinePack')}</div>
            <div style="font-size:var(--text-xs);color:var(--color-safe);" data-i18n="profile.offlineDesc">${t('profile.offlineDesc')}</div>
          </div>
        </div>
        <span class="badge badge--safe" style="font-weight:700;" data-i18n="profile.ready">${t('profile.ready')}</span>
      </div>

      <!-- Menu Items -->
      <div class="card" style="padding:0;">
        ${[
          { icon: 'fa-user-pen', label: t('profile.editProfile') },
          { icon: 'fa-clock-rotate-left', label: t('profile.tripHistory') },
          { icon: 'fa-phone', label: t('profile.emergencyContacts') },
          { icon: 'fa-globe', label: t('profile.language') },
          { icon: 'fa-lock', label: t('profile.privacy') },
          { icon: 'fa-circle-info', label: t('profile.about') },
        ].map(item => `
          <div class="member-row" style="border-bottom:1px solid var(--color-border-light);cursor:pointer;">
            <div style="display:flex;align-items:center;gap:var(--space-3);">
              <i class="fa-solid ${item.icon}" style="color:var(--color-text-tertiary);width:16px;text-align:center;"></i>
              <span style="font-weight:600;font-size:var(--text-md);color:var(--color-text-primary);">${item.label}</span>
            </div>
            <i class="fa-solid fa-chevron-right" style="font-size:10px;color:var(--color-text-tertiary);"></i>
          </div>
        `).join('')}
        <div class="member-row" style="cursor:pointer;" onclick="window.tourix.showScreen('auth')">
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <i class="fa-solid fa-right-from-bracket" style="color:var(--color-danger);width:16px;text-align:center;"></i>
            <span style="font-weight:600;font-size:var(--text-md);color:var(--color-danger);" data-i18n="profile.logout">${t('profile.logout')}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// AI CHAT MODAL (Personalized Travel Companion)
// ==========================================
function renderAIChatModal() {
  const userName = state.user.name || 'Traveler';
  const lang = getLang();
  const greetingText = lang === 'hi'
    ? `नमस्ते ${userName}! मैं टूरिक्स एआई हूँ। आपके व्यक्तिगत सफर और सुरक्षा के लिए मैं यहाँ हूँ। आप नाशिक के किसी भी पर्यटन स्थल, स्वादिष्ट खाने, वाइनयार्ड्स या सुरक्षित रूट के बारे में पूछ सकते हैं!`
    : (lang === 'mr'
      ? `नमस्कार ${userName}! मी तुमचा टूरिक्स एआय मार्गदर्शक आहे. नाशिकचे प्रसिद्ध आकर्षण, चवदार खाद्यसंस्कृती, वाइनरी किंवा सुरक्षित मार्गाबद्दल मला काहीही विचारा!`
      : `Hello ${userName}! I am Tourix, your personalized Nashik travel & safety assistant. Ask me about custom itineraries, famous food, vineyard tours, or safe routes!`);

  return `
    <div id="ai-modal" class="modal-backdrop">
      <div class="modal-sheet" style="height:88%;display:flex;flex-direction:column;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--color-border-light);z-index:10;background:var(--color-surface);">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg, var(--color-primary), #6366f1);color:white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(99,102,241,0.3);">
              <i class="fa-solid fa-sparkles"></i>
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:6px;">
                <h3 style="font-weight:800;font-size:var(--text-base);color:var(--color-text-primary);" data-i18n="ai.title">${t('ai.title')}</h3>
                <span class="badge badge--safe" style="font-size:9px;padding:2px 6px;">
                  <i class="fa-solid fa-circle" style="font-size:5px;margin-right:3px;"></i>
                  Personalized AI
                </span>
              </div>
              <p style="font-size:11px;color:var(--color-text-tertiary);" id="ai-user-profile-sub">
                Traveler: <b style="color:var(--color-primary);">${userName}</b> • ${state.user.pace || 'balanced'} pace
              </p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn btn--sm" style="padding:4px 8px;font-size:11px;background:var(--color-bg-secondary);border:1px solid var(--color-border);color:var(--color-text-secondary);" onclick="window.tourix.clearChat()" title="Clear chat history">
              <i class="fa-solid fa-rotate-right" style="margin-right:3px;"></i> Reset
            </button>
            <button style="color:var(--color-text-tertiary);font-size:18px;padding:4px 8px;border-radius:50%;" onclick="window.tourix.closeAI()">✕</button>
          </div>
        </div>

        <!-- Messages Container -->
        <div id="ai-chat-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;background:var(--color-bg-secondary);">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg, var(--color-primary), #6366f1);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:2px;">
              <i class="fa-solid fa-compass"></i>
            </div>
            <div class="card" style="max-width:85%;font-size:var(--text-base);color:var(--color-text);line-height:1.6;border-radius:var(--radius-xl) var(--radius-xl) var(--radius-xl) 4px;padding:12px 14px;box-shadow:var(--shadow-sm);" id="ai-welcome-bubble">
              ${greetingText}
            </div>
          </div>
        </div>

        <!-- Personalized Quick Prompts -->
        <div id="ai-quick-prompts-bar" style="padding:8px 12px;background:var(--color-surface);border-top:1px solid var(--color-border-light);display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <!-- Dynamically populated based on user's interests in openAI() -->
        </div>

        <!-- Input Box -->
        <div style="padding:10px 14px;background:var(--color-surface);display:flex;align-items:center;gap:8px;border-top:1px solid var(--color-border-light);">
          <input type="text" id="ai-chat-input" class="search-bar__input" style="border-radius:var(--radius-full);flex:1;padding:10px 16px;font-size:13px;"
            placeholder="${t('ai.inputPlaceholder')}"
            onkeypress="if(event.key==='Enter')window.tourix.sendChat()" />
          <button style="width:42px;height:42px;border-radius:50%;background:var(--color-primary);color:white;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-primary);flex-shrink:0;transition:transform 0.15s ease;"
            onclick="window.tourix.sendChat()" title="Send message">
            <i class="fa-solid fa-paper-plane" style="font-size:14px;"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function openAI() {
  const modal = document.getElementById('ai-modal');
  if (modal) {
    modal.classList.add('active');

    // Update greeting and user subtitle with latest user profile
    const userName = state.user.name || 'Traveler';
    const subEl = document.getElementById('ai-user-profile-sub');
    if (subEl) {
      subEl.innerHTML = `Traveler: <b style="color:var(--color-primary);">${userName}</b> • ${state.user.pace || 'balanced'} pace`;
    }

    // Refresh personalized quick prompts based on interests
    renderPersonalizedQuickPrompts();

    // Focus input
    setTimeout(() => {
      document.getElementById('ai-chat-input')?.focus();
    }, 200);
  }
}

function closeAI() {
  document.getElementById('ai-modal')?.classList.remove('active');
}

function clearChat() {
  state.chatHistory = [];
  const msgBox = document.getElementById('ai-chat-messages');
  if (!msgBox) return;

  const userName = state.user.name || 'Traveler';
  const lang = getLang();
  const greetingText = lang === 'hi'
    ? `नमस्ते ${userName}! चैट रीसेट हो गई है। मैं आपकी अगली यात्रा की योजना बनाने के लिए तैयार हूँ!`
    : (lang === 'mr'
      ? `नमस्कार ${userName}! गप्पा रीसेट झाल्या आहेत. नवीन प्लॅनसाठी मला विचारा!`
      : `Hello ${userName}! Conversation reset. How can I assist with your Nashik plans today?`);

  msgBox.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg, var(--color-primary), #6366f1);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:2px;">
        <i class="fa-solid fa-compass"></i>
      </div>
      <div class="card" style="max-width:85%;font-size:var(--text-base);color:var(--color-text);line-height:1.6;border-radius:var(--radius-xl) var(--radius-xl) var(--radius-xl) 4px;padding:12px 14px;box-shadow:var(--shadow-sm);">
        ${greetingText}
      </div>
    </div>
  `;
}

function renderPersonalizedQuickPrompts() {
  const bar = document.getElementById('ai-quick-prompts-bar');
  if (!bar) return;

  const interests = state.user.interests || [];
  const prompts = [];

  // Tailored chips based on user interests
  if (interests.includes('Vineyards')) {
    prompts.push({ label: '🍷 Best Vineyard Tours & Sunset', text: 'Recommend the best vineyard tasting and sunset spots in Nashik.' });
  }
  if (interests.includes('Food')) {
    prompts.push({ label: '🍛 Authentic Misal Pav & Sweets', text: 'What are the top authentic local Misal Pav and street food places?' });
  }
  if (interests.includes('Adventure')) {
    prompts.push({ label: '🧗 Safe Trekking Routes', text: 'Which forts and treks are safe to visit right now?' });
  }
  if (interests.includes('Spiritual')) {
    prompts.push({ label: '🛕 Trimbakeshwar Darshan Tips', text: 'How to plan Trimbakeshwar Jyotirlinga darshan with least queue?' });
  }
  if (interests.includes('Heritage')) {
    prompts.push({ label: '🏛️ Panchavati & Cave Heritage', text: 'Tell me about the history of Panchavati and Pandavleni Caves.' });
  }

  // Common fallbacks to ensure at least 4 prompt chips always appear
  prompts.push({ label: '⏱️ 4-Hour Budget Plan', text: 'I have 4 hours and ₹2000 budget in Nashik. Plan my trip.' });
  prompts.push({ label: '🛡️ Safety & Helplines', text: 'What are the official emergency safety numbers and safe travel tips?' });
  prompts.push({ label: '🌅 Romantic Couple Spots', text: 'Suggest top romantic scenic spots for couples in Nashik.' });

  bar.innerHTML = prompts.slice(0, 5).map(p => `
    <button class="filter-chip" style="white-space:nowrap;font-size:11px;padding:5px 11px;" onclick="window.tourix.sendChat('${p.text.replace(/'/g, "\\'")}')">
      ${p.label}
    </button>
  `).join('');
}

async function sendChat(quickText = null) {
  const input = document.getElementById('ai-chat-input');
  const msgBox = document.getElementById('ai-chat-messages');
  const userMsg = quickText || input?.value?.trim();
  if (!userMsg) return;

  const userName = state.user.name || 'Traveler';

  // Add User Bubble
  msgBox.innerHTML += `
    <div style="display:flex;justify-content:flex-end;">
      <div style="background:var(--color-primary);color:white;border-radius:var(--radius-xl) var(--radius-xl) 4px var(--radius-xl);padding:10px 14px;max-width:85%;font-size:var(--text-base);line-height:1.5;box-shadow:var(--shadow-sm);">
        ${userMsg}
      </div>
    </div>
  `;
  if (input) input.value = '';
  msgBox.scrollTop = msgBox.scrollHeight;

  // Add Typing Indicator
  const typingId = 'typing-' + Date.now();
  msgBox.innerHTML += `
    <div id="${typingId}" style="display:flex;align-items:flex-start;gap:10px;">
      <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg, var(--color-primary), #6366f1);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:2px;">
        <i class="fa-solid fa-robot fa-bounce"></i>
      </div>
      <div class="card" style="max-width:85%;font-size:var(--text-base);color:var(--color-text-tertiary);font-style:italic;border-radius:var(--radius-xl) var(--radius-xl) var(--radius-xl) 4px;padding:10px 14px;">
        ${t('ai.searching')}
      </div>
    </div>
  `;
  msgBox.scrollTop = msgBox.scrollHeight;

  // Track in local state history
  state.chatHistory.push({ role: 'user', content: userMsg });

  const payload = {
    message: userMsg,
    user: {
      name: userName,
      role: state.user.role || 'tourist',
      interests: state.user.interests && state.user.interests.length ? state.user.interests : ['Heritage', 'Food'],
      pace: state.user.pace || 'balanced',
      location: state.userCoords || CONFIG.defaultCenter
    },
    language: getLang(),
    history: state.chatHistory.slice(-6)
  };

  let replyText = '';

  try {
    const res = await fetch(`${CONFIG.apiUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      replyText = data.reply || '';
    } else {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn('Backend chat fetch issue, using instant client-side AI engine:', err);
    // Instant zero-fail client-side personalized fallback
    replyText = getClientPersonalizedReply(userMsg, payload.user, payload.language);
  }

  // Remove typing indicator
  document.getElementById(typingId)?.remove();

  state.chatHistory.push({ role: 'assistant', content: replyText });

  // Format reply: bold, bullets, paragraphs
  const formattedReply = replyText
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\n\s*-\s*/g, '<br>• ')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  msgBox.innerHTML += `
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg, var(--color-primary), #6366f1);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:2px;">
        <i class="fa-solid fa-compass"></i>
      </div>
      <div class="card" style="max-width:85%;font-size:var(--text-base);color:var(--color-text);line-height:1.6;border-radius:var(--radius-xl) var(--radius-xl) var(--radius-xl) 4px;padding:12px 14px;box-shadow:var(--shadow-sm);">
        ${formattedReply}
      </div>
    </div>
  `;
  msgBox.scrollTop = msgBox.scrollHeight;
}

function getClientPersonalizedReply(query, user, lang) {
  const q = (query || '').toLowerCase();
  const name = user.name || 'Traveler';
  const interests = (user.interests || []).join(', ') || 'Sightseeing';

  if (lang === 'mr') {
    if (q.includes('wine') || q.includes('sula') || q.includes('वाइन')) {
      return `नमस्कार ${name}! **सुला व्हाइनयार्ड्स** आणि **यॉर्क वाइनरी** सर्वोत्तम पर्याय आहेत. गंगापूर धरणाजवळ सूर्यास्त पाहताना वाइन टेस्टिंगचा आनंद घ्या.`;
    }
    if (q.includes('misal') || q.includes('food') || q.includes('मिसळ')) {
      return `${name}, नाशिकची प्रसिद्ध **साधना चूलिवरची मिसळ** आणि **सायंतराची जिलेबी** नक्की ट्राय करा!`;
    }
    if (q.includes('trimbak') || q.includes('ज्योतिर्लिंग')) {
      return `नमस्कार ${name}! **त्र्यंबकेश्वर ज्योतिर्लिंग** दर्शनासाठी सकाळी ६:०० ते ८:३० ही सर्वोत्तम वेळ आहे.`;
    }
    return `नमस्कार ${name}! तुमच्या **${interests}** आवडीनुसार त्र्यंबकेश्वर, सुला वाइनयार्ड्स आणि पांडवलेणी ही उत्तम ठिकाणे आहेत. आणखी काही विचारू शकता!`;
  }

  if (lang === 'hi') {
    if (q.includes('wine') || q.includes('sula') || q.includes('वाइन')) {
      return `नमस्ते ${name}! नाशिक में **सुला वाइनयार्ड्स** और **यॉर्क वाइनरी** वाइन टेस्टिंग और सूर्यास्त के लिए सबसे खूबसूरत जगहें हैं।`;
    }
    if (q.includes('misal') || q.includes('food') || q.includes('खाना')) {
      return `${name}, नाशिक की मशहूर **साधना चूलिवरची मिसल** और भद्रकाली की **सायंतरा की जलेबी-रबड़ी** जरूर चखें!`;
    }
    if (q.includes('trimbak') || q.includes('ज्योतिर्लिंग')) {
      return `नमस्ते ${name}! **त्र्यंबकेश्वर ज्योतिर्लिंग** में सुबह ६:०० से ८:३० बजे दर्शन के लिए सबसे सुगम समय है।`;
    }
    return `नमस्ते ${name}! आपकी **${interests}** पसंद के अनुसार नाशिक के सबसे बेहतरीन और सुरक्षित स्थलों की जानकारी के लिए मैं तैयार हूँ। क्या पूछना चाहते हैं?`;
  }

  // English
  if (q.includes('wine') || q.includes('sula') || q.includes('york')) {
    return `Hello ${name}! As India's Wine Capital, Nashik is famous for **Sula Vineyards** and **York Winery**. Since you enjoy **${interests}**, York offers stunning lakefront sunset views over Gangapur Dam backwaters, while Sula offers guided winery tours and tasting sessions. Best visited between 11:30 AM and 4:30 PM.`;
  }
  if (q.includes('food') || q.includes('misal') || q.includes('eat') || q.includes('restaurant')) {
    return `${name}, Nashik's food scene is unforgettable! Try **Sadhana Chulivarchi Misal** near Gangapur for clay-pot cooked misal, or **Shamsundar Misal** in Satpur. For dessert, do not miss **Sayantara's hot Jalebi with cold Rabdi** near Bhadrakali!`;
  }
  if (q.includes('trimbak') || q.includes('jyotirling') || q.includes('temple')) {
    return `Namaste ${name}! **Trimbakeshwar Jyotirlinga** is 28 km from central Nashik at the base of Brahmagiri hills. Pro tip: visit early between 06:00 AM and 08:30 AM for the smoothest darshan experience. Traditional attire is recommended for the inner sanctum.`;
  }
  if (q.includes('trek') || q.includes('harihar') || q.includes('adventure') || q.includes('fort')) {
    return `For outdoor adventure, ${name}, **Harihar Fort** is famous for its thrilling 80° rock-cut staircase (recommended for fit hikers, strictly daylight hours). For a scenic family/beginner hike, **Pandavleni Caves** (250 steps) or **Anjaneri Hill** are fantastic choices!`;
  }
  if (q.includes('safe') || q.includes('emergency') || q.includes('police')) {
    return `Your safety is our top priority, ${name}! Emergency contacts: Nashik Police Control: **100 / 112**, Women Safety Helpline: **1091**, Disaster Response: **1077**. Use TOURIX Group Live Radar to monitor your companions within 300m safety radius.`;
  }
  return `Hello ${name}! Customized for your **${interests}** preferences at a **${user.pace || 'balanced'}** pace: Top highlights include Trimbakeshwar Jyotirlinga, Panchavati Ramkund, Sula Vineyards, and Pandavleni Caves. Ask me about routes, food, or safe trip planning!`;
}

// ==========================================
// BOTTOM NAVIGATION
// ==========================================
function renderBottomNav() {
  return `
    <nav class="bottom-nav" id="bottom-nav">
      <button class="bottom-nav__item active" id="nav-home" onclick="window.tourix.showScreen('home')">
        <i class="fa-solid fa-house"></i>
        <span data-i18n="nav.home">${t('nav.home')}</span>
      </button>
      <button class="bottom-nav__item" id="nav-group" onclick="window.tourix.showScreen('group')">
        <i class="fa-solid fa-user-group"></i>
        <span data-i18n="nav.group">${t('nav.group')}</span>
      </button>
      <button class="bottom-nav__item bottom-nav__item--sos" id="nav-sos" onclick="window.tourix.showScreen('sos')">
        <div class="bottom-nav__sos-ring">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <span class="bottom-nav__sos-label" data-i18n="nav.sos">${t('nav.sos')}</span>
      </button>
      <button class="bottom-nav__item" id="nav-trip" onclick="window.tourix.showScreen('trip')">
        <i class="fa-solid fa-diamond-turn-right"></i>
        <span data-i18n="nav.trip">${t('nav.trip')}</span>
      </button>
      <button class="bottom-nav__item" id="nav-profile" onclick="window.tourix.showScreen('profile')">
        <i class="fa-solid fa-id-card"></i>
        <span data-i18n="nav.profile">${t('nav.profile')}</span>
      </button>
    </nav>
  `;
}

// ==========================================
// DEMO MODE
// ==========================================
function runDemo() {
  alert(t('demo.demoAlert') + '\n' + t('demo.demoAlertDesc'));
  showScreen('trip');
  setTimeout(() => {
    state.riskAlertVisible = true;
    document.getElementById('risk-alert')?.classList.remove('hidden');
  }, 1200);
  setTimeout(() => {
    showScreen('group');
    if (!state.groupSeparated) toggleGroupSeparation();
  }, 3200);
}

// ==========================================
// UPGRADED MODALS & HELPERS
// ==========================================
function renderFormGroupModal() {
  if (!state.formGroupModalOpen) return '';

  const masterKeys = Object.keys(DEMO_MEMBERS_MASTER);
  const currentMembers = state.activeGroup ? state.activeGroup.members : [];

  return `
    <div id="form-group-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div class="card" style="width:100%;max-width:400px;padding:20px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);max-height:90vh;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="font-size:18px;font-weight:800;color:#0f172a;">+ Form New Tour Group</h3>
          <button style="border:none;background:none;font-size:18px;cursor:pointer;color:#64748b;" onclick="window.tourix.closeFormGroupModal()">✕</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding-right:4px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Group Name</label>
            <input type="text" id="fg-name" class="form-input" value="${state.activeGroup ? state.activeGroup.name : 'Tourix Demo Group'}" placeholder="Enter group name" />
          </div>

          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Add Member ID (e.g. ANUJ001, ADITI002)</label>
            <div style="display:flex;gap:6px;">
              <input type="text" id="fg-member-id" class="form-input" placeholder="e.g. OMKAR003" style="text-transform:uppercase;" />
              <button class="btn btn--primary btn--sm" onclick="window.tourix.addMemberToFormGroup()">Add</button>
            </div>
          </div>

          <button class="btn btn--secondary btn--sm" onclick="window.tourix.seedAllDemoMembers()" style="font-size:11px;background:#f0fdf4;color:#15803d;border:1px solid #a7f3d0;">
            <i class="fa-solid fa-users-medical"></i> Add All 6 Demo Members (ANUJ001 - MAVERICK006)
          </button>

          <label style="font-size:11px;font-weight:700;color:#475569;margin-top:6px;display:block;">Group Members (${currentMembers.length})</label>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;background:#f8fafc;padding:8px;border-radius:8px;">
            ${currentMembers.map(id => {
              const profile = DEMO_MEMBERS_MASTER[id] || { name: id, id };
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px;background:#fff;border-radius:6px;border:1px solid #e2e8f0;font-size:12px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <img src="${profile.photo || `https://ui-avatars.com/api/?name=${id}`}" style="width:24px;height:24px;border-radius:50%;" />
                    <span><strong>${profile.name}</strong> (${id})</span>
                  </div>
                  ${id !== 'ANUJ001' ? `<button style="border:none;background:none;color:#dc2626;cursor:pointer;font-size:14px;" onclick="window.tourix.removeMemberFromFormGroup('${id}')">✕</button>` : '<span style="font-size:10px;color:#0f766e;font-weight:700;">(Owner)</span>'}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="btn btn--success btn--full" onclick="window.tourix.confirmCreateGroup()">
            Create Tour Group
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderMemberProfileModal() {
  const member = state.memberProfileModalUser;
  if (!member) return '';

  const memberLocations = locationProvider.getMemberLocations(state.activeGroup ? state.activeGroup.members : []);
  const anchor = memberLocations.find(m => m.isYou) || memberLocations[0] || member;
  const dist = haversineMeters(member.lat || 20.0063, member.lng || 73.7910, anchor.lat || 20.0063, anchor.lng || 73.7910);
  const isSeparated = !member.isYou && dist > 10.0;

  return `
    <div id="member-profile-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div class="card" style="width:100%;max-width:340px;padding:20px;text-align:center;position:relative;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
        <button style="position:absolute;top:12px;right:12px;border:none;background:none;font-size:18px;cursor:pointer;color:#64748b;" onclick="window.tourix.closeMemberProfile()">✕</button>
        <img src="${member.photo}" alt="${member.name}" style="width:64px;height:64px;border-radius:50%;border:3px solid ${isSeparated ? '#dc2626' : 'var(--color-primary)'};margin:0 auto 12px;object-fit:cover;" />
        <h3 style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:2px;">${member.name}</h3>
        <div style="font-size:12px;font-weight:700;color:var(--color-primary);margin-bottom:8px;">ID: ${member.id} • ${member.role}</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;text-align:left;background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:12px;">
          <div><strong>Age:</strong> ${member.age}</div>
          <div><strong>Phone:</strong> ${member.phone}</div>
          <div><strong>Status:</strong> ${member.isYou ? '🟢 Active Anchor (You)' : (isSeparated ? `⚠️ Separated (${dist.toFixed(1)}m away)` : '🟢 With Group')}</div>
          <div><strong>City:</strong> ${member.cityName || 'Nashik'}</div>
          <div><strong>Last Updated:</strong> ${member.lastUpdatedSecondsAgo || 2}s ago</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn--primary" style="flex:1;font-size:12px;" onclick="window.tourix.focusMemberOnMap('${member.id}')">
            📍 View on Map
          </button>
          <button class="btn btn--secondary" style="flex:1;font-size:12px;" onclick="window.tourix.closeMemberProfile()">
            Close
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderBookTableModal() {
  if (!state.bookTablePlace) return '';
  const p = state.bookTablePlace;
  return `
    <div id="book-table-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div class="card" style="width:100%;max-width:380px;padding:20px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="font-size:18px;font-weight:800;color:#0f172a;">Reserve a Table</h3>
          <button style="border:none;background:none;font-size:18px;cursor:pointer;color:#64748b;" onclick="window.tourix.closeBookTableModal()">✕</button>
        </div>
        <div style="font-weight:700;font-size:15px;color:var(--color-primary);margin-bottom:4px;">${p.name}</div>
        <div style="font-size:12px;color:var(--color-text-tertiary);margin-bottom:12px;">${p.city || 'Nashik'} • ${p.cuisine || 'Restaurant'}</div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Date</label>
            <input type="date" id="bt-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Time</label>
            <select id="bt-time" class="form-input form-select">
              <option value="12:30 PM">12:30 PM (Lunch)</option>
              <option value="01:30 PM">01:30 PM (Lunch)</option>
              <option value="07:30 PM">07:30 PM (Dinner)</option>
              <option value="08:30 PM">08:30 PM (Dinner)</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Number of Guests</label>
            <input type="number" id="bt-guests" class="form-input" value="${state.activeGroup ? state.activeGroup.members.length : 6}" min="1" max="20" />
          </div>
        </div>

        <div style="margin-top:16px;display:flex;gap:8px;">
          <button class="btn btn--primary btn--full" onclick="window.tourix.confirmBookTable()">
            Confirm Demo Reservation
          </button>
        </div>
      </div>
    </div>
  `;
}

function openFormGroupModal() {
  state.formGroupModalOpen = true;
  document.getElementById('form-group-modal')?.remove();
  const app = document.getElementById('app');
  if (app) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderFormGroupModal();
    app.appendChild(wrapper.firstElementChild);
  }
}

function closeFormGroupModal() {
  state.formGroupModalOpen = false;
  document.getElementById('form-group-modal')?.remove();
}

function addMemberToFormGroup() {
  const input = document.getElementById('fg-member-id');
  const id = input?.value?.trim().toUpperCase();
  if (id && !state.activeGroup.members.includes(id)) {
    state.activeGroup.members.push(id);
    closeFormGroupModal();
    openFormGroupModal();
  }
}

function removeMemberFromFormGroup(id) {
  state.activeGroup.members = state.activeGroup.members.filter(m => m !== id);
  closeFormGroupModal();
  openFormGroupModal();
}

function seedAllDemoMembers() {
  state.activeGroup.members = ['ANUJ001', 'ADITI002', 'OMKAR003', 'HASTI004', 'PALAK005', 'MAVERICK006'];
  closeFormGroupModal();
  openFormGroupModal();
}

function confirmCreateGroup() {
  const nameInput = document.getElementById('fg-name');
  if (nameInput && nameInput.value.trim()) {
    state.activeGroup.name = nameInput.value.trim();
  }
  closeFormGroupModal();
  renderGroupScreen();
  updateGroupMapMarkers();
}

function openMemberProfile(id) {
  const memberLocations = locationProvider.getMemberLocations(state.activeGroup.members);
  const member = memberLocations.find(m => m.id === id) || DEMO_MEMBERS_MASTER[id];
  if (member) {
    state.memberProfileModalUser = member;
    document.getElementById('member-profile-modal')?.remove();
    const app = document.getElementById('app');
    if (app) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderMemberProfileModal();
      app.appendChild(wrapper.firstElementChild);
    }
  }
}

function closeMemberProfile() {
  state.memberProfileModalUser = null;
  document.getElementById('member-profile-modal')?.remove();
}

function selectGroupMember(id) {
  state.selectedMemberId = id;
  updateGroupMembersDisplay();
  focusMemberOnMap(id);
}

function focusMemberOnMap(id) {
  const memberLocations = locationProvider.getMemberLocations(state.activeGroup.members);
  const member = memberLocations.find(m => m.id === id);
  if (member && state.maps.group) {
    state.maps.group.setView([member.lat, member.lng], 17);
    if (state._groupMemberMapMarkers && state._groupMemberMapMarkers[id]) {
      state._groupMemberMapMarkers[id].openPopup();
    }
  }
}

function fitGroupBounds() {
  if (!state.maps.group) {
    initGroupMap();
  }
  if (state.maps.group && state._groupMemberMapMarkers) {
    const markers = Object.values(state._groupMemberMapMarkers);
    if (markers.length) {
      const group = L.featureGroup(markers);
      state.maps.group.fitBounds(group.getBounds(), { padding: [40, 40] });
    } else {
      updateGroupMapMarkers();
      const updatedMarkers = Object.values(state._groupMemberMapMarkers || {});
      if (updatedMarkers.length) {
        const group = L.featureGroup(updatedMarkers);
        state.maps.group.fitBounds(group.getBounds(), { padding: [40, 40] });
      }
    }
  }
}

function changeCity(cityName) {
  state.selectedCity = cityName;
  locationProvider.setCity(cityName);
  if (state.maps.group) {
    state.maps.group.setView([locationProvider.cityCenter.lat, locationProvider.cityCenter.lng], 15);
  }
  updateGroupMapMarkers();
}

function startSimulation() {
  locationProvider.startSimulation();
}

function pauseSimulation() {
  locationProvider.pauseSimulation();
}

function resetSimulation() {
  locationProvider.resetSimulation();
  updateGroupMapMarkers();
}

function openBookTableModal(placeId) {
  const place = getPlaceById(placeId);
  if (place) {
    state.bookTablePlace = place;
    document.getElementById('book-table-modal')?.remove();
    const app = document.getElementById('app');
    if (app) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderBookTableModal();
      app.appendChild(wrapper.firstElementChild);
    }
  }
}

function closeBookTableModal() {
  state.bookTablePlace = null;
  document.getElementById('book-table-modal')?.remove();
}

function confirmBookTable() {
  const date = document.getElementById('bt-date')?.value || 'Today';
  const time = document.getElementById('bt-time')?.value || '7:30 PM';
  const guests = document.getElementById('bt-guests')?.value || '6';
  alert(`🎉 DEMO RESERVATION CONFIRMED!\n\nRestaurant: ${state.bookTablePlace?.name}\nDate: ${date}\nTime: ${time}\nParty: ${guests} Guests\n\n(Demo table booking successful for your group!)`);
  closeBookTableModal();
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000.0;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dphi = (lat2 - lat1) * Math.PI / 180;
  const dlam = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function triggerSeparationAudioAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn('Audio alert cue blocked:', e);
  }
}
