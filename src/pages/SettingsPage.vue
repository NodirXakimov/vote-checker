<script setup lang="ts">
</script>

<template>
  <div class="page-wrapper">
    <h1>Созламалар</h1>
  </div>
</template>

<style scoped>
.page-wrapper {
  max-width: 900px;
  margin: auto;
}

h1 {
  font-size: 22px;
  text-align: center;
}

@media (max-width: 600px) {
  /* Sits beside the absolutely positioned burger button. */
  h1 {
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 48px;
    font-size: 18px;
  }
}
</style>
