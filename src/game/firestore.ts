import type { FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  type FirestoreSettings,
} from "firebase/firestore";
export function initializeGameFirestore(app: FirebaseApp) {
  // Safari/WebKit can buffer Fetch Streams frames until a keep-alive. Use XHR,
  // matching Hanami, for both production and emulator connections.
  return initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false,
  } as FirestoreSettings & { useFetchStreams: boolean });
}
