import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import HomeScreen from '../screens/HomeScreen';
import GarageListScreen from '../screens/GarageListScreen';
import BookingsScreen from '../screens/BookingsScreen';
import CustomerPortalScreen from '../screens/CustomerPortalScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAppTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { theme } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'home-variant';

          if (route.name === 'Home') {
            iconName = focused ? 'home-variant' : 'home-variant-outline';
          } else if (route.name === 'Garages') {
            iconName = focused ? 'storefront' : 'storefront-outline';
          } else if (route.name === 'Bookings' || route.name === 'History') {
            iconName = focused ? 'calendar-check' : 'calendar-check-outline';
          } else if (route.name === 'My Portal') {
            iconName = focused ? 'car-wrench' : 'car-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'account-circle' : 'account-circle-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={24} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.secondary,
        tabBarInactiveTintColor: theme.colors.placeholder,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          elevation: 8,
          shadowOpacity: 0.1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontWeight: 'bold',
          fontSize: 11,
        },
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 2,
          shadowOpacity: 0.05,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Home', tabBarLabel: 'Home', headerShown: false }} 
      />
      <Tab.Screen 
        name="Garages" 
        component={GarageListScreen} 
        options={{ title: 'Garages', tabBarLabel: 'Garages', headerShown: false }} 
      />
      <Tab.Screen 
        name="Bookings" 
        component={BookingsScreen} 
        options={{ title: 'Bookings', tabBarLabel: 'Bookings', headerShown: false }} 
      />
      <Tab.Screen 
        name="My Portal" 
        component={CustomerPortalScreen} 
        options={{ title: 'Vehicles', tabBarLabel: 'Vehicles', headerShown: false }} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'Profile', tabBarLabel: 'Profile', headerShown: false }} 
      />
    </Tab.Navigator>
  );
}
