import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface IconProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
}

// 1. Premium UK MOT & Vehicle Shield Hero Graphic
export const MotHeroLogo: React.FC<{
  size?: number;
  primary?: string;
  secondary?: string;
  dark?: boolean;
}> = ({
  size = 96,
  primary = '#0B1F33',
  secondary = '#1677FF',
  dark = false,
}) => {
  return (
    <View style={[styles.heroLogoContainer, { width: size, height: size }]}>
      {/* Outer ambient glow halo */}
      <View
        style={[
          styles.outerHalo,
          {
            backgroundColor: dark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(22, 119, 255, 0.12)',
            borderColor: dark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(22, 119, 255, 0.2)',
          },
        ]}
      />

      {/* Main Hex/Shield Badge Container */}
      <View
        style={[
          styles.mainBadge,
          {
            backgroundColor: dark ? '#0E2843' : '#0B1F33',
            borderColor: dark ? '#38BDF8' : '#1677FF',
          },
        ]}
      >
        {/* Top Triple MOT Triangles */}
        <View style={styles.motTrianglesRow}>
          <View style={[styles.motTriangle, { borderBottomColor: '#38BDF8' }]} />
          <View style={[styles.motTriangle, { borderBottomColor: '#60A5FA' }]} />
          <View style={[styles.motTriangle, { borderBottomColor: '#93C5FD' }]} />
        </View>

        {/* Central Vehicle Silhouette */}
        <MaterialCommunityIcons name="car-sports" size={38} color="#FFFFFF" />

        {/* Inner subtle glow line */}
        <View style={styles.innerGlowBar} />
      </View>

      {/* Verified Green Badge on Bottom Right */}
      <View style={styles.verifiedBadge}>
        <MaterialCommunityIcons name="check-bold" size={13} color="#FFFFFF" />
      </View>
    </View>
  );
};

// 2. Email Icon
export const EmailIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="email-outline" size={size} color={color} />;
};

// 3. Lock Icon
export const LockIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="lock-outline" size={size} color={color} />;
};

// 4. Lock Check Icon
export const LockCheckIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="lock-check-outline" size={size} color={color} />;
};

// 5. Eye Icon
export const EyeIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="eye-outline" size={size} color={color} />;
};

// 6. Eye Off Icon
export const EyeOffIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="eye-off-outline" size={size} color={color} />;
};

// 7. User Icon
export const UserIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="account-outline" size={size} color={color} />;
};

// 8. Phone Icon
export const PhoneIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="phone-outline" size={size} color={color} />;
};

// 9. Alert Circle Icon
export const AlertCircleIcon: React.FC<IconProps> = ({ size = 20, color = '#EF4444' }) => {
  return <MaterialCommunityIcons name="alert-circle-outline" size={size} color={color} />;
};

// 10. Arrow Right Icon
export const ArrowRightIcon: React.FC<IconProps> = ({ size = 20, color = '#FFFFFF' }) => {
  return <MaterialCommunityIcons name="arrow-right" size={size} color={color} />;
};

// 11. Checkbox Component
export const CheckboxSvg: React.FC<{
  checked: boolean;
  size?: number;
  color?: string;
  error?: boolean;
}> = ({ checked, size = 22, color = '#1677FF', error = false }) => {
  return (
    <View
      style={[
        styles.checkboxWrapper,
        {
          width: size,
          height: size,
          backgroundColor: checked ? color : 'transparent',
          borderColor: error ? '#EF4444' : checked ? color : '#94A3B8',
        },
      ]}
    >
      {checked && <MaterialCommunityIcons name="check-bold" size={size * 0.65} color="#FFFFFF" />}
    </View>
  );
};

// 12. Shield Checkmark Icon
export const ShieldCheckSvg: React.FC<IconProps> = ({ size = 20, color = '#1677FF' }) => {
  return <MaterialCommunityIcons name="shield-check" size={size} color={color} />;
};

// 13. Header Ambient Background Mesh
export const HeaderBackgroundSvg: React.FC<{
  width: number;
  height?: number;
  isDark?: boolean;
}> = ({ width, height = 240, isDark = false }) => {
  return (
    <View style={[styles.ambientBackground, { width, height }]} pointerEvents="none">
      {/* Orb 1 */}
      <View
        style={[
          styles.ambientOrb,
          {
            top: -40,
            left: -40,
            width: width * 0.75,
            height: width * 0.75,
            borderRadius: (width * 0.75) / 2,
            backgroundColor: isDark ? 'rgba(22, 119, 255, 0.16)' : 'rgba(22, 119, 255, 0.09)',
          },
        ]}
      />
      {/* Orb 2 */}
      <View
        style={[
          styles.ambientOrb,
          {
            top: 20,
            right: -60,
            width: width * 0.65,
            height: width * 0.65,
            borderRadius: (width * 0.65) / 2,
            backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.08)',
          },
        ]}
      />
    </View>
  );
};

// 14. Sparkles Accent
export const SparkleSvg: React.FC<IconProps> = ({ size = 16, color = '#F59E0B' }) => {
  return <MaterialCommunityIcons name="sparkles" size={size} color={color} />;
};

// 15. Back Chevron
export const ChevronLeftSvg: React.FC<IconProps> = ({ size = 22, color = '#0B1F33' }) => {
  return <MaterialCommunityIcons name="chevron-left" size={size} color={color} />;
};

// 16. Trust Shield Security Badge
export const TrustShieldSvg: React.FC<IconProps> = ({ size = 16, color = '#10B981' }) => {
  return <MaterialCommunityIcons name="shield-check" size={size} color={color} />;
};

const styles = StyleSheet.create({
  heroLogoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerHalo: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 48,
    borderWidth: 1.5,
  },
  mainBadge: {
    width: '84%',
    height: '84%',
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1677FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    paddingTop: 4,
  },
  motTrianglesRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  motTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  innerGlowBar: {
    width: 24,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.7)',
    marginTop: 2,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  checkboxWrapper: {
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  ambientOrb: {
    position: 'absolute',
  },
});
