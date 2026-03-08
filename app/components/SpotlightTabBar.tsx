import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColors } from '../lib/useColors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const INDICATOR_W = 40;
const BAR_HEIGHT = 64;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { on: IoniconName; off: IoniconName }> = {
  home:     { on: 'home',              off: 'home-outline' },
  dogs:     { on: 'paw',               off: 'paw-outline' },
  tracking: { on: 'location',          off: 'location-outline' },
  book:     { on: 'calendar',          off: 'calendar-outline' },
  profile:  { on: 'person-circle',     off: 'person-circle-outline' },
};

export function SpotlightTabBar({ state, navigation }: BottomTabBarProps) {
  const C = useColors();
  const dynStyles = useMemo(() => ({
    background:  { backgroundColor: `${C.dark}FA` as any },
    topBorder:   { backgroundColor: C.border },
    indicator:   {
      backgroundColor: C.gold,
      ...Platform.select({
        ios: {
          shadowColor: C.gold,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 4,
        },
      }),
    },
  }), [C]);

  const insets = useSafeAreaInsets();
  const count = state.routes.length;
  const tabW = SCREEN_WIDTH / count;

  const indicatorX = useRef(
    new Animated.Value(tabIndX(state.index, tabW))
  ).current;

  const glowValues = useRef(
    state.routes.map((_, i) => new Animated.Value(i === state.index ? 1 : 0))
  ).current;

  const colourValues = useRef(
    state.routes.map((_, i) => new Animated.Value(i === state.index ? 1 : 0))
  ).current;

  useEffect(() => {
    const idx = state.index;

    Animated.spring(indicatorX, {
      toValue: tabIndX(idx, tabW),
      useNativeDriver: true,
      tension: 130,
      friction: 11,
    }).start();

    state.routes.forEach((_, i) => {
      const dist = Math.abs(idx - i);
      const targetGlow = i === idx ? 1 : Math.max(0, 1 - dist * 0.6);
      Animated.timing(glowValues[i], {
        toValue: targetGlow,
        duration: 250,
        useNativeDriver: true,
      }).start();
      Animated.timing(colourValues[i], {
        toValue: i === idx ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
  }, [state.index]);

  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.outer, { paddingBottom: bottomPad }]}>
      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, dynStyles.background]} />
      </View>

      {/* Top border */}
      <View style={[styles.topBorderBase, dynStyles.topBorder]} />

      {/* Sliding gold indicator line */}
      <Animated.View
        style={[
          styles.indicatorBase,
          dynStyles.indicator,
          { transform: [{ translateX: indicatorX }] },
        ]}
      />

      {/* Tabs */}
      <View style={styles.tabRow}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const icons = ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' };

          const iconColor = colourValues[i].interpolate({
            inputRange: [0, 1],
            outputRange: [C.muted, C.gold],
          });

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              hitSlop={8}
              onPress={() => {
                if (!focused) navigation.navigate(route.name);
              }}
              android_ripple={{ color: 'transparent' }}
            >
              {/* Spotlight glow */}
              <Animated.View style={[styles.glowWrap, { opacity: glowValues[i] }]}>
                <LinearGradient
                  colors={['rgba(201,168,76,0.22)', 'rgba(201,168,76,0.06)', 'transparent']}
                  locations={[0, 0.45, 1]}
                  style={styles.glow}
                />
              </Animated.View>

              {/* Icon */}
              <Animated.Text style={{ color: iconColor }}>
                <Ionicons
                  name={focused ? icons.on : icons.off}
                  size={24}
                  color={focused ? C.gold : C.muted}
                />
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function tabIndX(index: number, tabW: number) {
  return index * tabW + (tabW - INDICATOR_W) / 2;
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  topBorderBase: {
    height: 1,
  },
  indicatorBase: {
    position: 'absolute',
    top: 0,
    width: INDICATOR_W,
    height: 2,
    borderRadius: 1,
  },
  tabRow: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
  },
});
