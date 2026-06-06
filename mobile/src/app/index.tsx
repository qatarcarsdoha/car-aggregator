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
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getListings, getMeta, type Listing } from "@/lib/api";
import { SORT_OPTIONS, type SortValue } from "@/lib/format";
import { ListingCard } from "@/components/listing-card";

const PER_PAGE = 20;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortValue>("newest");
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  // No debounce: react-query keys on q directly. The dataset is small and the
  // API is fast, so typing re-queries cheaply. Keep it simple.
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
    queryKey: ["listings", { q, sort, make, model }],
    queryFn: ({ pageParam }) =>
      getListings({ page: pageParam, perPage: PER_PAGE, sort, make, model, q }),
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
    <View style={[styles.container, { paddingTop: 8 }]}>
      <View style={styles.controls}>
        <TextInput
          style={styles.search}
          placeholder="Search make, model, year…"
          placeholderTextColor="rgba(127,127,127,0.7)"
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          autoCorrect={false}
        />

        <ChipRow>
          {SORT_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={sort === o.value}
              onPress={() => setSort(o.value)}
            />
          ))}
        </ChipRow>

        {meta?.makes && meta.makes.length > 0 && (
          <ChipRow>
            <Chip label="All makes" active={make === null} onPress={() => selectMake(null)} />
            {meta.makes.map((m) => (
              <Chip key={m} label={m} active={make === m} onPress={() => selectMake(m)} />
            ))}
          </ChipRow>
        )}

        {make && meta?.models && meta.models.length > 0 && (
          <ChipRow>
            <Chip label="All models" active={model === null} onPress={() => setModel(null)} />
            {meta.models.map((m) => (
              <Chip key={m} label={m} active={model === m} onPress={() => setModel(m)} />
            ))}
          </ChipRow>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Couldn&apos;t load listings.</Text>
          <Pressable style={styles.retry} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <Text style={styles.count}>{total.toLocaleString("en-US")} listings</Text>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>No listings match your filters.</Text>
            </View>
          }
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        />
      )}
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {children}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      hitSlop={6}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { gap: 8, paddingBottom: 6 },
  search: {
    marginHorizontal: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(127,127,127,0.12)",
    fontSize: 15,
    color: "#888",
  },
  chipRow: { paddingHorizontal: 14, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(127,127,127,0.12)",
  },
  chipActive: { backgroundColor: "#208AEF" },
  chipText: { fontSize: 13, fontWeight: "500", opacity: 0.8 },
  chipTextActive: { color: "#fff", opacity: 1 },
  count: { fontSize: 13, opacity: 0.6, marginVertical: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  muted: { opacity: 0.6, fontSize: 15 },
  retry: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: "#208AEF" },
  retryText: { color: "#fff", fontWeight: "600" },
});
