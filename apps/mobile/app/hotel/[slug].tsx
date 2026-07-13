import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchHotel, type MobileHotel } from '@/lib/bff-client';
import { tokens } from '@/lib/theme';

function formatPrice(minor: number): string {
  return `${Math.round(minor / 100).toLocaleString('fr-FR')} €`;
}

export default function HotelDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [hotel, setHotel] = useState<MobileHotel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (typeof slug !== 'string' || slug.length === 0) {
      setError('Hôtel introuvable');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await fetchHotel(slug);
    if (result.ok) {
      setHotel(result.value);
    } else {
      setError(
        result.error.kind === 'http' && result.error.status === 404
          ? 'Cet hôtel n’est pas disponible.'
          : 'Impossible de charger la fiche. Réessayez.',
      );
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tokens.colorGold} />
      </View>
    );
  }

  if (error !== null || hotel === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Erreur inconnue'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonLabel}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image
        source={{ uri: hotel.heroImage }}
        style={styles.hero}
        accessibilityLabel={hotel.name}
      />
      <View style={styles.body}>
        <Text style={styles.name}>{hotel.name}</Text>
        <Text style={styles.meta}>
          {hotel.city}, {hotel.country} · {hotel.stars}★ · {hotel.ratingScoreOutOfTen}/10 (
          {hotel.reviewCount.toLocaleString('fr-FR')} avis)
        </Text>
        {hotel.editorialBadge !== undefined ? (
          <Text style={styles.badge}>{hotel.editorialBadge}</Text>
        ) : null}
        {hotel.distanceLabel !== undefined ? (
          <Text style={styles.distance}>{hotel.distanceLabel}</Text>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>À partir de</Text>
          <Text style={styles.price}>{formatPrice(hotel.publicPriceMinor)} TTC</Text>
          {hotel.memberPriceMinor !== undefined ? (
            <Text style={styles.memberPrice}>
              Membre : {formatPrice(hotel.memberPriceMinor)} TTC
            </Text>
          ) : null}
        </View>

        {hotel.highlights.length > 0 ? (
          <View style={styles.highlights}>
            {hotel.highlights.map((h) => (
              <Text key={h} style={styles.highlight}>
                · {h}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.prose}>{hotel.description}</Text>

        <View style={styles.conciergeBlock}>
          <Text style={styles.conciergeTitle}>Le Conseil du Concierge</Text>
          <Text style={styles.conciergeBody}>{hotel.conciergeAdvice}</Text>
        </View>

        {hotel.rooms !== undefined && hotel.rooms.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Chambres</Text>
            {hotel.rooms.map((room) => (
              <View key={room.id} style={styles.roomCard}>
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomMeta}>
                  {room.sizeSqm} m² · {room.bedDescription} · max {room.maxOccupants} pers.
                </Text>
                <Text style={styles.roomPrice}>{formatPrice(room.publicPriceMinor)} TTC</Text>
              </View>
            ))}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colorOffWhite },
  content: { paddingBottom: tokens.spaceStackXl * 2 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spaceGutter,
    backgroundColor: tokens.colorOffWhite,
  },
  hero: { width: '100%', height: 240 },
  body: { padding: tokens.spaceGutter, gap: tokens.spaceStackMd },
  name: {
    fontFamily: tokens.fontSerif,
    fontSize: 26,
    color: tokens.colorCharcoal,
  },
  meta: { fontSize: 14, color: tokens.colorOnSurfaceVariant },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colorGold,
    textTransform: 'uppercase',
  },
  distance: { fontSize: 14, color: tokens.colorOnSurfaceVariant },
  priceRow: { marginTop: tokens.spaceStackSm },
  priceLabel: { fontSize: 13, color: tokens.colorOnSurfaceVariant },
  price: { fontSize: 22, fontWeight: '700', color: tokens.colorCharcoal },
  memberPrice: { fontSize: 14, color: tokens.colorGold },
  highlights: { gap: 4 },
  highlight: { fontSize: 14, color: tokens.colorOnSurface },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colorCharcoal,
    marginTop: tokens.spaceStackMd,
  },
  prose: { fontSize: 15, lineHeight: 22, color: tokens.colorOnSurface },
  conciergeBlock: {
    marginTop: tokens.spaceStackLg,
    padding: tokens.spaceStackLg,
    backgroundColor: tokens.colorSurfaceBright,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.colorOutlineVariant,
  },
  conciergeTitle: {
    fontFamily: tokens.fontSerif,
    fontSize: 17,
    color: tokens.colorGold,
    marginBottom: tokens.spaceStackSm,
  },
  conciergeBody: { fontSize: 15, lineHeight: 22, color: tokens.colorOnSurface },
  roomCard: {
    padding: tokens.spaceStackMd,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.colorOutlineVariant,
    backgroundColor: tokens.colorSurfaceBright,
    marginTop: tokens.spaceStackSm,
  },
  roomName: { fontSize: 16, fontWeight: '600', color: tokens.colorCharcoal },
  roomMeta: { fontSize: 13, color: tokens.colorOnSurfaceVariant, marginTop: 4 },
  roomPrice: { fontSize: 15, fontWeight: '600', color: tokens.colorCharcoal, marginTop: 6 },
  errorText: {
    fontSize: 16,
    color: tokens.colorDanger,
    textAlign: 'center',
    marginBottom: tokens.spaceStackLg,
  },
  backButton: {
    minHeight: tokens.touchTarget,
    paddingHorizontal: tokens.spaceStackXl,
    justifyContent: 'center',
    backgroundColor: tokens.colorAction,
    borderRadius: tokens.radiusSm,
  },
  backButtonLabel: { color: '#ffffff', fontWeight: '600' },
});
