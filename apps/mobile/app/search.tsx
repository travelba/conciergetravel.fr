import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { searchHotels, type MobileSearchResult } from '@/lib/bff-client';
import { tokens } from '@/lib/theme';

function formatPrice(minor: number): string {
  return `${Math.round(minor / 100).toLocaleString('fr-FR')} €`;
}

type SearchHotel = MobileSearchResult['hotels'][number];

function HotelRow({ item }: { item: SearchHotel }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/hotel/${item.slug}`)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Image source={{ uri: item.heroImage }} style={styles.thumb} />
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.cardMeta}>
          {item.city}, {item.country} · {item.stars}★ · {item.ratingScoreOutOfTen}/10
        </Text>
        {item.distanceLabel !== undefined ? (
          <Text style={styles.cardDistance}>{item.distanceLabel}</Text>
        ) : null}
        <Text style={styles.cardPrice}>À partir de {formatPrice(item.publicPriceMinor)} TTC</Text>
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const query = typeof q === 'string' ? q : '';
  const [result, setResult] = useState<MobileSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (query.trim().length === 0) {
      setError('Saisissez une destination ou un hôtel.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const response = await searchHotels(query);
    if (response.ok) {
      setResult(response.value);
    } else {
      setError('Recherche indisponible pour le moment.');
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.queryLabel}>
        Résultats pour « {query} »
        {result !== null ? ` · ${result.total} hôtel${result.total > 1 ? 's' : ''}` : ''}
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.colorGold} />
        </View>
      ) : null}

      {!loading && error !== null ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      {!loading && error === null && result !== null && result.hotels.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>Aucun hôtel ne correspond à votre recherche.</Text>
        </View>
      ) : null}

      {!loading && result !== null && result.hotels.length > 0 ? (
        <FlatList
          data={result.hotels}
          keyExtractor={(item) => item.slug}
          renderItem={({ item }) => <HotelRow item={item} />}
          contentContainerStyle={styles.list}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colorOffWhite },
  queryLabel: {
    paddingHorizontal: tokens.spaceGutter,
    paddingVertical: tokens.spaceStackMd,
    fontSize: 14,
    color: tokens.colorOnSurfaceVariant,
  },
  list: { paddingHorizontal: tokens.spaceGutter, paddingBottom: tokens.spaceStackXl },
  card: {
    flexDirection: 'row',
    gap: tokens.spaceStackMd,
    padding: tokens.spaceStackMd,
    marginBottom: tokens.spaceStackMd,
    backgroundColor: tokens.colorSurfaceBright,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.colorOutlineVariant,
    minHeight: tokens.touchTarget * 2,
  },
  cardPressed: { opacity: 0.92 },
  thumb: { width: 96, height: 96, borderRadius: tokens.radiusSm },
  cardBody: { flex: 1, justifyContent: 'center', gap: 4 },
  cardName: {
    fontFamily: tokens.fontSerif,
    fontSize: 17,
    color: tokens.colorCharcoal,
  },
  cardMeta: { fontSize: 13, color: tokens.colorOnSurfaceVariant },
  cardDistance: { fontSize: 12, color: tokens.colorOnSurfaceVariant },
  cardPrice: { fontSize: 14, fontWeight: '600', color: tokens.colorCharcoal, marginTop: 4 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spaceGutter,
  },
  error: { fontSize: 16, color: tokens.colorDanger, textAlign: 'center' },
  empty: { fontSize: 16, color: tokens.colorOnSurfaceVariant, textAlign: 'center' },
});
