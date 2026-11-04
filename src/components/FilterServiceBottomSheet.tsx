import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
import { useAppValues } from '../context/DataContext';
import { fonts } from '../theme/theme';

export interface ServiceItem {
  id: string;
  title: string;
  name?: string;
  keyword: string;
  category: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  description: string;
  price?: number;
  minPrice?: number;
  duration?: number;
  garageCount?: number;
}

// Matching logic for garage search / filtering
export const isServiceMatch = (service: any, filterKey: string): boolean => {
  if (!service || !filterKey) return false;
  if (
    service.isActive === false ||
    service.isActive === 'false' ||
    service.status === 'Inactive' ||
    service.status === 'Rejected' ||
    service.status === 'Pending'
  ) {
    return false;
  }

  const key = filterKey.trim().toLowerCase();
  const name = (service.name || service.title || '').trim().toLowerCase();
  const category = (service.category || '').trim().toLowerCase();

  // Match by ID if filterKey is an ID or exact ref
  if (service.serviceId && String(service.serviceId).toLowerCase().trim() === key) return true;
  if (service._id && String(service._id).toLowerCase().trim() === key) return true;
  if (service.id && String(service.id).toLowerCase().trim() === key) return true;

  // 1. Direct equality
  if (name === key) return true;

  // 2. MOT Specific
  if (key === 'mot' || key === 'mot test') {
    return /\bmot\b/i.test(name) || category === 'mot';
  }

  // 3. Service specific keywords
  if (key.includes('full service')) return name.includes('full') && (name.includes('service') || category.includes('service'));
  if (key.includes('interim')) return name.includes('interim');
  if (key.includes('major')) return name.includes('major');
  if (key.includes('brake')) return name.includes('brake');
  if (key.includes('tyre') || key.includes('tire')) return name.includes('tyre') || name.includes('tire') || category.includes('tyre');
  if (key.includes('diag') || key.includes('scan')) return name.includes('diag') || name.includes('scan');
  if (key.includes('air con') || key.includes('ac')) return name.includes('air') || name.includes('ac');
  if (key.includes('battery')) return name.includes('battery');
  if (key.includes('clutch')) return name.includes('clutch');
  if (key.includes('suspension')) return name.includes('suspension');
  if (key.includes('exhaust')) return name.includes('exhaust');

  // 4. Fallback name substring match
  return name.includes(key) || key.includes(name);
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
  const { theme, isDarkMode } = useAppTheme();
  const { services: contextServices, serviceCategories, fetchServices, fetchServiceCategories } = useAppValues();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [tempSelected, setTempSelected] = useState<Array<{ id: string; keyword: string; title: string }>>([]);

  // Fetch dynamic categories & services once on open
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (visible && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchServices().catch(() => {});
      fetchServiceCategories().catch(() => {});
    }
  }, [visible, fetchServices, fetchServiceCategories]);

  // Dynamic category tabs strictly from backend Super Admin categories
  const categoryTabs = useMemo(() => {
    if (serviceCategories && serviceCategories.length > 0) {
      const activeCats = serviceCategories
        .filter((c) => c.isActive !== false)
        .map((c) => c.name);
      return ['All', ...activeCats];
    }
    return ['All'];
  }, [serviceCategories]);

  // Dynamic services list strictly from backend Super Admin services (no hardcoded fallbacks)
  const allServices: ServiceItem[] = useMemo(() => {
    if (contextServices && contextServices.length > 0) {
      return contextServices
        .filter((s) => s.isActive !== false)
        .map((s) => ({
          id: s.id || (s as any)._id || s.name,
          title: s.title || s.name,
          name: s.name || s.title,
          keyword: s.searchQuery || s.name || s.title,
          category: s.category || 'General',
          icon: s.icon || 'wrench',
          iconColor: s.iconColor || '#1677FF',
          iconBg: s.iconBg || '#1677FF15',
          description: s.description || '',
          price: s.price,
          minPrice: s.minPrice,
          duration: s.duration !== undefined ? Number(s.duration) : undefined,
          garageCount: s.garageCount,
        }));
    }
    return [];
  }, [contextServices]);

  const allServicesRef = useRef<ServiceItem[]>(allServices);
  useEffect(() => {
    allServicesRef.current = allServices;
  }, [allServices]);

  const wasVisibleRef = useRef(false);

  // Sync tempSelected ONLY when bottom sheet transitions from closed to open
  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      let incomingKeys: string[] = [];
      let incomingTitles: string[] = [];

      if (Array.isArray(selectedServices) && selectedServices.length > 0) {
        incomingKeys = selectedServices;
        incomingTitles = selectedServiceTitles || [];
      } else if (selectedService && typeof selectedService === 'string' && selectedService.trim()) {
        incomingKeys = selectedService.split(',').map((k) => k.trim()).filter(Boolean);
        incomingTitles = (selectedServiceTitle || selectedService)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }

      if (incomingKeys.length > 0) {
        const items: Array<{ id: string; keyword: string; title: string }> = [];
        incomingKeys.forEach((key, idx) => {
          const kLower = key.toLowerCase().trim();
          const found = allServicesRef.current.find(
            (s) =>
              (s.id && s.id.toLowerCase().trim() === kLower) ||
              (s.keyword && s.keyword.toLowerCase().trim() === kLower) ||
              (s.title && s.title.toLowerCase().trim() === kLower) ||
              (s.name && s.name.toLowerCase().trim() === kLower)
          );
          if (found) {
            if (!items.some((i) => i.id === found.id)) {
              items.push({ id: found.id, keyword: found.keyword, title: found.title });
            }
          } else {
            items.push({
              id: `key_${kLower}`,
              keyword: key,
              title: incomingTitles[idx] || key,
            });
          }
        });
        setTempSelected(items);
      } else {
        setTempSelected([]);
      }
    }
    wasVisibleRef.current = visible;
  }, [visible, selectedService, selectedServiceTitle, selectedServices, selectedServiceTitles]);

  // Count how many garages offer a given service
  const getGarageCountForService = useCallback(
    (item: ServiceItem) => {
      if (item.garageCount !== undefined && item.garageCount > 0) {
        return item.garageCount;
      }
      if (!garages || garages.length === 0) return 0;
      return garages.filter((g) => {
        return (
          Array.isArray(g.services) &&
          g.services.some((s: any) => isServiceMatch(s, item.keyword || item.title))
        );
      }).length;
    },
    [garages]
  );

  // Filter services list based on category tab and search query
  const filteredServices = useMemo(() => {
    let list = allServices;

    if (selectedCategory !== 'All') {
      const catLower = selectedCategory.toLowerCase().trim();
      list = list.filter((s) => {
        const sCat = (s.category || '').toLowerCase().trim();
        if (sCat === catLower) return true;
        // Substring / fuzzy match: e.g. "tyres" vs "tyre replacement", "repairs" vs "repair", "diagnostic cars" vs "diagnostics"
        if (sCat.includes(catLower) || catLower.includes(sCat)) return true;
        if (catLower.includes('tyre') && sCat.includes('tyre')) return true;
        if (catLower.includes('diag') && sCat.includes('diag')) return true;
        if (catLower.includes('repair') && (sCat.includes('repair') || sCat.includes('brake'))) return true;
        if ((catLower.includes('service') || catLower.includes('repair')) && sCat.includes('air')) return true;
        return false;
      });
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

  // STRICT, ISOLATED MULTI-SELECTION:
  // An item is selected IF AND ONLY IF its non-empty id, keyword, or title matches an item in tempSelected.
  const isItemSelected = useCallback(
    (item: ServiceItem) => {
      const targetId = (item.id || '').toLowerCase().trim();
      const targetKey = (item.keyword || '').toLowerCase().trim();
      const targetTitle = (item.title || item.name || '').toLowerCase().trim();

      return tempSelected.some((s) => {
        const sId = (s.id || '').toLowerCase().trim();
        const sKey = (s.keyword || '').toLowerCase().trim();
        const sTitle = (s.title || '').toLowerCase().trim();
        if (sId && targetId && sId === targetId) return true;
        if (sKey && targetKey && sKey === targetKey) return true;
        if (sTitle && targetTitle && sTitle === targetTitle) return true;
        return false;
      });
    },
    [tempSelected]
  );

  // Toggle selection for an individual service item smoothly
  const toggleSelect = useCallback((item: ServiceItem) => {
    const targetId = (item.id || '').toLowerCase().trim();
    const targetKey = (item.keyword || '').toLowerCase().trim();
    const targetTitle = (item.title || item.name || '').toLowerCase().trim();

    setTempSelected((prev) => {
      const exists = prev.some((s) => {
        const sId = (s.id || '').toLowerCase().trim();
        const sKey = (s.keyword || '').toLowerCase().trim();
        const sTitle = (s.title || '').toLowerCase().trim();
        if (sId && targetId && sId === targetId) return true;
        if (sKey && targetKey && sKey === targetKey) return true;
        if (sTitle && targetTitle && sTitle === targetTitle) return true;
        return false;
      });

      if (exists) {
        return prev.filter((s) => {
          const sId = (s.id || '').toLowerCase().trim();
          const sKey = (s.keyword || '').toLowerCase().trim();
          const sTitle = (s.title || '').toLowerCase().trim();
          const isThis = (sId && targetId && sId === targetId) ||
                         (sKey && targetKey && sKey === targetKey) ||
                         (sTitle && targetTitle && sTitle === targetTitle);
          return !isThis;
        });
      } else {
        return [...prev, { id: item.id, keyword: item.keyword, title: item.title || item.name || '' }];
      }
    });
  }, []);

  // Count garages matching the current tempSelected filter
  const matchingGaragesCount = useMemo(() => {
    if (tempSelected.length === 0) return garages.length;
    const keys = tempSelected.map((s) => s.keyword);
    const titles = tempSelected.map((s) => s.title);
    return garages.filter((g) =>
      Array.isArray(g.services) &&
      keys.some((k, idx) =>
        g.services.some((s: any) => isServiceMatch(s, k) || isServiceMatch(s, titles[idx]))
      )
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
                          ? `${tempSelected.length} selected • Tap Apply Filter`
                          : 'Select one or multiple services'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      onPress={handleClearAll}
                      style={[
                        styles.headerResetBtn,
                        {
                          backgroundColor: theme.colors.primary + '14',
                          borderColor: theme.colors.primary + '30',
                        },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="refresh"
                        size={14}
                        color={theme.colors.primary}
                        style={{ marginRight: 3 }}
                      />
                      <Text style={[styles.headerResetText, { color: theme.colors.primary }]}>
                        Reset
                      </Text>
                    </TouchableOpacity>

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
                    placeholder="Search services..."
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

                {/* Dynamic Category Tabs Bar */}
                {categoryTabs.length > 1 && (
                  <View style={styles.categoryContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryScroll}
                    >
                      {categoryTabs.map((cat) => {
                        const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
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
                )}

                {/* Services List - Clean, compact border-radius tab rows */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollList}
                  keyboardShouldPersistTaps="handled"
                >
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
                        {allServices.length === 0
                          ? 'No services available yet'
                          : `No services in "${selectedCategory}"`}
                      </Text>
                    </View>
                  ) : (
                    filteredServices.map((item) => {
                      const isSelected = isItemSelected(item);
                      const count = getGarageCountForService(item);

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
                          onPress={() => toggleSelect(item)}
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

                            {item.description && item.description.trim() ? (
                              <Text
                                style={[
                                  styles.serviceDesc,
                                  { color: theme.colors.placeholder },
                                ]}
                                numberOfLines={1}
                              >
                                {item.description}
                              </Text>
                            ) : null}

                            {/* Dynamic Rate, Timing & Garage Count Badges */}
                            <View style={styles.serviceMetaRow}>
                              {(item.minPrice !== undefined || item.price !== undefined) && (
                                <View
                                  style={[
                                    styles.metaPill,
                                    {
                                      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                                      borderColor: theme.colors.border,
                                    },
                                  ]}
                                >
                                  <Text style={[styles.metaPillPrefix, { color: theme.colors.placeholder }]}>
                                    from{' '}
                                  </Text>
                                  <Text style={[styles.metaPillRate, { color: theme.colors.primary }]}>
                                    £{Number(item.minPrice !== undefined ? item.minPrice : item.price).toFixed(0)}
                                  </Text>
                                </View>
                              )}

                              {item.duration !== undefined && Number(item.duration) > 0 && (
                                <View
                                  style={[
                                    styles.metaPill,
                                    {
                                      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                                      borderColor: theme.colors.border,
                                    },
                                  ]}
                                >
                                  <MaterialCommunityIcons
                                    name="clock-outline"
                                    size={11}
                                    color={theme.colors.placeholder}
                                    style={{ marginRight: 3 }}
                                  />
                                  <Text style={[styles.metaPillText, { color: theme.colors.text }]}>
                                    {item.duration} mins
                                  </Text>
                                </View>
                              )}

                              {count > 0 && (
                                <View
                                  style={[
                                    styles.metaPill,
                                    {
                                      backgroundColor: theme.colors.secondary + '14',
                                      borderColor: theme.colors.secondary + '30',
                                    },
                                  ]}
                                >
                                  <MaterialCommunityIcons
                                    name="storefront-outline"
                                    size={11}
                                    color={theme.colors.secondary}
                                    style={{ marginRight: 3 }}
                                  />
                                  <Text style={[styles.metaPillText, { color: theme.colors.secondary }]}>
                                    {count} {count === 1 ? 'garage' : 'garages'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={styles.rightCol}>
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
                <View
                  style={[
                    styles.sheetFooterBar,
                    {
                      borderTopColor: theme.colors.border,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.footerResetBtn,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                      },
                    ]}
                    onPress={handleClearAll}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="refresh"
                      size={15}
                      color={theme.colors.text}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.footerResetText, { color: theme.colors.text }]}>
                      Reset
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.sheetApplyBtn,
                      { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={handleApply}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name="filter-check"
                      size={17}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.sheetApplyText}>
                      {tempSelected.length === 0
                        ? `Apply Filter (All Garages - ${garages.length})`
                        : `Apply (${tempSelected.length} Selected) • ${matchingGaragesCount} ${
                            matchingGaragesCount === 1 ? 'Garage' : 'Garages'
                          }`}
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
  headerResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerResetText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  footerResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  footerResetText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
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
  serviceDesc: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    marginTop: 1.5,
  },
  serviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  metaPillPrefix: {
    fontFamily: fonts.regular,
    fontSize: 9.5,
  },
  metaPillRate: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  metaPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 9.5,
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
