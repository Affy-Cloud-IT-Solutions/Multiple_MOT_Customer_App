import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';

export interface ServiceItem {
  id: string;
  title: string;
  keyword: string;
  category: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  description: string;
}

export const SERVICE_CATEGORIES = [
  'All',
  'MOT',
  'Servicing',
  'Tyres',
  'Repairs',
] as const;

export const POPULAR_SERVICES: ServiceItem[] = [
  {
    id: 'mot_test',
    title: 'MOT Test',
    keyword: 'MOT',
    category: 'MOT',
    icon: 'shield-check',
    iconColor: '#10B981',
    iconBg: '#10B98115',
    description: 'Class 4 annual DVSA vehicle MOT inspection',
  },
  {
    id: 'full_service',
    title: 'Full Service',
    keyword: 'Full Service',
    category: 'Servicing',
    icon: 'car-cog',
    iconColor: '#1677FF',
    iconBg: '#1677FF15',
    description: 'Comprehensive annual full car service',
  },
  {
    id: 'interim_service',
    title: 'Interim Service',
    keyword: 'Interim Service',
    category: 'Servicing',
    icon: 'oil',
    iconColor: '#8B5CF6',
    iconBg: '#8B5CF615',
    description: '6-month / 6,000 miles oil & filter inspection',
  },
  {
    id: 'major_service',
    title: 'Major Service',
    keyword: 'Major Service',
    category: 'Servicing',
    icon: 'car-wrench',
    iconColor: '#D97706',
    iconBg: '#F59E0B15',
    description: '24-month complete overhaul & spark plugs',
  },
  {
    id: 'brakes',
    title: 'Brakes & Discs',
    keyword: 'Brake',
    category: 'Brakes & Tyres',
    icon: 'car-brake-alert',
    iconColor: '#EF4444',
    iconBg: '#EF444415',
    description: 'Brake pads, discs inspection & replacement',
  },
  {
    id: 'tyres',
    title: 'Tyres & Tracking',
    keyword: 'Tyre',
    category: 'Brakes & Tyres',
    icon: 'tire',
    iconColor: '#F59E0B',
    iconBg: '#F59E0B15',
    description: 'Tyre fitting, balancing & wheel alignment',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics Scan',
    keyword: 'Diagnostic',
    category: 'Diagnostics',
    icon: 'engine',
    iconColor: '#06B6D4',
    iconBg: '#06B6D415',
    description: 'Engine ECU fault codes reading & diagnosis',
  },
  {
    id: 'air_con',
    title: 'Air Con Regas',
    keyword: 'Air Con',
    category: 'Diagnostics',
    icon: 'snowflake',
    iconColor: '#0284C7',
    iconBg: '#0284C715',
    description: 'Air conditioning recharge & gas pressure test',
  },
  {
    id: 'battery',
    title: 'Battery & Electrical',
    keyword: 'Battery',
    category: 'Diagnostics',
    icon: 'car-battery',
    iconColor: '#EA580C',
    iconBg: '#EA580C15',
    description: 'Battery testing, replacement & alternator check',
  },
  {
    id: 'clutch',
    title: 'Clutch & Gearbox',
    keyword: 'Clutch',
    category: 'Repairs',
    icon: 'cog-sync',
    iconColor: '#9333EA',
    iconBg: '#9333EA15',
    description: 'Clutch kit, dual mass flywheel & gearbox',
  },
  {
    id: 'suspension',
    title: 'Suspension & Steering',
    keyword: 'Suspension',
    category: 'Brakes & Tyres',
    icon: 'car-traction-control',
    iconColor: '#4F46E5',
    iconBg: '#4F46E515',
    description: 'Shock absorbers, coil springs & ball joints',
  },
  {
    id: 'exhaust',
    title: 'Exhaust & Emissions',
    keyword: 'Exhaust',
    category: 'Repairs',
    icon: 'smoke',
    iconColor: '#059669',
    iconBg: '#05966915',
    description: 'Exhaust repair, catalytic converter & DPF clean',
  },
  {
    id: 'repairs',
    title: 'General Repairs',
    keyword: 'Repair',
    category: 'Repairs',
    icon: 'wrench',
    iconColor: '#EC4899',
    iconBg: '#EC489915',
    description: 'General mechanical & electrical auto repairs',
  },
];

export const isServiceMatch = (service: any, filterKey: string): boolean => {
  if (!service || !filterKey) return false;
  // If service is explicitly deactivated, don't match
  if (service.isActive === false || service.isActive === 'false' || service.status === 'Inactive') return false;

  const key = filterKey.trim().toLowerCase();
  const name = (service.name || '').trim().toLowerCase();
  const category = (service.category || '').trim().toLowerCase();

  // 0. Direct case-insensitive equality (exact match for any custom service e.g. Service A, Service B, Service C)
  if (name === key) return true;

  // 1. MOT Specific matching (Word boundary or category, avoid matching words like 'motor' or descriptions)
  if (key === 'mot' || key === 'mot test' || /\bmot\b/i.test(key)) {
    const isMotCategory = category === 'mot';
    const isMotName = /\bmot\b/i.test(name) || name === 'mot' || name.includes('mot test');
    return isMotCategory || isMotName;
  }

  // 2. Full Service specific matching
  if (key.includes('full service') || key === 'full') {
    return name.includes('full') || category.includes('full');
  }

  // 3. Interim Service specific matching
  if (key.includes('interim')) {
    return name.includes('interim') || category.includes('interim');
  }

  // 4. Major Service specific matching
  if (key.includes('major')) {
    return name.includes('major') || category.includes('major');
  }

  // 5. Brake specific matching
  if (key.includes('brake')) {
    return name.includes('brake') || category.includes('brake');
  }

  // 6. Tyre / Tire specific matching
  if (key.includes('tyre') || key.includes('tire')) {
    return (
      name.includes('tyre') ||
      name.includes('tire') ||
      category.includes('tyre') ||
      category.includes('tire')
    );
  }

  // 7. Diagnostic specific matching
  if (key.includes('diag') || key.includes('scan')) {
    return name.includes('diag') || category.includes('diag') || name.includes('scan');
  }

  // 8. Air Con / AC specific matching
  if (key.includes('air') || key.includes('ac')) {
    return (
      name.includes('air') ||
      name.includes('ac') ||
      category.includes('air') ||
      category.includes('conditioning')
    );
  }

  // 9. Clutch / Gearbox
  if (key.includes('clutch') || key.includes('gear')) {
    return name.includes('clutch') || name.includes('gear') || category.includes('clutch');
  }

  // 10. Suspension / Steering
  if (key.includes('suspension') || key.includes('steering') || key.includes('shock')) {
    return name.includes('suspension') || name.includes('steering') || name.includes('shock') || category.includes('suspension');
  }

  // 11. Exhaust / Emission
  if (key.includes('exhaust') || key.includes('dpf') || key.includes('emission')) {
    return name.includes('exhaust') || name.includes('dpf') || category.includes('exhaust');
  }

  // 12. General match by name or category (case-insensitive)
  return (
    name.includes(key) ||
    key.includes(name) ||
    category.includes(key) ||
    key.includes(category)
  );
};

export interface FilterServiceBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedService?: string;
  selectedServiceTitle?: string;
  selectedServices?: string[];
  selectedServiceTitles?: string[];
  onSelectService?: (serviceKey: string, serviceTitle: string) => void;
  onApplyServices?: (serviceKeys: string[], serviceTitles: string[]) => void;
  garages?: any[];
}

export default function FilterServiceBottomSheet({
  visible,
  onClose,
  selectedService = '',
  selectedServiceTitle = '',
  selectedServices = [],
  selectedServiceTitles = [],
  onSelectService,
  onApplyServices,
  garages = [],
}: FilterServiceBottomSheetProps) {
  const { theme } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [tempSelected, setTempSelected] = useState<Array<{ keyword: string; title: string }>>([]);

  // Sync tempSelected whenever the bottom sheet opens or props change
  useEffect(() => {
    if (!visible) return;
    if (selectedServices && selectedServices.length > 0) {
      const items = selectedServices.map((key, idx) => ({
        keyword: key,
        title: (selectedServiceTitles && selectedServiceTitles[idx]) || key,
      }));
      setTempSelected(items);
    } else if (selectedService && selectedService.trim()) {
      setTempSelected([{
        keyword: selectedService.trim(),
        title: selectedServiceTitle || selectedService.trim(),
      }]);
    } else {
      setTempSelected([]);
    }
  }, [visible, selectedService, selectedServiceTitle, selectedServices, selectedServiceTitles]);

  // Count how many garages offer a given service
  const getGarageCountForService = useMemo(() => {
    const cache = new Map<string, number>();

    return (keyword: string) => {
      if (!keyword) return garages.length;
      if (cache.has(keyword)) return cache.get(keyword)!;

      const count = garages.filter((g) => {
        return (
          Array.isArray(g.services) &&
          g.services.some((s: any) => isServiceMatch(s, keyword))
        );
      }).length;

      cache.set(keyword, count);
      return count;
    };
  }, [garages]);

  // Merge static popular services with any custom services found in garages
  const allServices = useMemo(() => {
    const list: ServiceItem[] = [...POPULAR_SERVICES];
    const existingKeywords = new Set(
      POPULAR_SERVICES.map((s) => s.keyword.toLowerCase())
    );

    const resolveCategory = (name: string): string => {
      const n = name.toLowerCase();
      if (n.includes('mot')) return 'MOT';
      if (n.includes('service') || n.includes('oil')) return 'Servicing';
      if (n.includes('brake') || n.includes('tyre') || n.includes('tire') || n.includes('wheel') || n.includes('suspension')) return 'Brakes & Tyres';
      if (n.includes('diag') || n.includes('battery') || n.includes('air') || n.includes('ac') || n.includes('electric')) return 'Diagnostics';
      return 'Repairs';
    };

    garages.forEach((g) => {
      if (Array.isArray(g.services)) {
        g.services.forEach((s: any) => {
          const name = (s.name || '').trim();
          if (name && !existingKeywords.has(name.toLowerCase())) {
            existingKeywords.add(name.toLowerCase());
            list.push({
              id: `custom_${name.toLowerCase().replace(/\s+/g, '_')}`,
              title: name,
              keyword: name,
              category: resolveCategory(name),
              icon: 'wrench',
              iconColor: theme.colors.primary,
              iconBg: theme.colors.primary + '15',
              description: s.description || 'Specialized garage service',
            });
          }
        });
      }
    });

    return list;
  }, [garages, theme.colors.primary]);

  // Auto-switch category tab to match active selectedService if single
  useEffect(() => {
    if (!visible) return;
    const firstTarget = tempSelected[0]?.keyword || selectedService;
    if (!firstTarget) {
      setSelectedCategory('All');
      return;
    }
    const matched = allServices.find((s) =>
      isServiceMatch({ name: s.keyword, category: s.category }, firstTarget)
    );
    if (matched && matched.category) {
      setSelectedCategory(matched.category);
    }
  }, [selectedService, allServices, visible]);

  // Filter services list based on category tab and search query
  const filteredServices = useMemo(() => {
    let list = allServices;

    if (selectedCategory !== 'All') {
      list = list.filter((s) => s.category === selectedCategory);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.keyword.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allServices, selectedCategory, searchQuery]);

  // Check if a service keyword is currently in tempSelected
  const isItemSelected = (keyword: string) => {
    return tempSelected.some((item) =>
      item.keyword.toLowerCase().trim() === keyword.toLowerCase().trim() ||
      isServiceMatch({ name: keyword }, item.keyword)
    );
  };

  // Toggle selection for multiple services
  const toggleSelect = (keyword: string, title: string) => {
    setTempSelected((prev) => {
      const exists = prev.some((item) =>
        item.keyword.toLowerCase().trim() === keyword.toLowerCase().trim() ||
        isServiceMatch({ name: keyword }, item.keyword)
      );
      if (exists) {
        return prev.filter((item) =>
          item.keyword.toLowerCase().trim() !== keyword.toLowerCase().trim() &&
          !isServiceMatch({ name: keyword }, item.keyword)
        );
      } else {
        return [...prev, { keyword, title }];
      }
    });
  };

  // Count garages matching the current tempSelected filter
  const matchingGaragesCount = useMemo(() => {
    if (tempSelected.length === 0) return garages.length;
    const keys = tempSelected.map((s) => s.keyword);
    const hasOfferingAll = garages.some((g) =>
      Array.isArray(g.services) && keys.every((k) => g.services.some((s: any) => isServiceMatch(s, k)))
    );
    if (hasOfferingAll) {
      return garages.filter((g) =>
        Array.isArray(g.services) && keys.every((k) => g.services.some((s: any) => isServiceMatch(s, k)))
      ).length;
    }
    return garages.filter((g) =>
      Array.isArray(g.services) && keys.some((k) => g.services.some((s: any) => isServiceMatch(s, k)))
    ).length;
  }, [tempSelected, garages]);

  const handleApply = () => {
    const keys = tempSelected.map((s) => s.keyword);
    const titles = tempSelected.map((s) => s.title);
    if (onApplyServices) {
      onApplyServices(keys, titles);
    }
    if (onSelectService) {
      onSelectService(keys.join(','), titles.join(', '));
    }
    onClose();
  };

  const handleClearAll = () => {
    setTempSelected([]);
    if (onApplyServices) {
      onApplyServices([], []);
    }
    if (onSelectService) {
      onSelectService('', '');
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheetWrapper}
            >
              <View
                style={[
                  styles.sheetContent,
                  {
                    backgroundColor: theme.colors.card,
                    borderTopColor: theme.colors.border,
                  },
                ]}
              >
                {/* Drag Handle Bar */}
                <View style={styles.handleBar} />

                {/* Header */}
                <View style={styles.headerRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View
                      style={[
                        styles.headerIconCircle,
                        { backgroundColor: theme.colors.primary + '18' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="filter-variant"
                        size={18}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                        Filter by Service
                      </Text>
                      <Text
                        style={[styles.headerSubtitle, { color: theme.colors.placeholder }]}
                        numberOfLines={1}
                      >
                        {tempSelected.length > 0
                          ? `${tempSelected.length} ${tempSelected.length === 1 ? 'service' : 'services'} selected • Tap Apply below`
                          : 'Select one or more services to filter'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {tempSelected.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setTempSelected([])}
                        style={[
                          styles.resetBtn,
                          { backgroundColor: theme.colors.primary + '15' },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text
                          style={[styles.resetBtnText, { color: theme.colors.primary }]}
                        >
                          Clear
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={onClose}
                      style={[
                        styles.closeBtn,
                        { backgroundColor: theme.colors.border + '60' },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={18}
                        color={theme.colors.text}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Search Box within Bottomsheet */}
                <View
                  style={[
                    styles.searchBox,
                    {
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="magnify"
                    size={18}
                    color={theme.colors.placeholder}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    placeholder="Search services (Full Service, MOT, Brakes)..."
                    placeholderTextColor={theme.colors.placeholder}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={16}
                        color={theme.colors.placeholder}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Border-Radius Category Tabs Bar */}
                <View style={styles.categoryContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryScroll}
                  >
                    {SERVICE_CATEGORIES.map((cat) => {
                      const isActive = selectedCategory === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setSelectedCategory(cat)}
                          style={[
                            styles.categoryTab,
                            {
                              backgroundColor: isActive
                                ? theme.colors.primary
                                : theme.colors.card,
                              borderColor: isActive
                                ? theme.colors.primary
                                : theme.colors.border,
                            },
                          ]}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.categoryTabText,
                              {
                                color: isActive ? '#FFFFFF' : theme.colors.text,
                                fontWeight: isActive ? '700' : '500',
                              },
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Services List - Clean, compact border-radius tab rows */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollList}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Option: All Services (Show all garages) */}
                  {selectedCategory === 'All' && !searchQuery.trim() && (
                    <TouchableOpacity
                      style={[
                        styles.serviceItemTab,
                        {
                          backgroundColor: tempSelected.length === 0
                            ? theme.colors.primary + '10'
                            : theme.colors.background,
                          borderColor: tempSelected.length === 0
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={handleClearAll}
                    >
                      <View
                        style={[
                          styles.serviceIconWrap,
                          {
                            backgroundColor: tempSelected.length === 0
                              ? theme.colors.primary + '20'
                              : theme.colors.secondary + '15',
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="apps"
                          size={18}
                          color={
                            tempSelected.length === 0
                              ? theme.colors.primary
                              : theme.colors.secondary
                          }
                        />
                      </View>

                      <View style={styles.serviceTextCol}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text
                            style={[
                              styles.serviceTitle,
                              {
                                color: tempSelected.length === 0
                                  ? theme.colors.primary
                                  : theme.colors.text,
                              },
                            ]}
                          >
                            All Garages (No Filter)
                          </Text>
                          {tempSelected.length === 0 && (
                            <View
                              style={[
                                styles.activeBadge,
                                { backgroundColor: theme.colors.primary + '20' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.activeBadgeText,
                                  { color: theme.colors.primary },
                                ]}
                              >
                                Active
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.rightCol}>
                        <View
                          style={[
                            styles.countChip,
                            { backgroundColor: theme.colors.secondary + '15' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.countChipText,
                              { color: theme.colors.secondary },
                            ]}
                          >
                            {garages.length}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.multiCheckbox,
                            {
                              borderColor: tempSelected.length === 0
                                ? theme.colors.primary
                                : theme.colors.border,
                              backgroundColor: tempSelected.length === 0
                                ? theme.colors.primary
                                : 'transparent',
                            },
                          ]}
                        >
                          {tempSelected.length === 0 && (
                            <MaterialCommunityIcons
                              name="check"
                              size={12}
                              color="#FFFFFF"
                            />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Filtered Services List */}
                  {filteredServices.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <MaterialCommunityIcons
                        name="tools"
                        size={32}
                        color={theme.colors.placeholder}
                        style={{ marginBottom: 6 }}
                      />
                      <Text
                        style={[
                          styles.emptyText,
                          { color: theme.colors.placeholder },
                        ]}
                      >
                        No services found in "{selectedCategory}"
                      </Text>
                    </View>
                  ) : (
                    filteredServices.map((item) => {
                      const isSelected = isItemSelected(item.keyword);
                      const count = getGarageCountForService(item.keyword);

                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.serviceItemTab,
                            {
                              backgroundColor: isSelected
                                ? theme.colors.primary + '10'
                                : theme.colors.background,
                              borderColor: isSelected
                                ? theme.colors.primary
                                : theme.colors.border,
                            },
                          ]}
                          activeOpacity={0.7}
                          onPress={() => toggleSelect(item.keyword, item.title)}
                        >
                          <View
                            style={[
                              styles.serviceIconWrap,
                              { backgroundColor: item.iconBg },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={item.icon as any}
                              size={18}
                              color={item.iconColor}
                            />
                          </View>

                          <View style={styles.serviceTextCol}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text
                                style={[
                                  styles.serviceTitle,
                                  {
                                    color: isSelected
                                      ? theme.colors.primary
                                      : theme.colors.text,
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {item.title}
                              </Text>
                              {isSelected && (
                                <View
                                  style={[
                                    styles.activeBadge,
                                    { backgroundColor: theme.colors.primary + '20' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.activeBadgeText,
                                      { color: theme.colors.primary },
                                    ]}
                                  >
                                    Selected
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={styles.rightCol}>
                            <View
                              style={[
                                styles.countChip,
                                {
                                  backgroundColor:
                                    count > 0
                                      ? theme.colors.secondary + '15'
                                      : theme.colors.border + '40',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.countChipText,
                                  {
                                    color:
                                      count > 0
                                        ? theme.colors.secondary
                                        : theme.colors.placeholder,
                                  },
                                ]}
                              >
                                {count} {count === 1 ? 'garage' : 'garages'}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.multiCheckbox,
                                {
                                  borderColor: isSelected
                                    ? theme.colors.primary
                                    : theme.colors.border,
                                  backgroundColor: isSelected
                                    ? theme.colors.primary
                                    : 'transparent',
                                },
                              ]}
                            >
                              {isSelected && (
                                <MaterialCommunityIcons
                                  name="check"
                                  size={12}
                                  color="#FFFFFF"
                                />
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                {/* Sticky Action Footer */}
                <View style={[styles.sheetFooterBar, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                  <TouchableOpacity
                    style={[styles.sheetApplyBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={handleApply}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="filter-check" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.sheetApplyText}>
                      {tempSelected.length === 0
                        ? `Show All Garages (${garages.length})`
                        : `Apply (${tempSelected.length} Selected) • ${matchingGaragesCount} ${matchingGaragesCount === 1 ? 'Garage' : 'Garages'}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

import { fonts } from '../theme/theme';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    width: '100%',
    maxHeight: '78%',
  },
  multiCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 6,
    gap: 10,
  },
  sheetResetBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetResetText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  sheetApplyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  sheetApplyText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  sheetContent: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    maxHeight: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 11,
    marginTop: 1,
  },
  resetBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resetBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
  },
  searchInput: {
    fontFamily: fonts.regular,
    flex: 1,
    fontSize: 12.5,
    paddingVertical: 0,
  },
  categoryContainer: {
    marginBottom: 10,
  },
  categoryScroll: {
    gap: 6,
    paddingHorizontal: 2,
  },
  categoryTab: {
    paddingHorizontal: 13,
    paddingVertical: 5.5,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabText: {
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
  },
  scrollList: {
    paddingBottom: 24,
  },
  serviceItemTab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  serviceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 9,
  },
  serviceTextCol: {
    flex: 1,
    marginRight: 6,
  },
  serviceTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  activeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  activeBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    textAlign: 'center',
  },
});
