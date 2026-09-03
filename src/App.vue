<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isSignedIn, signOut } from '@/lib/auth'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const navRef = ref<HTMLElement | null>(null)
const burgerRef = ref<HTMLButtonElement | null>(null)

// Collapse the mobile menu after navigating.
watch(() => route.fullPath, () => {
  menuOpen.value = false
})

function onPointerDown(e: PointerEvent) {
  const target = e.target as Node | null
  if (target && navRef.value && !navRef.value.contains(target)) {
    menuOpen.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    menuOpen.value = false
    // Escape closed it, so put focus back where the user opened it from.
    burgerRef.value?.focus()
  }
}

// Listeners only exist while the menu is open.
watch(menuOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})

async function onSignOut() {
  // A failed sign-out still leaves a valid token in storage, so send the user to
  // the login screen either way rather than leaving them on a page whose queries
  // are about to start failing.
  try {
    await signOut()
  } finally {
    await router.replace('/login')
  }
}
</script>

<template>
  <!-- Nothing to navigate to while signed out: every route but /login is
       guarded, so the nav would only offer redirects back here. -->
  <nav v-if="isSignedIn" class="app-nav" ref="navRef">
    <button
      ref="burgerRef"
      class="burger"
      :aria-expanded="menuOpen"
      aria-controls="navLinks"
      aria-label="Меню"
      @click="menuOpen = !menuOpen"
    >
      <span class="burger-bar" :class="{ open: menuOpen }"></span>
      <span class="burger-bar" :class="{ open: menuOpen }"></span>
      <span class="burger-bar" :class="{ open: menuOpen }"></span>
    </button>

    <div id="navLinks" class="nav-links" :class="{ open: menuOpen }">
      <router-link to="/">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.09 4.18 2 2 0 0 1 4.08 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
        <span>Рақамлар</span>
      </router-link>
      <router-link to="/stats">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>Статистика</span>
      </router-link>
      <router-link to="/settings">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>Созламалар</span>
      </router-link>
      <button class="signout" type="button" @click="onSignOut">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>Чиқиш</span>
      </button>
    </div>
  </nav>

  <router-view />
</template>

<style scoped>
.app-nav {
  display: flex;
  justify-content: center;
  padding: 12px 0 20px;
  font-size: 14px;
}

/* Segmented-control pill, so the links read as a nav component rather than
   loose text on the page background. Card styling matches .table-wrapper. */
.nav-links {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.nav-links a,
.nav-links .signout {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-weight: 500;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 9px;
  white-space: nowrap;
  transition: 0.15s;
}

/* Sign-out is an action, not a destination, so it is a real <button> styled to
   sit in the same segmented control as the links. */
.nav-links .signout {
  font: inherit;
  font-size: 14px;
  background: none;
  border: none;
  cursor: pointer;
}

.nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Active link keeps its own fill on hover. */
.nav-links a:hover:not(.router-link-active),
.nav-links .signout:hover {
  background: #f3f4f6;
  color: #374151;
}

.nav-links a.router-link-active {
  background: #2563eb;
  color: white;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
}

.burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 0 9px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
}

.burger-bar {
  display: block;
  height: 2px;
  width: 100%;
  background: #374151;
  border-radius: 2px;
  transition: 0.2s;
}

@media (max-width: 600px) {
  /* Lifted out of flow so the burger sits on the same row as the page title,
     which stays centered in its own component. Matches body padding (10px). */
  .app-nav {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 0;
    justify-content: flex-start;
    z-index: 20;
  }

  .burger {
    display: flex;
  }

  /* Bars morph into an X while the menu is open. */
  .burger-bar.open:nth-child(1) {
    transform: translateY(7px) rotate(45deg);
  }

  .burger-bar.open:nth-child(2) {
    opacity: 0;
  }

  .burger-bar.open:nth-child(3) {
    transform: translateY(-7px) rotate(-45deg);
  }

  .nav-links {
    display: none;
    position: absolute;
    top: 48px;
    left: 0;
    z-index: 10;
    flex-direction: column;
    gap: 4px;
    min-width: 180px;
    padding: 6px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  }

  .nav-links.open {
    display: flex;
  }

  .nav-links a,
  .nav-links .signout {
    padding: 10px 12px;
    justify-content: flex-start;
  }
}
</style>
