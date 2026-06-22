import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getListings, getMeta, type Listing } from "@/lib/api";
import {
  SORT_OPTIONS,
  SORT_SHORT,
  SOURCE_OPTIONS,
  buildYearOptions,
  yearValueToRange,
  yearTriggerLabel,
  sourceLabel,
  type SortValue,
} from "@/lib/format";
import { ListingCard } from "@/components/listing-card";
import { FilterDropdown } from "@/components/filter-dropdown";
import { fonts, radius, useTheme, type Palette } from "@/lib/theme";

const ALL = "__all__";

const PER_PAGE = 20;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortValue>("newest");
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const yearOptions = useMemo(() => buildYearOptions(currentYear), [currentYear]);
  const { minYear, maxYear } = useMemo(
    () => yearValueToRange(year, currentYear),
    [year, currentYear]
  );

  const { data: meta } = useQuery({
    queryKey: ["meta", make],
    queryFn: () => getMeta(make),
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["listings", { q, sort, make, model, year, source }],
    queryFn: ({ pageParam }) =>
      getListings({ page: pageParam, perPage: PER_PAGE, sort, make, model, q, minYear, maxYear, source }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });

  const listings: Listing[] = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data]
  );
  const total = data?.pages[0]?.total ?? 0;

  const selectMake = (m: string | null) => {
    setMake(m);
    setModel(null); // models are scoped to the selected make
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={s.headerLeft}>
            <Text style={s.kicker}>Doha — Live feed</Text>
            <Text style={s.h1}>
              Qatar <Text style={s.h1Accent}>Cars</Text>
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.count}>{total.toLocaleString("en-US")}</Text>
            <Text style={s.countLabel}>Listings</Text>
          </View>
        </View>

        <View style={s.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color={c.inkMuted2} />
          <TextInput
            style={s.search}
            placeholder="Search make, model, year…"
            placeholderTextColor={c.inkMuted2}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            autoCorrect={false}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color={c.inkMuted2} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filterScroll}
          contentContainerStyle={s.filterScrollContent}
        >
          <FilterDropdown
            title="Make"
            triggerLabel={make ?? "Make"}
            active={!!make}
            selected={make ?? ALL}
            options={[
              { value: ALL, label: "All makes" },
              ...(meta?.makes ?? []).map((m) => ({ value: m, label: m })),
            ]}
            onSelect={(v) => selectMake(v === ALL ? null : v)}
          />
          <FilterDropdown
            title="Model"
            triggerLabel={model ?? "Model"}
            active={!!model}
            disabled={!make || (meta?.models?.length ?? 0) === 0}
            selected={model ?? ALL}
            options={[
              { value: ALL, label: "All models" },
              ...(meta?.models ?? []).map((m) => ({ value: m, label: m })),
            ]}
            onSelect={(v) => setModel(v === ALL ? null : v)}
          />
          <FilterDropdown
            title="Year"
            triggerLabel={yearTriggerLabel(year)}
            active={!!year}
            selected={year ?? ALL}
            options={[{ value: ALL, label: "All years" }, ...yearOptions]}
            onSelect={(v) => setYear(v === ALL ? null : v)}
          />
          <FilterDropdown
            title="Source"
            triggerLabel={source ? sourceLabel(source) : "Source"}
            active={!!source}
            selected={source ?? ALL}
            options={[
              { value: ALL, label: "All sources" },
              ...SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
            ]}
            onSelect={(v) => setSource(v === ALL ? null : v)}
          />
          <FilterDropdown
            title="Sort by"
            triggerLabel={SORT_SHORT[sort]}
            active={sort !== "newest"}
            selected={sort}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onSelect={(v) => setSort(v as SortValue)}
          />
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={c.brand} />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Text style={s.muted}>Couldn&apos;t load listings.</Text>
          <Pressable style={s.retry} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>No listings match your filters.</Text>
            </View>
          }
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={{ marginVertical: 20 }} color={c.brand} />
            ) : listings.length > 0 ? (
              <Text style={s.endLabel}>End of feed</Text>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.brand} />
          }
        />
      )}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bone },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: 12,
    },
    headerTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 8 },
    headerLeft: { flex: 1 },
    headerRight: { alignItems: "flex-end" },
    kicker: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: c.inkMuted,
    },
    h1: { fontFamily: fonts.displayMedium, fontSize: 34, color: c.ink, letterSpacing: -0.5, marginTop: 2 },
    h1Accent: { fontFamily: fonts.displayItalic, color: c.brand },
    count: { fontFamily: fonts.display, fontSize: 26, color: c.ink, lineHeight: 28 },
    countLabel: {
      fontFamily: fonts.mono,
      fontSize: 9,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: c.inkMuted,
      marginTop: 2,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: c.paper,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    search: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: c.ink, paddingVertical: 0 },
    // Bleed the strip to the screen edges (cancel the header's 16px padding) so
    // pills scroll fully edge-to-edge, but re-pad the content so the first pill
    // still lines up with the header and the last clears the right edge.
    filterScroll: { marginHorizontal: -16 },
    filterScrollContent: { paddingHorizontal: 16, gap: 8 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 14 },
    muted: { fontFamily: fonts.body, color: c.inkMuted, fontSize: 15 },
    retry: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: c.brand },
    retryText: { fontFamily: fonts.bodySemiBold, color: c.bone, fontSize: 14 },
    endLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: c.inkMuted2,
      textAlign: "center",
      marginVertical: 24,
    },
  });
}
