/**
 * La racine de l'application : charge les polices et le jeton, puis choisit l'écran. Sans routeur,
 * deux écrans : celui du jeton tant qu'aucun n'est enregistré, celui de la semaine ensuite.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FONT_SOURCES } from "./theme";
import { TokenScreen } from "./TokenScreen";
import { clearToken, readToken } from "./token-vault";
import { WeekScreen } from "./WeekScreen";

export function App() {
  // Les glyphes d'Ionicons sont une police : chargée ici, aucune flèche n'apparaît vide.
  const [fontsLoaded, fontError] = useFonts({
    ...FONT_SOURCES,
    ...Ionicons.font,
  });
  // `undefined` tant que le coffre n'a pas répondu, `null` s'il n'a pas de jeton.
  const [token, setToken] = useState<string | null>();

  useEffect(() => {
    // Un coffre illisible vaut un coffre vide : le jeton se ressaisit.
    readToken().then(setToken, () => setToken(null));
  }, []);

  /** Le serveur a refusé le jeton : il quitte le coffre, et l'écran du jeton revient. */
  function forgetToken() {
    setToken(null);
    // Un effacement manqué laisse l'ancien jeton, que le prochain refus renverra ici et que la
    // saisie suivante remplacera.
    clearToken().catch(() => {});
  }

  // Une police qui ne charge pas laisse place à celle du système, plutôt qu'à un écran vide.
  if ((!fontsLoaded && !fontError) || token === undefined) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {token === null ? (
        <TokenScreen onAccepted={setToken} />
      ) : (
        <WeekScreen token={token} onTokenRejected={forgetToken} />
      )}
    </SafeAreaProvider>
  );
}
