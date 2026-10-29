import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';

export default function AdminRemindersScreen() {
  const { theme } = useAppTheme();
  const { audits, vehicles, customers, alerts, token, authFetch } = useAppValues();
  const [activeTab, setActiveTab] = useState<'logs' | 'reports' | 'templates'>('logs');

  // Service & MOT Due Template state
  const [motTemplate, setMotTemplate] = useState(
    'Dear [Name], Your [Vehicle] ([Reg]) is due for service / MOT renewal on [Expiry]. Book your service or MOT appointment today with our accredited garage network.'
  );

  const [savingTemplate, setSavingTemplate] = useState(false);
  const [exportingReport, setExportingReport] = useState<string | null>(null);

  const saveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const res = await authFetch(`${BASE_URL}/reminders/templates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ motDue: motTemplate, template: motTemplate, t30: motTemplate })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // The reminder template is platform-wide, so only super admins may change it
        throw new Error(res.status === 403
          ? 'Only platform admins can change the reminder template.'
          : (data.error || 'Could not save the reminder template.'));
      }
      Alert.alert('Success', 'Service & MOT Due Reminder Template updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not save the reminder template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleExport = async (reportName: string, format: 'PDF' | 'Excel' | 'CSV') => {
    let endpoint = '';
    if (reportName === 'MOT Due Report' || reportName === 'Service & MOT Due Report') endpoint = 'due-mots';
    else if (reportName === 'Reminder Sent Report') endpoint = 'reminder-sent';
    else if (reportName === 'Customer Response Report') endpoint = 'customer-response';
    else if (reportName === 'Booked MOT Report' || reportName === 'Booked Services Report') endpoint = 'booked-mots';

    const formatParam = format.toLowerCase();
    const backendFormat = format === 'Excel' ? 'excel' : formatParam;
    const downloadUrl = `${BASE_URL}/reports/${endpoint}?format=${backendFormat}&token=${token}`;

    setExportingReport(`${reportName}_${format}`);
    try {
      await Linking.openURL(downloadUrl);
    } catch (error) {
      console.error('[EXPORT REPORT ERROR]', error);
      Alert.alert('Error', 'Failed to open report download link. Please check if a web browser is installed.');
    } finally {
      setTimeout(() => {
        setExportingReport(null);
      }, 500);
    }
  };

  // Compute metrics dynamically for the reports
  const activeVehiclesCount = vehicles.filter(v => v.status === 'Active').length;
  const remindersSentCount = audits.filter(a => a.activity.toLowerCase().includes('sent') || a.activity.toLowerCase().includes('reminder')).length;
  const customerResponsesCount = audits.filter(a => a.activity.toLowerCase().includes('request') || a.activity.toLowerCase().includes('change') || a.activity.toLowerCase().includes('book')).length;
  const bookedMotsCount = alerts.filter(a => a.type === 'BOOKED').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Segmented Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.background }]}>
          {(['logs', 'reports', 'templates'] as const).map((tab) => {
            const isActive = activeTab === tab;
            let label = 'Logs';
            let icon = 'file-clock-outline';
            if (tab === 'reports') {
              label = 'Reports';
              icon = 'chart-bar';
            } else if (tab === 'templates') {
              label = 'Templates';
              icon = 'cog-box';
            }

            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabItem,
                  isActive && { backgroundColor: theme.colors.card }
                ]}
              >
                <MaterialCommunityIcons 
                  name={icon} 
                  size={15} 
                  color={isActive ? theme.colors.primary : theme.colors.placeholder} 
                  style={{ marginRight: 5 }} 
                />
                <Text style={[
                  styles.tabText, 
                  { color: isActive ? theme.colors.text : theme.colors.placeholder }
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'logs' && (
          // AUDIT TRAIL / LOGS VIEW
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>System Audit Trail</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
              Real-time records of sent messages, vehicle updates, and customer responses.
            </Text>

            {audits.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="clipboard-text-play-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No logs recorded.</Text>
              </View>
            ) : (
              audits.map((log) => {
                let borderLeftColor = theme.colors.primary;
                let iconName = 'bell-outline';
                const act = log.activity.toLowerCase();
                
                if (act.includes('sent') || act.includes('send')) {
                  borderLeftColor = '#10B981'; // Green
                  iconName = 'email-send-outline';
                } else if (act.includes('book') || act.includes('slot')) {
                  borderLeftColor = '#3B82F6'; // Blue
                  iconName = 'calendar-clock';
                } else if (act.includes('status') || act.includes('change') || act.includes('sold')) {
                  borderLeftColor = '#F59E0B'; // Amber
                  iconName = 'car-cog';
                } else if (act.includes('reject') || act.includes('fail')) {
                  borderLeftColor = '#EF4444'; // Red
                  iconName = 'alert-circle-outline';
                }

                return (
                  <View key={log.id} style={[styles.logCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderLeftColor }]}>
                    <View style={styles.logHeader}>
                      <View style={styles.logActivityRow}>
                        <MaterialCommunityIcons name={iconName} size={15} color={borderLeftColor} style={{ marginRight: 6 }} />
                        <Text style={[styles.logActivity, { color: theme.colors.text }]} numberOfLines={1}>{log.activity}</Text>
                      </View>
                      <Text style={[styles.logDate, { color: theme.colors.placeholder }]}>{log.date}</Text>
                    </View>
                    <Text style={[styles.logDetails, { color: theme.colors.text + 'CC' }]}>{log.details}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'reports' && (
          // REPORTS MODULE
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Garage Reporting Engine</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
              Generate, preview, and export critical service and MOT operations reports.
            </Text>

            {/* Report 1: Service & MOT Due Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <View style={[styles.reportIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="file-document-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.reportMeta}>
                  <View style={styles.reportTitleRow}>
                    <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Service & MOT Due Report</Text>
                    <View style={[styles.metricBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.metricText, { color: theme.colors.primary }]}>{activeVehiclesCount} active</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder, marginTop: 1 }}>Active vehicles scheduled for service or MOT soon</Text>
                </View>
              </View>
              <View style={styles.exportDivider} />
              <Text style={[styles.exportLabel, { color: theme.colors.placeholder }]}>DOWNLOAD FORMAT</Text>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => {
                  let btnStyle = {};
                  let color = theme.colors.text;
                  let icon = 'file-document-outline';
                  if (format === 'PDF') {
                    btnStyle = styles.pdfBtn;
                    color = '#EF4444';
                    icon = 'file-pdf-box';
                  } else if (format === 'Excel') {
                    btnStyle = styles.excelBtn;
                    color = '#22C55E';
                    icon = 'microsoft-excel';
                  } else if (format === 'CSV') {
                    btnStyle = styles.csvBtn;
                    color = '#3B82F6';
                    icon = 'file-delimited-outline';
                  }

                  return (
                    <TouchableOpacity
                      key={format}
                      onPress={() => handleExport('Service & MOT Due Report', format)}
                      disabled={exportingReport !== null}
                      style={[styles.exportBtn, btnStyle]}
                    >
                      {exportingReport === `Service & MOT Due Report_${format}` ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <View style={styles.exportBtnContent}>
                          <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 4 }} />
                          <Text style={[styles.exportBtnText, { color }]}>{format}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Report 2: Reminder Sent Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <View style={[styles.reportIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="message-text-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.reportMeta}>
                  <View style={styles.reportTitleRow}>
                    <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Reminder Sent Report</Text>
                    <View style={[styles.metricBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.metricText, { color: theme.colors.primary }]}>{remindersSentCount} sent</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder, marginTop: 1 }}>Log of automated reminders sent by system</Text>
                </View>
              </View>
              <View style={styles.exportDivider} />
              <Text style={[styles.exportLabel, { color: theme.colors.placeholder }]}>DOWNLOAD FORMAT</Text>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => {
                  let btnStyle = {};
                  let color = theme.colors.text;
                  let icon = 'file-document-outline';
                  if (format === 'PDF') {
                    btnStyle = styles.pdfBtn;
                    color = '#EF4444';
                    icon = 'file-pdf-box';
                  } else if (format === 'Excel') {
                    btnStyle = styles.excelBtn;
                    color = '#22C55E';
                    icon = 'microsoft-excel';
                  } else if (format === 'CSV') {
                    btnStyle = styles.csvBtn;
                    color = '#3B82F6';
                    icon = 'file-delimited-outline';
                  }

                  return (
                    <TouchableOpacity
                      key={format}
                      onPress={() => handleExport('Reminder Sent Report', format)}
                      disabled={exportingReport !== null}
                      style={[styles.exportBtn, btnStyle]}
                    >
                      {exportingReport === `Reminder Sent Report_${format}` ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <View style={styles.exportBtnContent}>
                          <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 4 }} />
                          <Text style={[styles.exportBtnText, { color }]}>{format}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Report 3: Customer Response Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <View style={[styles.reportIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="account-sync-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.reportMeta}>
                  <View style={styles.reportTitleRow}>
                    <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Customer Response Report</Text>
                    <View style={[styles.metricBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.metricText, { color: theme.colors.primary }]}>{customerResponsesCount} responses</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder, marginTop: 1 }}>Customer actions following automated reminders</Text>
                </View>
              </View>
              <View style={styles.exportDivider} />
              <Text style={[styles.exportLabel, { color: theme.colors.placeholder }]}>DOWNLOAD FORMAT</Text>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => {
                  let btnStyle = {};
                  let color = theme.colors.text;
                  let icon = 'file-document-outline';
                  if (format === 'PDF') {
                    btnStyle = styles.pdfBtn;
                    color = '#EF4444';
                    icon = 'file-pdf-box';
                  } else if (format === 'Excel') {
                    btnStyle = styles.excelBtn;
                    color = '#22C55E';
                    icon = 'microsoft-excel';
                  } else if (format === 'CSV') {
                    btnStyle = styles.csvBtn;
                    color = '#3B82F6';
                    icon = 'file-delimited-outline';
                  }

                  return (
                    <TouchableOpacity
                      key={format}
                      onPress={() => handleExport('Customer Response Report', format)}
                      disabled={exportingReport !== null}
                      style={[styles.exportBtn, btnStyle]}
                    >
                      {exportingReport === `Customer Response Report_${format}` ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <View style={styles.exportBtnContent}>
                          <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 4 }} />
                          <Text style={[styles.exportBtnText, { color }]}>{format}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Report 4: Booked MOT Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <View style={[styles.reportIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.reportMeta}>
                  <View style={styles.reportTitleRow}>
                    <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Booked Services Report</Text>
                    <View style={[styles.metricBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.metricText, { color: theme.colors.primary }]}>{bookedMotsCount} booked</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder, marginTop: 1 }}>List of scheduled appointments and slot usage</Text>
                </View>
              </View>
              <View style={styles.exportDivider} />
              <Text style={[styles.exportLabel, { color: theme.colors.placeholder }]}>DOWNLOAD FORMAT</Text>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => {
                  let btnStyle = {};
                  let color = theme.colors.text;
                  let icon = 'file-document-outline';
                  if (format === 'PDF') {
                    btnStyle = styles.pdfBtn;
                    color = '#EF4444';
                    icon = 'file-pdf-box';
                  } else if (format === 'Excel') {
                    btnStyle = styles.excelBtn;
                    color = '#22C55E';
                    icon = 'microsoft-excel';
                  } else if (format === 'CSV') {
                    btnStyle = styles.csvBtn;
                    color = '#3B82F6';
                    icon = 'file-delimited-outline';
                  }

                  return (
                    <TouchableOpacity
                      key={format}
                      onPress={() => handleExport('Booked Services Report', format)}
                      disabled={exportingReport !== null}
                      style={[styles.exportBtn, btnStyle]}
                    >
                      {exportingReport === `Booked Services Report_${format}` ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <View style={styles.exportBtnContent}>
                          <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 4 }} />
                          <Text style={[styles.exportBtnText, { color }]}>{format}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {activeTab === 'templates' && (
          // REMINDER TEMPLATE CONFIGURATION (DVSA 30-DAY WINDOW)
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Service & MOT Reminder Template</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
              Configure the automated notification dispatched to customers when their vehicle enters the DVSA 30-day early renewal eligibility window.
            </Text>

            {/* DVSA Rule Info Banner */}
            <View style={[styles.dvsaBanner, { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary + '30' }]}>
              <MaterialCommunityIcons name="information" size={20} color={theme.colors.primary} style={{ marginRight: 8, marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.dvsaBannerTitle, { color: theme.colors.primary }]}>DVSA 30-Day Early Renewal Rule</Text>
                <Text style={[styles.dvsaBannerText, { color: theme.colors.text }]}>
                  Vehicles can be tested up to 1 month (30 days) before expiry to preserve their renewal anniversary date. This template is sent to notify owners as soon as they become eligible.
                </Text>
              </View>
            </View>

            {/* Unified MOT Due Reminder Card */}
            <View style={[styles.templateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.templateHeader}>
                <View style={styles.templateTitleRow}>
                  <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.templateDaysText, { color: theme.colors.text }]}>Service & MOT Due Notification (Within 30 Days)</Text>
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder, marginTop: 4 }}>
                  Dispatched via SMS, WhatsApp, or Email according to each customer's communication preferences.
                </Text>
              </View>

              <TextInput
                value={motTemplate}
                onChangeText={setMotTemplate}
                multiline
                numberOfLines={4}
                style={[styles.templateInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              />

              <View style={styles.placeholderContainer}>
                <Text style={[styles.placeholderLabel, { color: theme.colors.placeholder }]}>Supported Tags:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeholderScroll}>
                  {['[Name]', '[Vehicle]', '[Reg]', '[Expiry]'].map((tag) => (
                    <TouchableOpacity 
                      key={tag} 
                      onPress={() => setMotTemplate(prev => prev + ' ' + tag)}
                      style={[styles.placeholderPill, { backgroundColor: theme.colors.primary + '15' }]}
                    >
                      <Text style={[styles.placeholderPillText, { color: theme.colors.primary }]}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity
                onPress={saveTemplate}
                disabled={savingTemplate}
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              >
                {savingTemplate ? (
                  <ActivityIndicator size="small" color={theme.dark ? theme.colors.background : '#FFFFFF'} />
                ) : (
                  <View style={styles.saveBtnContent}>
                    <MaterialCommunityIcons name="content-save-outline" size={16} color={theme.dark ? theme.colors.background : '#FFFFFF'} style={{ marginRight: 6 }} />
                    <Text style={[styles.saveBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Save Reminder Template</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

import { fonts } from '../theme/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    marginBottom: 4,
  },
  sectionDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  logCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  logActivity: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
  },
  logDate: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
  },
  logDetails: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
  },
  reportCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportMeta: {
    flex: 1,
  },
  reportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  metricBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  metricText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  exportDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
    opacity: 0.6,
  },
  exportLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  pdfBtn: {
    backgroundColor: '#EF444410',
    borderColor: '#EF444430',
  },
  excelBtn: {
    backgroundColor: '#22C55E10',
    borderColor: '#22C55E30',
  },
  csvBtn: {
    backgroundColor: '#3B82F610',
    borderColor: '#3B82F630',
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  dvsaBanner: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  dvsaBannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    marginBottom: 2,
  },
  dvsaBannerText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  templateHeader: {
    marginBottom: 12,
  },
  templateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateDaysText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  templateInput: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 80,
    marginBottom: 12,
  },
  placeholderContainer: {
    marginBottom: 14,
  },
  placeholderLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    marginBottom: 6,
  },
  placeholderScroll: {
    gap: 6,
  },
  placeholderPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  placeholderPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 10.5,
  },
  saveBtn: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 12.5,
  },
});
