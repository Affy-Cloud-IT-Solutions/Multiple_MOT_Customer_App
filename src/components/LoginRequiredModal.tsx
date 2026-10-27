import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';

interface LoginRequiredModalProps {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  title?: string;
  message?: string;
}

const { width } = Dimensions.get('window');

export default function LoginRequiredModal({
  visible,
  onClose,
  onLogin,
  title = 'Please Login First',
  message = 'You need to be logged in to book an appointment. Please sign in to your customer account to continue.',
}: LoginRequiredModalProps) {
  const { theme } = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {/* Icon Circle */}
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.colors.primary + '18' },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-lock-outline"
                  size={36}
                  color={theme.colors.primary}
                />
              </View>

              {/* Title & Description */}
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {title}
              </Text>
              <Text
                style={[styles.message, { color: theme.colors.placeholder }]}
              >
                {message}
              </Text>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.loginBtn,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => {
                    onClose();
                    onLogin();
                  }}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons
                    name="login-variant"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.loginBtnText}>Log In Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { borderColor: theme.colors.border },
                  ]}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cancelBtnText,
                      { color: theme.colors.placeholder },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

import { fonts } from '../theme/theme';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: Math.min(width - 48, 380),
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  loginBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  loginBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  cancelBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
});
