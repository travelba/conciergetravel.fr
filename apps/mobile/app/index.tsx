import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { tokens } from '@/lib/theme';

export default function HomeScreen() {
  const [query, setQuery] = useState('');

  const onSearch = () => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    router.push({ pathname: '/search', params: { q: trimmed } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>La sélection du Concierge</Text>
        <Text style={styles.title}>Hôtels d&apos;exception, partout dans le monde</Text>
        <Text style={styles.subtitle}>
          Palaces, Relais &amp; Châteaux, adresses éditoriales — réservés avec votre concierge.
        </Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Destination ou hôtel"
          placeholder="Paris, Le Meurice, Palace…"
          placeholderTextColor={tokens.colorOnSurfaceVariant}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lancer la recherche"
          onPress={onSearch}
          style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}
        >
          <Text style={styles.searchButtonLabel}>Rechercher</Text>
        </Pressable>
      </View>

      <View style={styles.quickLinks}>
        <Text style={styles.quickLinksTitle}>Accès rapide</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/hotel/le-meurice')}
          style={styles.quickLink}
        >
          <Text style={styles.quickLinkText}>Le Meurice — Paris</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/hotel/le-bristol-paris')}
          style={styles.quickLink}
        >
          <Text style={styles.quickLinkText}>Le Bristol Paris</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: tokens.spaceGutter,
    paddingTop: tokens.spaceStackXl,
    backgroundColor: tokens.colorOffWhite,
  },
  hero: {
    marginBottom: tokens.spaceStackXl,
  },
  kicker: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: tokens.colorGold,
    marginBottom: tokens.spaceStackSm,
  },
  title: {
    fontFamily: tokens.fontSerif,
    fontSize: 28,
    lineHeight: 34,
    color: tokens.colorCharcoal,
    marginBottom: tokens.spaceStackMd,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colorOnSurfaceVariant,
  },
  searchRow: {
    gap: tokens.spaceStackMd,
    marginBottom: tokens.spaceStackXl,
  },
  input: {
    minHeight: tokens.searchBarHeight,
    borderWidth: 1,
    borderColor: tokens.colorOutlineVariant,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: tokens.spaceStackMd,
    fontSize: 16,
    color: tokens.colorOnSurface,
    backgroundColor: tokens.colorSurfaceBright,
  },
  searchButton: {
    minHeight: tokens.touchTarget,
    backgroundColor: tokens.colorAction,
    borderRadius: tokens.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonPressed: {
    backgroundColor: tokens.colorActionHover,
  },
  searchButtonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickLinks: {
    gap: tokens.spaceStackSm,
  },
  quickLinksTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colorOnSurfaceVariant,
    marginBottom: tokens.spaceStackSm,
  },
  quickLink: {
    minHeight: tokens.touchTarget,
    justifyContent: 'center',
    paddingVertical: tokens.spaceStackSm,
  },
  quickLinkText: {
    fontSize: 16,
    color: tokens.colorAction,
  },
});
