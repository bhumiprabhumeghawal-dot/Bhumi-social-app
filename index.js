import { registerRootComponent } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import App from './App';


// BHUMI_CRASH_CAPTURE
const crashErrorUtils = globalThis.ErrorUtils;
if (crashErrorUtils && typeof crashErrorUtils.setGlobalHandler === 'function') {
  const previousCrashHandler = crashErrorUtils.getGlobalHandler?.();
  crashErrorUtils.setGlobalHandler((error, isFatal) => {
    const report = [
      'Bhumi Social AI JavaScript crash',
      'Time: ' + new Date().toISOString(),
      'Fatal: ' + String(!!isFatal),
      'Error: ' + String(error?.message || error),
      'Stack: ' + String(error?.stack || 'Stack unavailable')
    ].join('\n');

    let completed = false;
    const finishCrashHandling = () => {
      if (completed) return;
      completed = true;
      if (typeof previousCrashHandler === 'function') {
        previousCrashHandler(error, isFatal);
      } else {
        console.error('Unhandled app error:', report);
      }
    };

    SecureStore.setItemAsync('bhumi_last_crash_report', report)
      .then(finishCrashHandling)
      .catch(finishCrashHandling);

    setTimeout(finishCrashHandling, 1500);
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
function Root() {
  return <GestureHandlerRootView style={{ flex: 1 }}><App /></GestureHandlerRootView>;
}

registerRootComponent(Root);
