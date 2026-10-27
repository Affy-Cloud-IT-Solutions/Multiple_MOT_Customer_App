import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import CustomerPortalScreen from '../screens/CustomerPortalScreen';
import BookingScreen from '../screens/BookingScreen';
import BookedMotsScreen from '../screens/BookedMotsScreen';
import StaffListScreen from '../screens/StaffListScreen';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import AdminBookMotScreen from '../screens/AdminBookMotScreen';
import MainTabNavigator from './MainTabNavigator';
import GarageListScreen from '../screens/GarageListScreen';
import GarageDetailScreen from '../screens/GarageDetailScreen';
import ResultScreen from '../screens/ResultScreen';
import MotHistoryScreen from '../screens/MotHistoryScreen';
import BookingsScreen from '../screens/BookingsScreen';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme/theme';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName="Main"
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.colors.card,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontFamily: fonts.bold,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerPortal"
        component={CustomerPortalScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BookedMots"
        component={BookedMotsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminBookMot"
        component={AdminBookMotScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StaffList"
        component={StaffListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerDetail"
        component={CustomerDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GarageList"
        component={GarageListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Garages"
        component={GarageListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GarageDetail"
        component={GarageDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Result"
        component={ResultScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MotHistory"
        component={MotHistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="History"
        component={BookingsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
