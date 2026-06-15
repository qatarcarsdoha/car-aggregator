import { useMemo } from "react";
import { Link } from "expo-router";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Listing } from "@/lib/api";
import {
  formatKM,
  formatQAR,
  formatRelative,
  isFresh,
  sourceTag,
  toFeedThumbnail,
} from "@/lib/format";
import { fonts, radius, useTheme, type Palette } from "@/lib/theme";

export function ListingCard({ listing: l }: { listing: Listing }) {
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  const thumb = l.images?.[0] ? toFeedThumbnail(l.images[0]) : null;
  const km = formatKM(l.mileageKM);
  const fresh = isFresh(l.firstSeenAt);

  const specs = [
    km ? { icon: "speedometer" as const, text: km } : null,
    l.fuelType ? { icon: "gas-station" as const, text: l.fuelType } : null,
    l.location ? { icon: "map-marker" as const, text: l.location } : null,
  ].filter(Boolean) as { icon: "speedometer" | "gas-station" | "map-marker"; text: string }[];

  return (
    <Link href={`/listing/${l.id}`} asChild>
      <Pressable style={s.card}>
        <View style={s.imageWrap}>
          {thumb ? (
            <Image source={thumb} style={s.image} contentFit="cover" transition={150} />
          ) : (
            <View style={[s.image, s.imagePlaceholder]}>
              <Text style={s.placeholderText}>No image</Text>
            </View>
          )}

          {/* top-left status chips */}
          <View style={s.topLeft}>
            {fresh && (
              <View style={[s.chip, s.chipBrand]}>
                <Text style={[s.chipText, s.chipTextOnBrand]}>Just added</Text>
              </View>
            )}
            {l.isBrandNew && (
              <View style={[s.chip, s.chipInk]}>
                <Text style={[s.chipText, s.chipTextOnInk]}>New</Text>
              </View>
            )}
          </View>

          {/* source tag */}
          <View style={s.topRight}>
            <View style={s.chipGlass}>
              <Text style={s.chipText}>{sourceTag(l.source)}</Text>
            </View>
          </View>

          {/* price band */}
          <View style={s.priceBand}>
            <Text style={s.priceOverlay}>{formatQAR(l.priceQAR)}</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={1}>
              {[l.make, l.model].filter(Boolean).join(" ") || l.title || "Untitled"}
            </Text>
            {l.year != null && <Text style={s.year}>{l.year}</Text>}
          </View>
          {l.trim ? (
            <Text style={s.trim} numberOfLines={1}>
              {l.trim}
            </Text>
          ) : null}

          {specs.length > 0 && (
            <View style={s.specRow}>
              {specs.map((sp) => (
                <View key={sp.text} style={s.specPill}>
                  <MaterialCommunityIcons name={sp.icon} size={12} color={c.inkMuted2} />
                  <Text style={s.specText} numberOfLines={1}>
                    {sp.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.footer}>
            <Text style={s.footerText} numberOfLines={1}>
              {l.dealerName ?? "Private seller"}
            </Text>
            <View style={s.footerDate}>
              <MaterialCommunityIcons name="clock-outline" size={11} color={c.inkMuted2} />
              <Text style={s.footerText}>
                {formatRelative(l.sourceUpdatedAt ?? l.firstSeenAt)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.paper,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
      marginBottom: 16,
    },
    imageWrap: { position: "relative", aspectRatio: 4 / 3, width: "100%" },
    image: { width: "100%", height: "100%", backgroundColor: c.sand },
    imagePlaceholder: { alignItems: "center", justifyContent: "center" },
    placeholderText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: c.inkMuted2,
    },
    topLeft: { position: "absolute", top: 12, left: 12, gap: 6, alignItems: "flex-start" },
    topRight: { position: "absolute", top: 12, right: 12 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: "transparent",
    },
    chipGlass: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.chipBorder,
      backgroundColor: c.chipBg,
    },
    chipBrand: { backgroundColor: c.brand },
    chipInk: { backgroundColor: c.ink },
    chipText: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: c.inkMuted,
    },
    chipTextOnBrand: { color: c.bone },
    chipTextOnInk: { color: c.bone },
    priceBand: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 14,
      paddingTop: 28,
      paddingBottom: 12,
      backgroundColor: c.scrim,
    },
    priceOverlay: {
      fontFamily: fonts.displaySemiBold,
      fontSize: 21,
      color: "#fff",
      letterSpacing: -0.3,
    },
    body: { padding: 16 },
    titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    title: {
      flex: 1,
      fontFamily: fonts.displayMedium,
      fontSize: 18,
      color: c.ink,
      letterSpacing: -0.2,
    },
    year: { fontFamily: fonts.mono, fontSize: 12, color: c.inkMuted },
    trim: { fontFamily: fonts.body, fontSize: 12, color: c.inkMuted2, marginTop: 2 },
    specRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
    specPill: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
    specText: { fontFamily: fonts.body, fontSize: 12, color: c.inkMuted },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    footerText: { fontFamily: fonts.mono, fontSize: 10, color: c.inkMuted2 },
    footerDate: { flexDirection: "row", alignItems: "center", gap: 4 },
  });
}
