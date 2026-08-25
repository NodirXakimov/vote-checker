<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
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
</script>

<template>
  <nav class="app-nav" ref="navRef">
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
      <router-link to="/settings">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>Созламалар</span>
      </router-link>
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

.nav-links {
  display: flex;
  gap: 16px;
}

.nav-links a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 8px;
  transition: 0.15s;
}

.nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.nav-links a:hover {
  background: #f3f4f6;
  color: #374151;
}

.nav-links a.router-link-active {
  background: #eff6ff;
  color: #2563eb;
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

  .nav-links a {
    padding: 10px 12px;
  }
}
</style>
