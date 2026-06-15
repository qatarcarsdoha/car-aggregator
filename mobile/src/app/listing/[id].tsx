import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getListing, type Listing } from "@/lib/api";
import { formatKM, formatQAR, listingTitle, sourceLabel, sourceTag } from "@/lib/format";
import { fonts, radius, useTheme, type Palette } from "@/lib/theme";

const { width } = Dimensions.get("window");
const GALLERY_H = width * 0.72;

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [active, setActive] = useState(0);

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id),
    enabled: !!id,
  });

  const specs = useMemo(() => (listing ? buildSpecs(listing) : []), [listing]);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={c.brand} />
      </View>
    );
  }
  if (isError || !listing) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Listing not found.</Text>
      </View>
    );
  }

  const phone = listing.contactPhone;
  const whatsapp = listing.contactWhatsapp;
  const hasActions = !!(phone || whatsapp);

  return (
    <>
      <Stack.Screen options={{ title: sourceLabel(listing.source) }} />
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + (hasActions ? 110 : 28) }}
      >
        {listing.images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setActive(Math.round(e.nativeEvent.contentOffset.x / width))
              }
            >
              {listing.images.map((uri, i) => (
                <Image
                  key={`${uri}-${i}`}
                  source={uri}
                  style={{ width, height: GALLERY_H }}
                  contentFit="cover"
                  transition={150}
                />
              ))}
            </ScrollView>
            <View style={s.sourceTag}>
              <Text style={s.sourceTagText}>{sourceTag(listing.source)}</Text>
            </View>
            {listing.images.length > 1 && (
              <View style={s.counter}>
                <Text style={s.counterText}>
                  {active + 1} / {listing.images.length}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[s.noImage, { width, height: GALLERY_H }]}>
            <Text style={s.muted}>No photos</Text>
          </View>
        )}

        <View style={s.body}>
          <Text style={s.kicker}>{sourceLabel(listing.source)}</Text>
          <Text style={s.title}>{listingTitle(listing)}</Text>
          <Text style={s.price}>{formatQAR(listing.priceQAR)}</Text>

          {listing.location ? (
            <View style={s.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={14} color={c.inkMuted2} />
              <Text style={s.location}>{listing.location}</Text>
            </View>
          ) : null}

          {specs.length > 0 && (
            <View style={s.specGrid}>
              {specs.map((sp) => (
                <View key={sp.label} style={s.specCell}>
                  <Text style={s.specLabel}>{sp.label}</Text>
                  <Text style={s.specValue}>{sp.value}</Text>
                </View>
              ))}
            </View>
          )}

          {listing.features?.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Features</Text>
              <View style={s.featureWrap}>
                {listing.features.map((f) => (
                  <View key={f} style={s.featurePill}>
                    <Text style={s.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {listing.description ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Description</Text>
              <Text style={s.description}>{listing.description}</Text>
            </View>
          ) : null}

          {listing.dealerName ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Seller</Text>
              <Text style={s.description}>{listing.dealerName}</Text>
            </View>
          ) : null}

          <Pressable style={s.sourceLink} onPress={() => Linking.openURL(listing.sourceUrl)}>
            <Text style={s.sourceLinkText}>View original on {sourceLabel(listing.source)}</Text>
            <MaterialCommunityIcons name="arrow-top-right" size={14} color={c.brand} />
          </Pressable>
        </View>
      </ScrollView>

      {hasActions && (
        <View style={[s.actionBar, { paddingBottom: insets.bottom + 12 }]}>
          {phone ? (
            <Pressable
              style={[s.actionBtn, s.callBtn]}
              onPress={() => Linking.openURL(`tel:${phone}`)}
            >
              <MaterialCommunityIcons name="phone" size={18} color={c.bone} />
              <Text style={s.actionText}>Call</Text>
            </Pressable>
          ) : null}
          {whatsapp ? (
            <Pressable
              style={[s.actionBtn, s.waBtn]}
              onPress={() =>
                Linking.openURL(`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`)
              }
            >
              <MaterialCommunityIcons name="whatsapp" size={18} color="#fff" />
              <Text style={[s.actionText, { color: "#fff" }]}>WhatsApp</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </>
  );
}

function buildSpecs(l: Listing): { label: string; value: string }[] {
  const km = formatKM(l.mileageKM);
  const raw: [string, string | number | null][] = [
    ["Year", l.year],
    ["Mileage", km],
    ["Fuel", l.fuelType],
    ["Transmission", l.transmission],
    ["Body", l.bodyType],
    ["Cylinders", l.cylinders],
    ["Engine", l.engineSize],
    ["Drive", l.wheelDrive],
    ["Exterior", l.exteriorColor],
    ["Interior", l.interiorColor],
    ["Doors", l.doors],
    ["Seats", l.seats],
  ];
  return raw
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([label, v]) => ({ label, value: String(v) }));
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bone },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: c.bone },
    muted: { fontFamily: fonts.body, color: c.inkMuted, fontSize: 15 },
    noImage: { alignItems: "center", justifyContent: "center", backgroundColor: c.sand },
    sourceTag: {
      position: "absolute",
      top: 12,
      right: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.chipBorder,
      backgroundColor: c.chipBg,
    },
    sourceTagText: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: c.inkMuted,
    },
    counter: {
      position: "absolute",
      bottom: 12,
      right: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: c.scrim,
    },
    counterText: { fontFamily: fonts.mono, fontSize: 11, color: "#fff" },
    body: { padding: 20, gap: 6 },
    kicker: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: c.inkMuted,
    },
    title: { fontFamily: fonts.displaySemiBold, fontSize: 26, color: c.ink, letterSpacing: -0.5, marginTop: 2 },
    price: { fontFamily: fonts.displayMedium, fontSize: 24, color: c.brand, marginTop: 4 },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
    location: { fontFamily: fonts.body, fontSize: 14, color: c.inkMuted },
    specGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 18,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    specCell: {
      width: "50%",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    specLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: c.inkMuted2,
    },
    specValue: { fontFamily: fonts.bodyMedium, fontSize: 15, color: c.ink, marginTop: 4 },
    section: { marginTop: 24, gap: 10 },
    sectionTitle: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: c.inkMuted,
    },
    featureWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    featurePill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: c.fill,
      borderWidth: 1,
      borderColor: c.chipBorder,
    },
    featureText: { fontFamily: fonts.body, fontSize: 13, color: c.ink },
    description: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: c.inkMuted },
    sourceLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 28 },
    sourceLinkText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: c.brand },
    actionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 14,
      backgroundColor: c.paper,
      borderTopWidth: 1,
      borderTopColor: c.borderStrong,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    callBtn: { backgroundColor: c.brand },
    waBtn: { backgroundColor: "#25D366" },
    actionText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: c.bone },
  });
}
