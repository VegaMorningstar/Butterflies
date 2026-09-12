/**
 * A one-bit channel between the loading screen and the course's canvases.
 *
 * The course stays mounted underneath the field once it has been revealed, so
 * that replaying the butterflies does not throw away scroll position or demo
 * state. But its figures each run their own animation loop, and those must not
 * compete with 2,500 butterflies for the frame budget while the field is up.
 *
 * Kept in its own module, rather than in the course's kit, so that App.tsx can
 * set it without pulling the whole lazy-loaded course into the main bundle.
 */

let paused = false;

export function setScenesPaused(value: boolean) {
  paused = value;
}

export function scenesPaused() {
  return paused;
}
