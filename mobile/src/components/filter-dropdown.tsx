import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { fonts, radius, useTheme, type Palette } from "@/lib/theme";

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Editorial pill dropdown — mirrors the web FilterSelect/SortControl: a rounded
 * trigger that turns brand-colored when active, opening a bottom sheet of
 * options with the selected one highlighted in brand.
 */
export function FilterDropdown({
  title,
  triggerLabel,
  options,
  selected,
  active,
  disabled,
  onSelect,
}: {
  title: string;
  /** Text shown on the trigger button. */
  triggerLabel: string;
  options: DropdownOption[];
  selected: string;
  active: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);

  const choose = (value: string) => {
    onSelect(value);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[s.trigger, active && s.triggerActive, disabled && s.triggerDisabled]}
        hitSlop={4}
      >
        <Text
          style={[s.triggerText, active && s.triggerTextActive]}
          numberOfLines={1}
        >
          {triggerLabel}
        </Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={16}
          color={active ? c.bone : c.inkMuted}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{title}</Text>
            <ScrollView
              style={s.list}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
            >
              {options.map((o) => {
                const isSel = o.value === selected;
                return (
                  <Pressable
                    key={o.value}
                    style={s.option}
                    onPress={() => choose(o.value)}
                  >
                    <Text style={[s.optionText, isSel && s.optionTextActive]}>
                      {o.label}
                    </Text>
                    {isSel && (
                      <MaterialCommunityIcons name="check" size={18} color={c.brand} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    trigger: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 4,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: c.paper,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    triggerActive: { backgroundColor: c.brand, borderColor: c.brand },
    triggerDisabled: { opacity: 0.45 },
    triggerText: {
      flex: 1,
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.ink,
    },
    triggerTextActive: { color: c.bone },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.paper,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: 10,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: c.border,
      maxHeight: "70%",
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
      marginBottom: 12,
    },
    sheetTitle: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: c.inkMuted,
      paddingHorizontal: 12,
      marginBottom: 4,
    },
    list: { flexGrow: 0 },
    listContent: { paddingBottom: 4 },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: radius.md,
    },
    optionText: { fontFamily: fonts.body, fontSize: 16, color: c.ink },
    optionTextActive: { fontFamily: fonts.bodySemiBold, color: c.brand },
  });
}
