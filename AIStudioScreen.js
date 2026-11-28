import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// First-pass AI Studio feature shell. Keep this intentionally simple;
// visual redesign and provider-backed AI actions are separate follow-up work.
export default function AIStudioScreen({ onBack }) {
  const tools = [
    { title: "AI Assistant", description: "Ask questions and get help", status: "Coming soon" },
    { title: "AI Creator Studio", description: "Create captions, post ideas, and reel scripts", status: "Coming soon" },
    { title: "Translate", description: "Translate text between supported languages", status: "Coming soon" },
    { title: "Voice tools", description: "Voice input and spoken responses", status: "Coming soon" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
        ) : null}
        <View>
          <Text style={styles.eyebrow}>BHUMI SOCIAL AI</Text>
          <Text style={styles.title}>AI Studio</Text>
          <Text style={styles.subtitle}>Your creative and intelligent workspace</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>What would you like to create?</Text>
          <Text style={styles.introText}>AI tools will appear here as they are connected and tested.</Text>
        </View>
        {tools.map((tool) => (
          <View key={tool.title} style={styles.card}>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{tool.title}</Text>
              <Text style={styles.cardDescription}>{tool.description}</Text>
            </View>
            <Text style={styles.status}>{tool.status}</Text>
          </View>
        ))}
        <Text style={styles.note}>No AI provider is connected yet. This screen does not send or store your content.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginRight: 12 },
  backText: { color: "#111827", fontSize: 30, lineHeight: 34, marginTop: -3 },
  eyebrow: { color: "#6B7280", fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: "#111827", fontSize: 26, fontWeight: "700", marginTop: 3 },
  subtitle: { color: "#6B7280", fontSize: 13, marginTop: 4 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  intro: { backgroundColor: "#F8F7FC", borderRadius: 18, padding: 18, marginBottom: 16 },
  introTitle: { color: "#171324", fontSize: 18, fontWeight: "700" },
  introText: { color: "#6B7280", fontSize: 13, lineHeight: 19, marginTop: 7 },
  card: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardCopy: { flex: 1, paddingRight: 10 },
  cardTitle: { color: "#111827", fontSize: 15, fontWeight: "700" },
  cardDescription: { color: "#6B7280", fontSize: 12, lineHeight: 18, marginTop: 5 },
  status: { color: "#6B7280", backgroundColor: "#F3F4F6", overflow: "hidden", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, fontSize: 10, fontWeight: "600" },
  note: { color: "#9CA3AF", fontSize: 11, lineHeight: 16, marginTop: 8 },
});
