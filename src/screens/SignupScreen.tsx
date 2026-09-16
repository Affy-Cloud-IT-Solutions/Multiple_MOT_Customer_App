import React, { useState } from 'react';
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
import { BASE_URL } from '../context/DataContext';
import {
  validateFirstName,
  validateLastName,
  validatePhoneNumber,
  validateEmail,
  validatePassword,
} from '../utils/validationUtils';
import {
  UserIcon,
  EmailIcon,
  PhoneIcon,
  LockIcon,
  LockCheckIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  CheckboxSvg,
  ShieldCheckSvg,
  ChevronLeftSvg,
  HeaderBackgroundSvg,
  TrustShieldSvg,
} from '../components/SvgIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SignupScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [mobileError, setMobileError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);
  const [garageConsent, setGarageConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Focus states
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [mobileFocused, setMobileFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  const handleSignup = async () => {
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const firstVal = validateFirstName(firstName);
    if (firstVal.error) {
      setNameError(true);
      setErrorMessage(firstVal.error);
      return;
    }

    if (!lastName) {
      setNameError(true);
      setErrorMessage('Last name is required. Please enter your full name.');
      return;
    }
    const lastVal = validateLastName(lastName);
    if (lastVal.error) {
      setNameError(true);
      setErrorMessage(lastVal.error);
      return;
    }
    setNameError(false);

    const emailVal = validateEmail(email);
    if (emailVal.error) {
      setEmailError(true);
      setErrorMessage(emailVal.error);
      return;
    }
    setEmailError(false);

    const mobileVal = validatePhoneNumber(mobile);
    if (mobileVal.error) {
      setMobileError(true);
      setErrorMessage(mobileVal.error);
      return;
    }
    setMobileError(false);

    const passwordVal = validatePassword(password);
    if (passwordVal.error) {
      setPasswordError(true);
      setErrorMessage(passwordVal.error);
      return;
    }
    setPasswordError(false);

    if (password.trim() !== confirmPassword.trim()) {
      setPasswordError(true);
      setConfirmPasswordError(true);
      setErrorMessage('Passwords do not match');
      return;
    }
    setConfirmPasswordError(false);

    if (!garageConsent) {
      setConsentError(true);
      setErrorMessage('Please consent to garage communications and data sharing to register.');
      return;
    }
    setConsentError(false);
    setErrorMessage(null);

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          mobile: mobile.trim(),
          garageConsent: true,
        }),
      });
      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        Alert.alert('Signup Failed', data.error || 'Failed to create account');
        return;
      }

      Alert.alert('Success', 'Account created successfully! Please log in.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      setLoading(false);
      console.error('Signup error:', error);
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

      {/* Ambient Top SVG Background */}
      <HeaderBackgroundSvg width={SCREEN_WIDTH} height={260} isDark={isDark} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Bar with Back Button */}
          <View style={styles.topNavigation}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[
                styles.backButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
                },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeftSvg size={20} color={theme.colors.text} />
            </TouchableOpacity>

            <View style={styles.badgeContainer}>
              <View
                style={[
                  styles.headerBadge,
                  {
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(22, 119, 255, 0.08)',
                    borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(22, 119, 255, 0.2)',
                  },
                ]}
              >
                <TrustShieldSvg size={14} color={isDark ? '#38BDF8' : '#1677FF'} />
                <Text
                  style={[
                    styles.headerBadgeText,
                    { color: isDark ? '#38BDF8' : '#1677FF' },
                  ]}
                >
                  NEW CUSTOMER REGISTRATION
                </Text>
              </View>
            </View>
          </View>

          {/* Title Header */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Create Account
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
              Join the UK MOT network for instant test alerts & direct booking
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
            {/* Error Message */}
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

            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Full Name</Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor: nameError
                      ? '#EF4444'
                      : nameFocused
                      ? activeBorderColor
                      : isDark
                      ? '#1E3852'
                      : '#E2E8F0',
                    backgroundColor: nameFocused ? activeInputBg : inactiveInputBg,
                  },
                ]}
              >
                <View style={styles.iconBox}>
                  <UserIcon
                    size={20}
                    color={
                      nameFocused
                        ? activeBorderColor
                        : nameError
                        ? '#EF4444'
                        : theme.colors.placeholder
                    }
                  />
                </View>
                <TextInput
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setNameError(false);
                    setErrorMessage(null);
                  }}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  placeholder="e.g. Alex Mercer"
                  placeholderTextColor={theme.colors.placeholder}
                  autoCapitalize="words"
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>
            </View>

            {/* Email Address */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email Address</Text>
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
                  placeholder="e.g. alex@example.co.uk"
                  placeholderTextColor={theme.colors.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>
            </View>

            {/* Mobile Number */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Mobile Number</Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor: mobileError
                      ? '#EF4444'
                      : mobileFocused
                      ? activeBorderColor
                      : isDark
                      ? '#1E3852'
                      : '#E2E8F0',
                    backgroundColor: mobileFocused ? activeInputBg : inactiveInputBg,
                  },
                ]}
              >
                <View style={styles.iconBox}>
                  <PhoneIcon
                    size={20}
                    color={
                      mobileFocused
                        ? activeBorderColor
                        : mobileError
                        ? '#EF4444'
                        : theme.colors.placeholder
                    }
                  />
                </View>
                <TextInput
                  value={mobile}
                  onChangeText={(text) => {
                    setMobile(text);
                    setMobileError(false);
                    setErrorMessage(null);
                  }}
                  onFocus={() => setMobileFocused(true)}
                  onBlur={() => setMobileFocused(false)}
                  placeholder="e.g. 07700 900077"
                  placeholderTextColor={theme.colors.placeholder}
                  keyboardType="phone-pad"
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Password</Text>
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
                  placeholder="Min 6 characters"
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

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Confirm Password
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor: confirmPasswordError
                      ? '#EF4444'
                      : confirmPasswordFocused
                      ? activeBorderColor
                      : isDark
                      ? '#1E3852'
                      : '#E2E8F0',
                    backgroundColor: confirmPasswordFocused ? activeInputBg : inactiveInputBg,
                  },
                ]}
              >
                <View style={styles.iconBox}>
                  <LockCheckIcon
                    size={20}
                    color={
                      confirmPasswordFocused
                        ? activeBorderColor
                        : confirmPasswordError
                        ? '#EF4444'
                        : theme.colors.placeholder
                    }
                  />
                </View>
                <TextInput
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setConfirmPasswordError(false);
                    setErrorMessage(null);
                  }}
                  onFocus={() => setConfirmPasswordFocused(true)}
                  onBlur={() => setConfirmPasswordFocused(false)}
                  placeholder="Repeat your password"
                  placeholderTextColor={theme.colors.placeholder}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  style={[styles.input, { color: theme.colors.text }]}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon
                      size={20}
                      color={confirmPasswordFocused ? activeBorderColor : theme.colors.placeholder}
                    />
                  ) : (
                    <EyeIcon
                      size={20}
                      color={confirmPasswordFocused ? activeBorderColor : theme.colors.placeholder}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Garage Data Sharing Consent Card */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setGarageConsent(!garageConsent);
                if (!garageConsent) {
                  setConsentError(false);
                  setErrorMessage(null);
                }
              }}
              style={[
                styles.consentCard,
                {
                  backgroundColor: isDark ? '#0E2337' : '#F0F6FD',
                  borderColor: consentError
                    ? '#EF4444'
                    : garageConsent
                    ? (isDark ? '#38BDF8' : '#1677FF')
                    : isDark
                    ? '#1E3852'
                    : '#D9E6F5',
                },
              ]}
            >
              <View style={styles.consentHeader}>
                <CheckboxSvg
                  checked={garageConsent}
                  size={22}
                  color={isDark ? '#38BDF8' : '#1677FF'}
                  error={consentError}
                />
                <View style={styles.consentTitleWrapper}>
                  <ShieldCheckSvg size={18} color={isDark ? '#38BDF8' : '#1677FF'} />
                  <Text style={[styles.consentTitle, { color: theme.colors.text }]}>
                    Garage Communications & Data Sharing
                  </Text>
                </View>
              </View>

              <Text style={[styles.consentBodyText, { color: theme.colors.text }]}>
                I authorize Multiple MOT to share my{' '}
                <Text style={[styles.highlightText, { color: isDark ? '#38BDF8' : '#1677FF' }]}>
                  full name
                </Text>
                ,{' '}
                <Text style={[styles.highlightText, { color: isDark ? '#38BDF8' : '#1677FF' }]}>
                  mobile number
                </Text>
                , and{' '}
                <Text style={[styles.highlightText, { color: isDark ? '#38BDF8' : '#1677FF' }]}>
                  email
                </Text>{' '}
                with accredited MOT testing stations & garages for automated test expiry alerts, booking confirmations, and vehicle advisory notices.
              </Text>
            </TouchableOpacity>

            {/* Primary Sign Up Button */}
            <TouchableOpacity
              onPress={handleSignup}
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
                  <Text style={styles.buttonText}>Create Account</Text>
                  <ArrowRightIcon size={18} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Back to Sign In */}
          <View style={styles.footerSection}>
            <Text style={[styles.footerText, { color: theme.colors.placeholder }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              style={styles.signInPill}
            >
              <Text
                style={[
                  styles.signInLink,
                  { color: isDark ? '#38BDF8' : '#1677FF' },
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
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
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 32,
  },
  topNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  headerBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
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
    marginBottom: 14,
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
    height: 50,
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
  consentCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  consentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  consentTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  consentTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
    flex: 1,
  },
  consentBodyText: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.85,
    paddingLeft: 32,
  },
  highlightText: {
    fontWeight: '800',
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 22,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signInPill: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '800',
  },
});
