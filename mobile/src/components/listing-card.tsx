import { Link } from "expo-router";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Listing } from "@/lib/api";
import { formatKM, formatQAR, listingTitle, sourceLabel } from "@/lib/format";

export function ListingCard({ listing }: { listing: Listing }) {
  const thumb = listing.images?.[0] ?? null;
  const km = formatKM(listing.mileageKM);

  return (
    <Link href={`/listing/${listing.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.imageWrap}>
          {thumb ? (
            <Image
              source={thumb}
              style={styles.image}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.placeholderText}>No photo</Text>
            </View>
          )}
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{sourceLabel(listing.source)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {listingTitle(listing)}
          </Text>
          <Text style={styles.price}>{formatQAR(listing.priceQAR)}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[listing.year, km, listing.fuelType, listing.location]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(127,127,127,0.06)",
    marginBottom: 14,
  },
  imageWrap: { position: "relative" },
  image: { width: "100%", height: 200, backgroundColor: "rgba(127,127,127,0.15)" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: "rgba(127,127,127,0.7)", fontSize: 13 },
  sourceBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  body: { padding: 12, gap: 4 },
  title: { fontSize: 16, fontWeight: "600" },
  price: { fontSize: 17, fontWeight: "700", color: "#208AEF" },
  meta: { fontSize: 13, opacity: 0.7 },
});
