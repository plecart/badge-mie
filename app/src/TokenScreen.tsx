/**
 * L'écran du jeton : au premier lancement, ou après un refus du serveur, on y colle le jeton
 * d'accès, que « Valider » fait vérifier par une lecture de la semaine en cours (issue #3,
 * « Décisions », point 7).
 */

import { mondayOf } from "@badge-mie/week";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { readWeek } from "./api";
import { BUTTON, BUTTON_LABEL, FONTS, usePalette } from "./theme";
import { checkToken, type TokenCheckOutcome } from "./token-check";
import { saveToken } from "./token-vault";
import { today } from "./today";
import { saveWeek } from "./week-store";

/** Le message d'un jeton non accepté, affiché au-dessus du bouton. */
const FAILURES: Record<Exclude<TokenCheckOutcome, "accepted">, string> = {
  rejected: "Jeton refusé",
  unreachable: "Serveur injoignable",
};

/**
 * @param onAccepted - Reçoit le jeton, une fois que le serveur l'a reconnu et que le coffre l'a
 *   gardé.
 */
export function TokenScreen({
  onAccepted,
}: {
  onAccepted: (token: string) => void;
}) {
  const palette = usePalette();
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Un jeton collé traîne parfois un espace ou un saut de ligne, qu'un jeton base64url n'a jamais.
  const token = input.trim();
  const empty = token === "";

  async function validate() {
    setChecking(true);
    setFailure(null);
    try {
      const outcome = await checkToken(token, mondayOf(today()), {
        read: readWeek,
        saveToken,
        saveWeek: (monday, days) => saveWeek(AsyncStorage, monday, days),
      });
      if (outcome === "accepted") onAccepted(token);
      else setFailure(FAILURES[outcome]);
    } finally {
      setChecking(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.bg }]}>
      <Text style={[styles.title, { color: palette.fg }]}>Badge Mie</Text>
      <Text style={[styles.lead, { color: palette.muted }]}>
        Colle le jeton d'accès.
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            color: palette.fg,
            backgroundColor: palette.surface,
            borderColor: palette.line,
          },
        ]}
        value={input}
        onChangeText={setInput}
        secureTextEntry
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Jeton d'accès"
      />
      {failure !== null && (
        <Text style={[styles.failure, { color: palette.danger }]}>
          {failure}
        </Text>
      )}
      <Pressable
        style={[
          BUTTON,
          { backgroundColor: empty ? palette.surface2 : palette.accent },
        ]}
        onPress={validate}
        disabled={empty || checking}
        accessibilityRole="button"
        accessibilityState={{ disabled: empty || checking, busy: checking }}
      >
        <Text
          style={[
            BUTTON_LABEL,
            { color: empty ? palette.muted : palette.accentInk },
          ]}
        >
          {checking ? "Vérification…" : "Valider"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 16 },
  title: { fontFamily: FONTS.textStrong, fontSize: 28, marginTop: 48 },
  lead: { fontFamily: FONTS.text, fontSize: 15 },
  input: {
    fontFamily: FONTS.text,
    fontSize: 16,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  failure: { fontFamily: FONTS.text, fontSize: 14 },
});
