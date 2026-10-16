import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';

export interface CustomerHeaderProps {
  title: string;
  subtitle?: string;
  iconName?: string;
  iconColor?: string;
  iconBg?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  customLeft?: React.ReactNode;
}

export default function CustomerHeader({
  title,
  subtitle,
  iconName,
  iconColor,
  iconBg,
  showBack,
  onBack,
  rightAction,
  customLeft,
}: CustomerHeaderProps) {
  const { theme } = useAppTheme();

  const activeIconColor = iconColor || theme.colors.primary;
  const activeIconBg = iconBg || (theme.colors.primary + '15');

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.card }]}>
      <View style={[styles.headerContainer, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.leftContent}>
          {showBack && onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          )}

          {customLeft ? (
            customLeft
          ) : iconName ? (
            <View style={[styles.iconWrap, { backgroundColor: activeIconBg }]}>
              <MaterialCommunityIcons name={iconName} size={20} color={activeIconColor} />
            </View>
          ) : null}

          {(title || subtitle) ? (
            <View style={styles.titleColumn}>
              {title ? (
                <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text style={[styles.subtitle, { color: theme.colors.placeholder }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {rightAction ? <View style={styles.rightContent}>{rightAction}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  headerContainer: {
    minHeight: 56,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
