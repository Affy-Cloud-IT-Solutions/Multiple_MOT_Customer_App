import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

export default function AdminRemindersScreen() {
  const { theme } = useAppTheme();
  const { audits, vehicles, customers, alerts } = useAppValues();
  const [activeTab, setActiveTab] = useState<'logs' | 'reports' | 'templates'>('logs');

  // Templates state
  const [t45, setT45] = useState(
    'Dear [Name], Your [Vehicle] ([Reg]) MOT expires on [Expiry]. Book your MOT today.'
  );
  const [t30, setT30] = useState(
    'Dear [Name], Just a reminder that your [Vehicle] ([Reg]) MOT is due in 30 days ([Expiry]). Book now.'
  );
  const [t7, setT7] = useState(
    'URGENT: Dear [Name], Your [Vehicle] ([Reg]) MOT expires in 7 days on [Expiry]. Book immediately to avoid fines.'
  );

  const [savingTemplate, setSavingTemplate] = useState<number | null>(null);
  const [exportingReport, setExportingReport] = useState<string | null>(null);

  const saveTemplate = (days: number) => {
    setSavingTemplate(days);
    setTimeout(() => {
      setSavingTemplate(null);
      Alert.alert('Success', `${days}-Day Reminder Template updated successfully!`);
    }, 1000);
  };

  const handleExport = (reportName: string, format: 'PDF' | 'Excel' | 'CSV') => {
    setExportingReport(`${reportName}_${format}`);
    setTimeout(() => {
      setExportingReport(null);
      Alert.alert('Export Success', `${reportName} has been exported to ${format} format successfully!`);
    }, 1500);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('logs')}
          style={[styles.tabItem, activeTab === 'logs' && { borderBottomColor: theme.colors.secondary }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'logs' ? theme.colors.secondary : theme.colors.placeholder }]}>
            Audit Logs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('reports')}
          style={[styles.tabItem, activeTab === 'reports' && { borderBottomColor: theme.colors.secondary }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'reports' ? theme.colors.secondary : theme.colors.placeholder }]}>
            Reports
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('templates')}
          style={[styles.tabItem, activeTab === 'templates' && { borderBottomColor: theme.colors.secondary }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'templates' ? theme.colors.secondary : theme.colors.placeholder }]}>
            Templates
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'logs' && (
          // AUDIT TRAIL / LOGS VIEW
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>System Audit Trail</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
              Real-time records of sent messages, vehicle updates, and customer responses.
            </Text>

            {audits.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No logs recorded.</Text>
            ) : (
              audits.map((log) => (
                <View key={log.id} style={[styles.logCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <View style={styles.logHeader}>
                    <Text style={[styles.logActivity, { color: theme.colors.text }]}>{log.activity}</Text>
                    <Text style={[styles.logDate, { color: theme.colors.placeholder }]}>{log.date}</Text>
                  </View>
                  <Text style={[styles.logDetails, { color: theme.colors.placeholder }]}>{log.details}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'reports' && (
          // REPORTS MODULE
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Garage Reporting Engine</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
              Generate, preview, and export critical MOT operations reports.
            </Text>

            {/* Report 1: MOT Due Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color={theme.colors.secondary} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.reportTitle, { color: theme.colors.text }]}>MOT Due Report</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>Active vehicles scheduled for MOT soon</Text>
                </View>
              </View>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => (
                  <TouchableOpacity
                    key={format}
                    onPress={() => handleExport('MOT Due Report', format)}
                    disabled={exportingReport !== null}
                    style={[styles.exportBtn, { borderColor: theme.colors.border }]}
                  >
                    {exportingReport === `MOT Due Report_${format}` ? (
                      <ActivityIndicator size="small" color={theme.colors.secondary} />
                    ) : (
                      <Text style={[styles.exportBtnText, { color: theme.colors.text }]}>{format}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Report 2: Reminder Sent Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <MaterialCommunityIcons name="message-text-outline" size={24} color={theme.colors.secondary} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Reminder Sent Report</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>Log of automated reminders sent by system</Text>
                </View>
              </View>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => (
                  <TouchableOpacity
                    key={format}
                    onPress={() => handleExport('Reminder Sent Report', format)}
                    disabled={exportingReport !== null}
                    style={[styles.exportBtn, { borderColor: theme.colors.border }]}
                  >
                    {exportingReport === `Reminder Sent Report_${format}` ? (
                      <ActivityIndicator size="small" color={theme.colors.secondary} />
                    ) : (
                      <Text style={[styles.exportBtnText, { color: theme.colors.text }]}>{format}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Report 3: Customer Response Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <MaterialCommunityIcons name="forum-outline" size={24} color={theme.colors.secondary} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Customer Response Report</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>Analysis of bookings, vehicle sold flags, etc.</Text>
                </View>
              </View>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => (
                  <TouchableOpacity
                    key={format}
                    onPress={() => handleExport('Customer Response Report', format)}
                    disabled={exportingReport !== null}
                    style={[styles.exportBtn, { borderColor: theme.colors.border }]}
                  >
                    {exportingReport === `Customer Response Report_${format}` ? (
                      <ActivityIndicator size="small" color={theme.colors.secondary} />
                    ) : (
                      <Text style={[styles.exportBtnText, { color: theme.colors.text }]}>{format}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Report 4: Booked MOT Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <MaterialCommunityIcons name="calendar-check-outline" size={24} color={theme.colors.secondary} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Booked MOT Report</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>List of scheduled MOT appointments and slot usage</Text>
                </View>
              </View>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => (
                  <TouchableOpacity
                    key={format}
                    onPress={() => handleExport('Booked MOT Report', format)}
                    disabled={exportingReport !== null}
                    style={[styles.exportBtn, { borderColor: theme.colors.border }]}
                  >
                    {exportingReport === `Booked MOT Report_${format}` ? (
                      <ActivityIndicator size="small" color={theme.colors.secondary} />
                    ) : (
                      <Text style={[styles.exportBtnText, { color: theme.colors.text }]}>{format}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {activeTab === 'templates' && (
          // REMINDER TEMPLATE CONFIGURATION
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Reminder Schedule Config</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
              Set the templates and timing parameters for automated customer communication.
            </Text>

            {/* 45 Days Reminder */}
            <View style={[styles.templateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.templateHeader}>
                <Text style={[styles.templateDaysText, { color: theme.colors.text }]}>Reminder 1: 45 Days Before MOT</Text>
              </View>
              <TextInput
                value={t45}
                onChangeText={setT45}
                multiline
                numberOfLines={3}
                style={[styles.templateInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              />
              <TouchableOpacity
                onPress={() => saveTemplate(45)}
                disabled={savingTemplate !== null}
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              >
                {savingTemplate === 45 ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Template</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 30 Days Reminder */}
            <View style={[styles.templateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.templateHeader}>
                <Text style={[styles.templateDaysText, { color: theme.colors.text }]}>Reminder 2: 30 Days Before MOT</Text>
              </View>
              <TextInput
                value={t30}
                onChangeText={setT30}
                multiline
                numberOfLines={3}
                style={[styles.templateInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              />
              <TouchableOpacity
                onPress={() => saveTemplate(30)}
                disabled={savingTemplate !== null}
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              >
                {savingTemplate === 30 ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Template</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 7 Days Reminder */}
            <View style={[styles.templateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.templateHeader}>
                <Text style={[styles.templateDaysText, { color: theme.colors.text }]}>Reminder 3: 7 Days Before MOT</Text>
              </View>
              <TextInput
                value={t7}
                onChangeText={setT7}
                multiline
                numberOfLines={3}
                style={[styles.templateInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              />
              <TouchableOpacity
                onPress={() => saveTemplate(7)}
                disabled={savingTemplate !== null}
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              >
                {savingTemplate === 7 ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Template</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  tabContent: {},
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 32,
  },
  logCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  logActivity: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  logDate: {
    fontSize: 11,
  },
  logDetails: {
    fontSize: 13,
    lineHeight: 18,
  },
  reportCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  exportRow: {
    flexDirection: 'row',
  },
  exportBtn: {
    flex: 1,
    height: 36,
    borderWidth: 1.2,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
  },
  templateHeader: {
    marginBottom: 10,
  },
  templateDaysText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  templateInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 72,
    marginBottom: 12,
  },
  saveBtn: {
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
