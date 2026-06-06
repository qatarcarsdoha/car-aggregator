import { useMemo } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { getListing, type Listing } from "@/lib/api";
import { formatKM, formatQAR, listingTitle, sourceLabel } from "@/lib/format";

const { width } = Dimensions.get("window");

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id),
    enabled: !!id,
  });

  const specs = useMemo(() => (listing ? buildSpecs(listing) : []), [listing]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (isError || !listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Listing not found.</Text>
      </View>
    );
  }

  const phone = listing.contactPhone;
  const whatsapp = listing.contactWhatsapp;

  return (
    <>
      <Stack.Screen options={{ title: sourceLabel(listing.source) }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {listing.images.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {listing.images.map((uri, i) => (
              <Image
                key={`${uri}-${i}`}
                source={uri}
                style={{ width, height: width * 0.72 }}
                contentFit="cover"
                transition={150}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.noImage, { width, height: width * 0.72 }]}>
            <Text style={styles.muted}>No photos</Text>
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.title}>{listingTitle(listing)}</Text>
          <Text style={styles.price}>{formatQAR(listing.priceQAR)}</Text>

          {listing.location ? (
            <Text style={styles.location}>{listing.location}</Text>
          ) : null}

          {specs.length > 0 && (
            <View style={styles.specGrid}>
              {specs.map((s) => (
                <View key={s.label} style={styles.specCell}>
                  <Text style={styles.specLabel}>{s.label}</Text>
                  <Text style={styles.specValue}>{s.value}</Text>
                </View>
              ))}
            </View>
          )}

          {listing.features?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Features</Text>
              <View style={styles.featureWrap}>
                {listing.features.map((f) => (
                  <View key={f} style={styles.featurePill}>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          {listing.dealerName ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seller</Text>
              <Text style={styles.description}>{listing.dealerName}</Text>
            </View>
          ) : null}

          <Pressable
            style={styles.sourceLink}
            onPress={() => Linking.openURL(listing.sourceUrl)}
          >
            <Text style={styles.sourceLinkText}>
              View original on {sourceLabel(listing.source)} ↗
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {(phone || whatsapp) && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 10 }]}>
          {phone ? (
            <Pressable
              style={[styles.actionBtn, styles.callBtn]}
              onPress={() => Linking.openURL(`tel:${phone}`)}
            >
              <Text style={styles.actionText}>Call</Text>
            </Pressable>
          ) : null}
          {whatsapp ? (
            <Pressable
              style={[styles.actionBtn, styles.waBtn]}
              onPress={() => Linking.openURL(`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`)}
            >
              <Text style={styles.actionText}>WhatsApp</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  muted: { opacity: 0.6, fontSize: 15 },
  noImage: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(127,127,127,0.15)" },
  body: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  price: { fontSize: 22, fontWeight: "800", color: "#208AEF" },
  location: { fontSize: 14, opacity: 0.7 },
  specGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 0 },
  specCell: { width: "50%", paddingVertical: 8, paddingRight: 8 },
  specLabel: { fontSize: 12, opacity: 0.55, textTransform: "uppercase", letterSpacing: 0.5 },
  specValue: { fontSize: 15, fontWeight: "600", marginTop: 2 },
  section: { marginTop: 18, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 },
  featureWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  featurePill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(127,127,127,0.12)",
  },
  featureText: { fontSize: 13 },
  description: { fontSize: 15, lineHeight: 22, opacity: 0.85 },
  sourceLink: { marginTop: 22 },
  sourceLinkText: { color: "#208AEF", fontSize: 14, fontWeight: "600" },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(20,20,20,0.92)",
  },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  callBtn: { backgroundColor: "#208AEF" },
  waBtn: { backgroundColor: "#25D366" },
  actionText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
