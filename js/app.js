// ── Entry point ──────────────────────────────────────────────
import { initConvex } from './state.js';
import { renderView } from './render.js';
import { bindEvents, loadInitialData } from './events.js';

function init() {
  initConvex();
  bindEvents();
  renderView();
  loadInitialData();
}

init();
