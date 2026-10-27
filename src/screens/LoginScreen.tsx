import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL, isTokenExpired } from '../context/DataContext';
import { validateEmail, validatePassword } from '../utils/validationUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '../theme/theme';
import {
  MotHeroLogo,
  EmailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  HeaderBackgroundSvg,
  TrustShieldSvg,
} from '../components/SvgIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { setToken, setTokens, setUser } = useAppValues();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Interactive focus states
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    const checkPersistedSession = async () => {
      setLoading(true);
      try {
        const storedToken = await AsyncStorage.getItem('user_token');
        const storedRefreshToken = await AsyncStorage.getItem('user_refresh_token');
        const storedUserJson = await AsyncStorage.getItem('user_profile');

        if (storedToken && storedUserJson) {
          if (!isTokenExpired(storedToken)) {
            const storedUser = JSON.parse(storedUserJson);
            setToken(storedToken);
            setUser(storedUser);

            if (
              storedUser.role === 'admin' ||
              storedUser.role === 'staff' ||
              storedUser.role === 'customer'
            ) {
              navigation.replace('Main');
              return;
            }
          } else if (storedRefreshToken) {
            // Attempt silent token refresh before deciding
            try {
              const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: storedRefreshToken })
              });
              if (res.ok) {
                const data = await res.json();
                const newAccess = data.accessToken || data.token;
                const newRefresh = data.refreshToken || storedRefreshToken;
                setTokens(newAccess, newRefresh);
                if (data.user) {
                  setUser(data.user);
                }
                navigation.replace('Main');
                return;
              }
            } catch (_) {}
          }

          // If expired and cannot be refreshed, silently clear stale credentials
          await Promise.all([
            AsyncStorage.removeItem('user_token'),
            AsyncStorage.removeItem('user_refresh_token'),
            AsyncStorage.removeItem('user_profile'),
          ]);
          setTokens(null, null);
          setUser(null);
        }
      } catch (err) {
        console.error('Error reading persisted session:', err);
      } finally {
        setLoading(false);
      }
    };
    checkPersistedSession();
  }, []);

  const handleLogin = async () => {
    const emailVal = validateEmail(email);
    if (emailVal.error) {
      setEmailError(true);
      setErrorMessage(emailVal.error);
      return;
    }
    setEmailError(false);

    const passwordVal = validatePassword(password);
    if (passwordVal.error) {
      setPasswordError(true);
      setErrorMessage(passwordVal.error);
      return;
    }
    setPasswordError(false);

    setErrorMessage(null);
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        }),
      });
      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
        return;
      }

      setTokens(data.accessToken || data.token, data.refreshToken || null);
      setUser(data.user);

      if (
        data.user?.role === 'admin' ||
        data.user?.role === 'staff' ||
        data.user?.role === 'customer'
      ) {
        navigation.replace('Main');
      } else {
        Alert.alert('Error', 'Unknown user role returned from server.');
      }
    } catch (error) {
      setLoading(false);
      console.error('Login error:', error);
      Alert.alert('Connection Error', 'Could not connect to the backend server.');
    }
  };

  const isDark = theme.dark;
  const activeBorderColor = isDark ? '#38BDF8' : '#1677FF';
  const activeInputBg = isDark ? '#142C44' : '#F4F9FF';
  const inactiveInputBg = isDark ? '#0F2438' : '#FAFCFF';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Decorative SVG Header Wave & Mesh */}
      <HeaderBackgroundSvg width={SCREEN_WIDTH} height={280} isDark={isDark} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand & Hero Logo Section */}
          <View style={styles.heroSection}>
            <View style={styles.logoShadowWrapper}>
              <MotHeroLogo
                size={100}
                primary={isDark ? '#0B1F33' : '#0B1F33'}
                secondary={isDark ? '#38BDF8' : '#1677FF'}
                dark={isDark}
              />
            </View>

            <Text style={[styles.title, { color: theme.colors.text }]}>Ondoor Car Service</Text>
          </View>

          {/* Form Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: isDark ? '#1C3B5E' : '#E2E8F0',
                shadowColor: isDark ? '#000000' : '#0F2B48',
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Sign In</Text>
              <Text style={[styles.cardSubtitle, { color: theme.colors.placeholder }]}>
                Access your vehicles, tests and history
              </Text>
            </View>

            {/* Error Container */}
            {errorMessage && (
              <View
                style={[
                  styles.errorContainer,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5',
                  },
                ]}
              >
                <AlertCircleIcon size={18} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Email Address
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor: emailError
                      ? '#EF4444'
                      : emailFocused
                      ? activeBorderColor
                      : isDark
                      ? '#1E3852'
                      : '#E2E8F0',
                    backgroundColor: emailFocused ? activeInputBg : inactiveInputBg,
                  },
                ]}
              >
                <View style={styles.iconBox}>
                  <EmailIcon
                    size={20}
                    color={
                      emailFocused
                        ? activeBorderColor
                        : emailError
                        ? '#EF4444'
                        : theme.colors.placeholder
                    }
                  />
                </View>
                <TextInput
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setEmailError(false);
                    setErrorMessage(null);
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="abc@gmail.com"
                  placeholderTextColor={theme.colors.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Password</Text>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor: passwordError
                      ? '#EF4444'
                      : passwordFocused
                      ? activeBorderColor
                      : isDark
                      ? '#1E3852'
                      : '#E2E8F0',
                    backgroundColor: passwordFocused ? activeInputBg : inactiveInputBg,
                  },
                ]}
              >
                <View style={styles.iconBox}>
                  <LockIcon
                    size={20}
                    color={
                      passwordFocused
                        ? activeBorderColor
                        : passwordError
                        ? '#EF4444'
                        : theme.colors.placeholder
                    }
                  />
                </View>
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setPasswordError(false);
                    setErrorMessage(null);
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.placeholder}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={[styles.input, { color: theme.colors.text }]}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOffIcon
                      size={20}
                      color={passwordFocused ? activeBorderColor : theme.colors.placeholder}
                    />
                  ) : (
                    <EyeIcon
                      size={20}
                      color={passwordFocused ? activeBorderColor : theme.colors.placeholder}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Action Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              style={[
                styles.primaryButton,
                {
                  backgroundColor: isDark ? '#1677FF' : '#0B1F33',
                  opacity: loading ? 0.75 : 1,
                  shadowColor: isDark ? '#1677FF' : '#0B1F33',
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Sign In</Text>
                  <ArrowRightIcon size={18} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Register Link */}
          <View style={styles.footerSection}>
            <Text style={[styles.footerText, { color: theme.colors.placeholder }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.7}
              style={styles.signUpPill}
            >
              <Text
                style={[
                  styles.signUpLink,
                  { color: isDark ? '#38BDF8' : '#1677FF' },
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trust Security Badges Footer */}
          <View style={styles.trustBadgesRow}>
            <View style={styles.trustBadge}>
              <TrustShieldSvg size={14} color="#10B981" />
              <Text style={[styles.trustBadgeText, { color: theme.colors.placeholder }]}>
                DVSA Integrated
              </Text>
            </View>
            <View style={[styles.dotDivider, { backgroundColor: theme.colors.border }]} />
            <View style={[styles.dotDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.trustBadge}>
              <TrustShieldSvg size={14} color="#10B981" />
              <Text style={[styles.trustBadgeText, { color: theme.colors.placeholder }]}>
                Verified Garages
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 56 : 46,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoShadowWrapper: {
    marginBottom: 12,
    shadowColor: '#1677FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
    gap: 6,
  },
  badgePillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 27,
    letterSpacing: 0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 17,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
    gap: 10,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#EF4444',
    flex: 1,
    lineHeight: 17,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    marginBottom: 6,
    marginLeft: 2,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 14,
  },
  iconBox: {
    width: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  input: {
    fontFamily: fonts.medium,
    flex: 1,
    height: '100%',
    fontSize: 15,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  signUpPill: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  signUpLink: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  trustBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
    flexWrap: 'wrap',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  dotDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
