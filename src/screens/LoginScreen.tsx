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
import { useAppValues, BASE_URL } from '../context/DataContext';
import { validateEmail, validatePassword } from '../utils/validationUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MotHeroLogo,
  EmailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  HeaderBackgroundSvg,
  SparkleSvg,
  TrustShieldSvg,
} from '../components/SvgIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { setToken, setUser } = useAppValues();
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
        const storedUserJson = await AsyncStorage.getItem('user_profile');
        if (storedToken && storedUserJson) {
          const storedUser = JSON.parse(storedUserJson);
          setToken(storedToken);
          setUser(storedUser);

          if (
            storedUser.role === 'admin' ||
            storedUser.role === 'staff' ||
            storedUser.role === 'customer'
          ) {
            navigation.replace('Main');
          }
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

      setToken(data.token);
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

            {/* Official Badge Pill */}
            <View
              style={[
                styles.badgePill,
                {
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(22, 119, 255, 0.08)',
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(22, 119, 255, 0.2)',
                },
              ]}
            >
              <SparkleSvg size={14} color={isDark ? '#38BDF8' : '#1677FF'} />
              <Text
                style={[
                  styles.badgePillText,
                  { color: isDark ? '#38BDF8' : '#1677FF' },
                ]}
              >
                UK OFFICIAL MOT PLATFORM
              </Text>
            </View>

            <Text style={[styles.title, { color: theme.colors.text }]}>MOT Reminders</Text>
            <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
              Automated vehicle MOT alerts & multi-garage network
            </Text>
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
                  placeholder="e.g. driver@example.co.uk"
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
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
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  cardSubtitle: {
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
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 13.5,
    fontWeight: '700',
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
    flex: 1,
    height: '100%',
    fontSize: 15,
    paddingVertical: 0,
    fontWeight: '500',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signUpPill: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '800',
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
    fontSize: 11,
    fontWeight: '600',
  },
  dotDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
