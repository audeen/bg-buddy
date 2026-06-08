import assert from "node:assert/strict";
import {
  isSwipeBackCandidate,
  resolveSwipeBackTarget,
} from "../lib/swipe-back";

function testCandidates() {
  assert.equal(isSwipeBackCandidate("/meetups/abc/pick"), true);
  assert.equal(isSwipeBackCandidate("/meetups/abc/duell"), true);
  assert.equal(isSwipeBackCandidate("/meetups/abc/erweiterung"), true);
  assert.equal(isSwipeBackCandidate("/meetups/abc"), true);
  assert.equal(isSwipeBackCandidate("/meetups/new"), true);
  assert.equal(isSwipeBackCandidate("/games/42"), true);
  assert.equal(isSwipeBackCandidate("/admin/collection/7"), true);
  assert.equal(isSwipeBackCandidate("/"), false);
  assert.equal(isSwipeBackCandidate("/games"), false);
  assert.equal(isSwipeBackCandidate("/admin/collection"), false);
}

function testTargets() {
  assert.equal(resolveSwipeBackTarget("/meetups/abc/pick"), "/meetups/abc");
  assert.equal(resolveSwipeBackTarget("/meetups/abc/duell"), "/meetups/abc");
  assert.equal(
    resolveSwipeBackTarget("/meetups/abc/erweiterung"),
    "/meetups/abc",
  );
  assert.equal(resolveSwipeBackTarget("/meetups/new"), "/");
  assert.equal(resolveSwipeBackTarget("/games/42"), "/games");
  assert.equal(
    resolveSwipeBackTarget("/admin/collection/7"),
    "/admin/collection",
  );
  assert.equal(resolveSwipeBackTarget("/games"), null);
}

testCandidates();
testTargets();
console.log("test-swipe-back: ok");
