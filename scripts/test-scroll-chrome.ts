import assert from "node:assert/strict";
import {
  isMeaningfullyScrollable,
  nextHideProgress,
  snapHideProgress,
  TOP_THRESHOLD_PX,
  userScrollDelta,
} from "../lib/scroll-chrome";
import { browserBottomInset, KEYBOARD_THRESHOLD_PX } from "../lib/visual-viewport-gap";

function testShortPageStaysVisible() {
  const nav = 60;
  assert.equal(
    isMeaningfullyScrollable({
      scrollHeight: 800,
      viewportHeight: 800,
      navReservePx: nav,
      paddingRemoved: false,
    }),
    false,
  );
  assert.equal(
    isMeaningfullyScrollable({
      scrollHeight: 850,
      viewportHeight: 800,
      navReservePx: nav,
      paddingRemoved: false,
    }),
    false,
  );
  assert.equal(
    nextHideProgress({
      hide: 0.8,
      deltaY: 40,
      scrollY: 100,
      navHeightPx: nav,
      meaningfullyScrollable: false,
      reducedMotion: false,
    }),
    0,
  );
}

function testScrollFollowsFingerAndSnaps() {
  const nav = 60;
  const down = nextHideProgress({
    hide: 0,
    deltaY: 30,
    scrollY: 80,
    navHeightPx: nav,
    meaningfullyScrollable: true,
    reducedMotion: false,
  });
  assert.equal(down, 0.5);

  assert.equal(
    snapHideProgress({
      hide: down,
      scrollY: 80,
      lastDirection: "down",
      meaningfullyScrollable: true,
    }),
    0,
  );
  assert.equal(
    snapHideProgress({
      hide: 0.75,
      scrollY: 200,
      lastDirection: "down",
      meaningfullyScrollable: true,
    }),
    1,
  );
  assert.equal(
    snapHideProgress({
      hide: 0.9,
      scrollY: 200,
      lastDirection: "up",
      meaningfullyScrollable: true,
    }),
    0,
  );
  assert.equal(
    nextHideProgress({
      hide: 1,
      deltaY: -20,
      scrollY: TOP_THRESHOLD_PX,
      navHeightPx: nav,
      meaningfullyScrollable: true,
      reducedMotion: false,
    }),
    0,
  );
}

function testReducedMotionIsBinary() {
  assert.equal(
    nextHideProgress({
      hide: 0.2,
      deltaY: 8,
      scrollY: 100,
      navHeightPx: 60,
      meaningfullyScrollable: true,
      reducedMotion: true,
    }),
    1,
  );
  assert.equal(
    nextHideProgress({
      hide: 1,
      deltaY: -8,
      scrollY: 100,
      navHeightPx: 60,
      meaningfullyScrollable: true,
      reducedMotion: true,
    }),
    0,
  );
}

function testBrowserInset() {
  assert.equal(
    browserBottomInset({
      innerHeight: 800,
      offsetTop: 0,
      visualHeight: 800 - (KEYBOARD_THRESHOLD_PX + 1),
      scrollY: 0,
      pageCanCollapseToolbar: true,
      isFirefox: true,
      viewportChromePx: 56,
    }),
    0,
  );
  assert.equal(
    browserBottomInset({
      innerHeight: 800,
      offsetTop: 0,
      visualHeight: 740,
      scrollY: 0,
      pageCanCollapseToolbar: true,
      isFirefox: false,
      viewportChromePx: 80,
    }),
    60,
  );
  assert.equal(
    browserBottomInset({
      innerHeight: 800,
      offsetTop: 0,
      visualHeight: 800,
      scrollY: 0,
      pageCanCollapseToolbar: false,
      isFirefox: true,
      viewportChromePx: 56,
    }),
    56,
  );
  assert.equal(
    browserBottomInset({
      innerHeight: 800,
      offsetTop: 0,
      visualHeight: 800,
      scrollY: 16 + 56,
      pageCanCollapseToolbar: true,
      isFirefox: true,
      viewportChromePx: 56,
    }),
    0,
  );
  assert.equal(
    browserBottomInset({
      innerHeight: 800,
      offsetTop: 20,
      visualHeight: 800,
      scrollY: 0,
      pageCanCollapseToolbar: false,
      isFirefox: true,
      viewportChromePx: 70,
    }),
    50,
  );
}

function testLayoutShrinkIsNotScrollUp() {
  assert.equal(
    userScrollDelta({ previousY: 4100, previousMax: 4200, y: 4000, max: 4000 }),
    0,
  );
  assert.equal(
    userScrollDelta({ previousY: 1000, previousMax: 4200, y: 996, max: 4140 }),
    -4,
  );
  assert.equal(
    userScrollDelta({ previousY: 4100, previousMax: 4200, y: 3900, max: 4000 }),
    -100,
  );
  assert.equal(
    userScrollDelta({ previousY: 200, previousMax: 4200, y: 260, max: 4140 }),
    60,
  );
}

testLayoutShrinkIsNotScrollUp();
testShortPageStaysVisible();
testScrollFollowsFingerAndSnaps();
testReducedMotionIsBinary();
testBrowserInset();
console.log("test-scroll-chrome: ok");
