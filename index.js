import React from 'react';
import { registerRootComponent } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, Text, View } from 'react-native';
import './incomingCallBackgroundTask';

const crashErrorUtils = globalThis.ErrorUtils;
let AppComponent = null;
let startupError = null;

function formatCrash(error, source = 'JavaScript') {
  return [
    'Bhumi Social AI startup crash',
    'Source: ' + source,
    'Time: ' + new Date().toISOString(),
    'Error: ' + String(error?.message || error),
    'Stack: ' + String(error?.stack || 'Stack unavailable')
  ].join('\n');
}

function saveCrashReport(report) {
  SecureStore.setItemAsync('bhumi_last_crash_report', report).catch(() => {});
}

// Install the handler BEFORE loading App so module-evaluation errors are captured.
if (crashErrorUtils && typeof crashErrorUtils.setGlobalHandler === 'function') {
  const previousCrashHandler = crashErrorUtils.getGlobalHandler?.();
  crashErrorUtils.setGlobalHandler((error, isFatal) => {
    saveCrashReport(formatCrash(error, isFatal ? 'Fatal JavaScript' : 'JavaScript'));
    if (typeof previousCrashHandler === 'function') {
      previousCrashHandler(error, isFatal);
    } else {
      console.error('Unhandled app error:', error);
    }
  });
}

class StartupErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    saveCrashReport(formatCrash(error, 'React render'));
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#08050D', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
            Bhumi Social AI
          </Text>
          <Text style={{ color: '#FF7788', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            App startup error
          </Text>
          <Text selectable style={{ color: '#E8E2EF', fontSize: 13, lineHeight: 20 }}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
          <Text style={{ color: '#A99DB5', fontSize: 12, marginTop: 16 }}>
            Crash report saved on this device.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

try {
  // Lazy load after the crash handler is installed.
  AppComponent = require('./App').default;
  if (!AppComponent) throw new Error('App component could not be loaded.');
} catch (error) {
  startupError = error;
  saveCrashReport(formatCrash(error, 'App module load'));
}

function Root() {
  if (startupError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#08050D', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
          Bhumi Social AI
        </Text>
        <Text style={{ color: '#FF7788', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          App startup error
        </Text>
        <Text selectable style={{ color: '#E8E2EF', fontSize: 13, lineHeight: 20 }}>
          {String(startupError?.message || startupError)}
        </Text>
        <Text style={{ color: '#A99DB5', fontSize: 12, marginTop: 16 }}>
          Crash report saved on this device.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StartupErrorBoundary>
        <AppComponent />
      </StartupErrorBoundary>
    </GestureHandlerRootView>
  );
}

registerRootComponent(Root);
