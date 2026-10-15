import React, { useState, useMemo } from 'react';
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
  icon: string;
  iconColor: string;
  iconBg: string;
  description: string;
}

export const POPULAR_SERVICES: ServiceItem[] = [
  {
    id: 'mot_test',
    title: 'MOT Test',
    keyword: 'MOT',
    icon: 'shield-check',
    iconColor: '#10B981',
    iconBg: '#10B98115',
    description: 'Class 4 annual DVSA vehicle MOT inspection',
  },
  {
    id: 'full_service',
    title: 'Full Service',
    keyword: 'Full Service',
    icon: 'car-cog',
    iconColor: '#1677FF',
    iconBg: '#1677FF15',
    description: 'Comprehensive annual full car service',
  },
  {
    id: 'interim_service',
    title: 'Interim Service',
    keyword: 'Interim Service',
    icon: 'oil',
    iconColor: '#8B5CF6',
    iconBg: '#8B5CF615',
    description: '6-month / 6,000 miles oil & filter inspection',
  },
  {
    id: 'major_service',
    title: 'Major Service',
    keyword: 'Major Service',
    icon: 'car-wrench',
    iconColor: '#D97706',
    iconBg: '#F59E0B15',
    description: '24-month complete overhaul & spark plugs',
  },
  {
    id: 'brakes',
    title: 'Brakes & Discs',
    keyword: 'Brake',
    icon: 'car-brake-alert',
    iconColor: '#EF4444',
    iconBg: '#EF444415',
    description: 'Brake pads, discs inspection & replacement',
  },
  {
    id: 'tyres',
    title: 'Tyres & Tracking',
    keyword: 'Tyre',
    icon: 'tire',
    iconColor: '#F59E0B',
    iconBg: '#F59E0B15',
    description: 'Tyre fitting, balancing & wheel alignment',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics Scan',
    keyword: 'Diagnostic',
    icon: 'engine',
    iconColor: '#06B6D4',
    iconBg: '#06B6D415',
    description: 'Engine ECU fault codes reading & diagnosis',
  },
  {
    id: 'air_con',
    title: 'Air Con Regas',
    keyword: 'Air Con',
    icon: 'snowflake',
    iconColor: '#0284C7',
    iconBg: '#0284C715',
    description: 'Air conditioning recharge & gas pressure test',
  },
  {
    id: 'battery',
    title: 'Battery & Electrical',
    keyword: 'Battery',
    icon: 'car-battery',
    iconColor: '#EA580C',
    iconBg: '#EA580C15',
    description: 'Battery testing, replacement & alternator check',
  },
  {
    id: 'clutch',
    title: 'Clutch & Gearbox',
    keyword: 'Clutch',
    icon: 'cog-sync',
    iconColor: '#9333EA',
    iconBg: '#9333EA15',
    description: 'Clutch kit, dual mass flywheel & gearbox',
  },
  {
    id: 'suspension',
    title: 'Suspension & Steering',
    keyword: 'Suspension',
    icon: 'car-traction-control',
    iconColor: '#4F46E5',
    iconBg: '#4F46E515',
    description: 'Shock absorbers, coil springs & ball joints',
  },
  {
    id: 'exhaust',
    title: 'Exhaust & Emissions',
    keyword: 'Exhaust',
    icon: 'smoke',
    iconColor: '#059669',
    iconBg: '#05966915',
    description: 'Exhaust repair, catalytic converter & DPF clean',
  },
  {
    id: 'repairs',
    title: 'General Repairs',
    keyword: 'Repair',
    icon: 'wrench',
    iconColor: '#EC4899',
    iconBg: '#EC489915',
    description: 'General mechanical & electrical auto repairs',
  },
];

export const isServiceMatch = (service: any, filterKey: string): boolean => {
  if (!service || service.isActive === false || !filterKey) return false;

  const key = filterKey.trim().toLowerCase();
  const name = (service.name || '').trim().toLowerCase();
  const category = (service.category || '').trim().toLowerCase();

  // 1. MOT Specific matching (Word boundary or category, avoid matching words like 'motor' or descriptions)
  if (key === 'mot' || key === 'mot test' || key.includes('mot')) {
    const isMotCategory = category === 'mot';
    const isMotName = /\bmot\b/i.test(name) || name === 'mot' || name.includes('mot test');
    return isMotCategory || isMotName;
  }

  // 2. Full Service / Interim Service / Major Service specific matching
  if (key.includes('full service')) {
    return name.includes('full') || category.includes('full');
  }
  if (key.includes('interim')) {
    return name.includes('interim') || category.includes('interim');
  }
  if (key.includes('major')) {
    return name.includes('major') || category.includes('major');
  }
  if (key.includes('brake')) {
    return name.includes('brake') || category.includes('brake');
  }
  if (key.includes('tyre')) {
    return (
      name.includes('tyre') ||
      name.includes('tire') ||
      category.includes('tyre') ||
      category.includes('tire')
    );
  }
  if (key.includes('diagnostic')) {
    return name.includes('diag') || category.includes('diag');
  }
  if (key.includes('air') || key.includes('ac')) {
    return (
      name.includes('air') ||
      name.includes('ac') ||
      category.includes('air') ||
      category.includes('conditioning')
    );
  }

  // 3. General match by name or category
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
  selectedService: string;
  selectedServiceTitle?: string;
  onSelectService: (serviceKey: string, serviceTitle: string) => void;
  garages?: any[];
}

export default function FilterServiceBottomSheet({
  visible,
  onClose,
  selectedService,
  selectedServiceTitle,
  onSelectService,
  garages = [],
}: FilterServiceBottomSheetProps) {
  const { theme } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter services list based on internal search query
  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allServices;

    return allServices.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.keyword.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [allServices, searchQuery]);

  const handleSelect = (serviceKey: string, serviceTitle: string) => {
    onSelectService(serviceKey, serviceTitle);
    onClose();
  };

  const handleClear = () => {
    onSelectService('', '');
    onClose();
  };

  const isCurrentSelection = (keyword: string) => {
    if (!selectedService && !keyword) return true;
    if (!selectedService || !keyword) return false;
    return selectedService.toLowerCase().trim() === keyword.toLowerCase().trim();
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
                        size={20}
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
                        Find certified garages offering specific services
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {Boolean(selectedService) && (
                      <TouchableOpacity
                        onPress={handleClear}
                        style={[
                          styles.resetBtn,
                          { backgroundColor: theme.colors.primary + '15' },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text
                          style={[styles.resetBtnText, { color: theme.colors.primary }]}
                        >
                          Reset
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
                    size={20}
                    color={theme.colors.placeholder}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    placeholder="Search service (e.g. MOT, Brakes, Service)..."
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
                        size={18}
                        color={theme.colors.placeholder}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Services List */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollList}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Option: All Services (Show all garages) */}
                  {!searchQuery.trim() && (
                    <TouchableOpacity
                      style={[
                        styles.serviceItem,
                        {
                          backgroundColor: !selectedService
                            ? theme.colors.primary + '10'
                            : theme.colors.background,
                          borderColor: !selectedService
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={handleClear}
                    >
                      <View
                        style={[
                          styles.serviceIconWrap,
                          {
                            backgroundColor: !selectedService
                              ? theme.colors.primary + '20'
                              : theme.colors.secondary + '15',
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="apps"
                          size={20}
                          color={
                            !selectedService
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
                                color: !selectedService
                                  ? theme.colors.primary
                                  : theme.colors.text,
                              },
                            ]}
                          >
                            All Services
                          </Text>
                          {!selectedService && (
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
                        <Text
                          style={[
                            styles.serviceDesc,
                            { color: theme.colors.placeholder },
                          ]}
                          numberOfLines={1}
                        >
                          Show all registered garages without service filter
                        </Text>
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
                            {garages.length} Garages
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.radioCircle,
                            {
                              borderColor: !selectedService
                                ? theme.colors.primary
                                : theme.colors.border,
                              backgroundColor: !selectedService
                                ? theme.colors.primary
                                : 'transparent',
                            },
                          ]}
                        >
                          {!selectedService && (
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

                  {/* Section Title */}
                  <View style={styles.sectionHeaderRow}>
                    <Text
                      style={[
                        styles.sectionHeading,
                        { color: theme.colors.placeholder },
                      ]}
                    >
                      {searchQuery.trim()
                        ? `Search Results (${filteredServices.length})`
                        : 'Available Services'}
                    </Text>
                  </View>

                  {/* Filtered Services */}
                  {filteredServices.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <MaterialCommunityIcons
                        name="tools"
                        size={36}
                        color={theme.colors.placeholder}
                        style={{ marginBottom: 6 }}
                      />
                      <Text
                        style={[
                          styles.emptyText,
                          { color: theme.colors.placeholder },
                        ]}
                      >
                        No services found matching "{searchQuery}"
                      </Text>
                    </View>
                  ) : (
                    filteredServices.map((item) => {
                      const isSelected = isCurrentSelection(item.keyword);
                      const count = getGarageCountForService(item.keyword);

                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.serviceItem,
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
                          onPress={() => handleSelect(item.keyword, item.title)}
                        >
                          <View
                            style={[
                              styles.serviceIconWrap,
                              { backgroundColor: item.iconBg },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={item.icon}
                              size={20}
                              color={item.iconColor}
                            />
                          </View>

                          <View style={styles.serviceTextCol}>
                            <View
                              style={{ flexDirection: 'row', alignItems: 'center' }}
                            >
                              <Text
                                style={[
                                  styles.serviceTitle,
                                  {
                                    color: isSelected
                                      ? theme.colors.primary
                                      : theme.colors.text,
                                  },
                                ]}
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
                                    Active
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.serviceDesc,
                                { color: theme.colors.placeholder },
                              ]}
                              numberOfLines={1}
                            >
                              {item.description}
                            </Text>
                          </View>

                          <View style={styles.rightCol}>
                            <View
                              style={[
                                styles.countChip,
                                {
                                  backgroundColor:
                                    count > 0
                                      ? theme.colors.secondary + '15'
                                      : theme.colors.border + '50',
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
                                {count} {count === 1 ? 'Garage' : 'Garages'}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.radioCircle,
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
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    width: '100%',
    maxHeight: '85%',
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
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  scrollList: {
    paddingBottom: 28,
  },
  sectionHeaderRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
    marginBottom: 8,
  },
  serviceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  serviceTextCol: {
    flex: 1,
    marginRight: 8,
  },
  serviceTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  serviceDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  countChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countChipText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
