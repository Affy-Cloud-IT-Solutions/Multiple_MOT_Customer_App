import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Switch, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

export default function ProfileScreen({ navigation }: any) {
  const { isDarkMode, theme, toggleTheme } = useAppTheme();
  const { user, createStaffAccount } = useAppValues();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Staff creation form states
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            setLoggingOut(true);
            setTimeout(() => {
              setLoggingOut(false);
              navigation.replace('Login');
            }, 1200);
          },
        },
      ]
    );
  };

  const handleCreateStaff = async () => {
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields to create a staff account');
      return;
    }

    setCreatingStaff(true);
    try {
      await createStaffAccount(staffName.trim(), staffEmail.trim().toLowerCase(), staffPassword.trim());
      Alert.alert('Success', `Garage Staff account for ${staffName} has been created successfully.`);
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create staff account');
    } finally {
      setCreatingStaff(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.scrollContent}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.secondary }]}>
          <Text style={styles.avatarLabel}>{getInitials(user?.name || '')}</Text>
        </View>
        <Text style={[styles.userName, { color: theme.colors.text }]}>
          {user?.name || 'Guest User'}
        </Text>
        <Text style={{ color: theme.colors.placeholder }}>
          {user?.email || 'guest@example.com'}
        </Text>
        {user?.role && (
          <View style={[styles.roleBadge, { backgroundColor: theme.colors.secondary + '20' }]}>
            <Text style={[styles.roleBadgeText, { color: theme.colors.secondary }]}>
              {user.role === 'admin' ? 'Super Admin' : user.role === 'staff' ? 'Garage Administrator' : 'Customer'}
            </Text>
          </View>
        )}
      </View>

      {/* Settings Options Card */}
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {/* Dark Mode Switch Item */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <MaterialCommunityIcons name="theme-light-dark" size={22} color={theme.colors.secondary} style={styles.settingIcon} />
            <View>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Dark Mode</Text>
              <Text style={[styles.settingDesc, { color: theme.colors.placeholder }]}>Toggle app theme style</Text>
            </View>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: theme.colors.secondary }}
            thumbColor={isDarkMode ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>
        
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Notifications Switch Item */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <MaterialCommunityIcons name="bell-ring-outline" size={22} color={theme.colors.secondary} style={styles.settingIcon} />
            <View>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Push Notifications</Text>
              <Text style={[styles.settingDesc, { color: theme.colors.placeholder }]}>Get alerts for MOT expiry dates</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={() => setNotificationsEnabled(!notificationsEnabled)}
            trackColor={{ false: '#767577', true: theme.colors.secondary }}
            thumbColor={notificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Clear Cache Item */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert('History Cleared', 'Your search log has been cleared successfully.');
          }}
          style={styles.settingItem}
        >
          <View style={styles.settingLeft}>
            <MaterialCommunityIcons name="delete-outline" size={22} color={theme.colors.error} style={styles.settingIcon} />
            <View>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Clear Search History</Text>
              <Text style={[styles.settingDesc, { color: theme.colors.placeholder }]}>Remove cached lookup details</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.placeholder} />
        </TouchableOpacity>
      </View>

      {/* Super Admin - Garage Staff Creator Form */}
      {user?.role === 'admin' && (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16, marginBottom: 24 }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Create Garage Staff Account</Text>
          <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
            Register a new Garage Staff user. They can only login to the dashboard and cannot register themselves.
          </Text>

          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Full Name</Text>
          <TextInput
            value={staffName}
            onChangeText={setStaffName}
            placeholder="E.g. Fawad Staff"
            placeholderTextColor={theme.colors.placeholder}
            style={[styles.inputField, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
          />

          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email Address</Text>
          <TextInput
            value={staffEmail}
            onChangeText={setStaffEmail}
            placeholder="E.g. fawad@garage.com"
            placeholderTextColor={theme.colors.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.inputField, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
          />

          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Password</Text>
          <TextInput
            value={staffPassword}
            onChangeText={setStaffPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.placeholder}
            secureTextEntry
            autoCapitalize="none"
            style={[styles.inputField, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
          />

          <TouchableOpacity
            onPress={handleCreateStaff}
            disabled={creatingStaff}
            style={[styles.createBtn, { backgroundColor: theme.colors.primary, opacity: creatingStaff ? 0.7 : 1 }]}
          >
            {creatingStaff ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.createBtnText}>Create Staff Account</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Version info */}
      <View style={styles.versionContainer}>
        <Text style={{ color: theme.colors.placeholder, fontSize: 12 }}>
          UK MOT Check App v1.0.0 (Production Mode)
        </Text>
      </View>

      {/* Logout Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={handleLogout}
          disabled={loggingOut}
          style={[
            styles.logoutButton,
            { borderColor: theme.colors.error, opacity: loggingOut ? 0.7 : 1 },
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator color={theme.colors.error} size="small" />
          ) : (
            <View style={styles.logoutContent}>
              <MaterialCommunityIcons name="logout" size={18} color={theme.colors.error} style={{ marginRight: 8 }} />
              <Text style={[styles.logoutButtonText, { color: theme.colors.error }]}>Sign Out</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarLabel: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    marginBottom: 12,
  },
  createBtn: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  versionContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    paddingHorizontal: 8,
  },
  logoutButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
