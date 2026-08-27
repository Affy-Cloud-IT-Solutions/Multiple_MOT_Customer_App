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
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { BASE_URL } from '../context/DataContext';
import {
  validateFirstName,
  validateLastName,
  validatePhoneNumber,
  validateEmail,
  validatePassword
} from '../utils/validationUtils';

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
      setErrorMessage('Last name is required. Please enter a full name.');
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
          mobile: mobile.trim()
        })
      });
      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        Alert.alert('Signup Failed', data.error || 'Failed to create account');
        return;
      }

      Alert.alert(
        'Success',
        'Account created successfully! Please log in.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      setLoading(false);
      console.error('Signup error:', error);
      Alert.alert('Connection Error', 'Could not connect to the backend server.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Create Account
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            Sign up to track and check vehicle histories
          </Text>
        </View>

        {/* Signup Form Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>

          {errorMessage && (
            <View style={[styles.errorContainer, { borderColor: theme.colors.error + '40', backgroundColor: theme.colors.error + '10' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMessage}</Text>
            </View>
          )}

          {/* Full Name */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Full Name</Text>
          <View style={[
            styles.inputContainer, 
            { 
              borderColor: nameError 
                ? theme.colors.error 
                : nameFocused 
                ? (theme.dark ? theme.colors.secondary : theme.colors.primary) 
                : theme.colors.border, 
              backgroundColor: theme.colors.background 
            }
          ]}>
            <MaterialCommunityIcons name="account-outline" size={20} color={nameFocused ? (theme.dark ? theme.colors.secondary : theme.colors.primary) : theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                setNameError(false);
                setErrorMessage(null);
              }}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              placeholder="E.g. Alex Mercer"
              placeholderTextColor={theme.colors.placeholder}
              autoCapitalize="words"
              style={[styles.input, { color: theme.colors.text }]}
            />
          </View>

          {/* Email */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email Address</Text>
          <View style={[
            styles.inputContainer, 
            { 
              borderColor: emailError 
                ? theme.colors.error 
                : emailFocused 
                ? (theme.dark ? theme.colors.secondary : theme.colors.primary) 
                : theme.colors.border, 
              backgroundColor: theme.colors.background 
            }
          ]}>
            <MaterialCommunityIcons name="email-outline" size={20} color={emailFocused ? (theme.dark ? theme.colors.secondary : theme.colors.primary) : theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError(false);
                setErrorMessage(null);
              }}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="E.g. alex@example.com"
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, { color: theme.colors.text }]}
            />
          </View>

          {/* Mobile Number */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Mobile Number</Text>
          <View style={[
            styles.inputContainer, 
            { 
              borderColor: mobileError 
                ? theme.colors.error 
                : mobileFocused 
                ? (theme.dark ? theme.colors.secondary : theme.colors.primary) 
                : theme.colors.border, 
              backgroundColor: theme.colors.background 
            }
          ]}>
            <MaterialCommunityIcons name="phone-outline" size={20} color={mobileFocused ? (theme.dark ? theme.colors.secondary : theme.colors.primary) : theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={mobile}
              onChangeText={(text) => {
                setMobile(text);
                setMobileError(false);
                setErrorMessage(null);
              }}
              onFocus={() => setMobileFocused(true)}
              onBlur={() => setMobileFocused(false)}
              placeholder="E.g. 07700 900077"
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="phone-pad"
              style={[styles.input, { color: theme.colors.text }]}
            />
          </View>

          {/* Password */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Password</Text>
          <View style={[
            styles.inputContainer, 
            { 
              borderColor: passwordError 
                ? theme.colors.error 
                : passwordFocused 
                ? (theme.dark ? theme.colors.secondary : theme.colors.primary) 
                : theme.colors.border, 
              backgroundColor: theme.colors.background 
            }
          ]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={passwordFocused ? (theme.dark ? theme.colors.secondary : theme.colors.primary) : theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError(false);
                setErrorMessage(null);
              }}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.placeholder}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.input, { color: theme.colors.text }]}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={passwordFocused ? (theme.dark ? theme.colors.secondary : theme.colors.primary) : theme.colors.placeholder}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Confirm Password</Text>
          <View style={[
            styles.inputContainer, 
            { 
              borderColor: confirmPasswordError 
                ? theme.colors.error 
                : confirmPasswordFocused 
                ? (theme.dark ? theme.colors.secondary : theme.colors.primary) 
                : theme.colors.border, 
              backgroundColor: theme.colors.background 
            }
          ]}>
            <MaterialCommunityIcons name="lock-check-outline" size={20} color={confirmPasswordFocused ? (theme.dark ? theme.colors.secondary : theme.colors.primary) : theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setConfirmPasswordError(false);
                setErrorMessage(null);
              }}
              onFocus={() => setConfirmPasswordFocused(true)}
              onBlur={() => setConfirmPasswordFocused(false)}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.placeholder}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              style={[styles.input, { color: theme.colors.text }]}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
              <MaterialCommunityIcons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={confirmPasswordFocused ? (theme.dark ? theme.colors.secondary : theme.colors.primary) : theme.colors.placeholder}
              />
            </TouchableOpacity>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            onPress={handleSignup}
            disabled={loading}
            style={[
              styles.button,
              { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={{ color: theme.colors.placeholder }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.loginText, { color: theme.colors.primary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    padding: 0,
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  loginText: {
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
});
