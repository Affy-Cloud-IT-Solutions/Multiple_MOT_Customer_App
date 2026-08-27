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
import { useAppValues, BASE_URL } from '../context/DataContext';
import { validateEmail, validatePassword } from '../utils/validationUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  React.useEffect(() => {
    const checkPersistedSession = async () => {
      setLoading(true);
      try {
        const storedToken = await AsyncStorage.getItem('user_token');
        const storedUserJson = await AsyncStorage.getItem('user_profile');
        if (storedToken && storedUserJson) {
          const storedUser = JSON.parse(storedUserJson);
          setToken(storedToken);
          setUser(storedUser);
          
          if (storedUser.role === 'admin' || storedUser.role === 'staff' || storedUser.role === 'customer') {
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
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: password.trim() })
      });
      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
        return;
      }

      setToken(data.token);
      setUser(data.user);

      if (data.user?.role === 'admin' || data.user?.role === 'staff' || data.user?.role === 'customer') {
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo and Brand */}
        <View style={styles.headerContainer}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="car-shield" size={44} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            MOT Reminders
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            Garage MOT Reminder Management System
          </Text>
        </View>

        {/* Login Form Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.portalHeading, { color: theme.colors.text }]}>Sign In</Text>

            {errorMessage && (
              <View style={[styles.errorContainer, { borderColor: theme.colors.error + '40', backgroundColor: theme.colors.error + '10' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMessage}</Text>
              </View>
            )}
            
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
                placeholder="E.g. user@example.com"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, { color: theme.colors.text }]}
              />
            </View>

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

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[
                styles.button,
                { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Link to Registration */}
        <View style={styles.footerContainer}>
          <Text style={{ color: theme.colors.placeholder }}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={[styles.signupText, { color: theme.colors.primary }]}>Sign Up</Text>
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
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
  portalHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
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
  signupText: {
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
