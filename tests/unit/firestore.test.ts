import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { initializeGameFirestore } from "../../src/game/firestore.ts";
test("the actual Firestore SDK is initialized with WebKit-safe XHR transport", async () => {
  const app = initializeApp(
    { projectId: "demo-supermega-transport", apiKey: "demo-key" },
    "transport-test",
  );
  try {
    const db = initializeGameFirestore(app);
    // The SDK's effective settings are internal; this regression checks what was
    // actually applied, without opening a connection or mocking the SDK.
    const settings = (
      db as unknown as {
        _getSettings(): {
          useFetchStreams: boolean;
          experimentalAutoDetectLongPolling: boolean;
        };
      }
    )._getSettings();
    assert.equal(settings.useFetchStreams, false);
    assert.equal(settings.experimentalAutoDetectLongPolling, true);
  } finally {
    await deleteApp(app);
  }
});
