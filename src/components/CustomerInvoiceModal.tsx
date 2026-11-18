import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme/theme';
import { useAppValues, Invoice, BASE_URL } from '../context/DataContext';
import { downloadReceiptFile } from '../utils/fileDownloader';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  booking: any;
  onClose: () => void;
}

export default function CustomerInvoiceModal({ visible, booking, onClose }: Props) {
  const { theme } = useAppTheme();
  const { fetchBookingInvoice, user } = useAppValues();

  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const bookingId = booking?.id || booking?._id;

  const loadInvoice = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const inv = await fetchBookingInvoice(bookingId);
      setInvoice(inv);
    } catch (err) {
      console.error('[CustomerInvoiceModal] loadInvoice error:', err);
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId, fetchBookingInvoice]);

  useEffect(() => {
    if (visible && bookingId) {
      loadInvoice();
    }
  }, [visible, bookingId, loadInvoice]);

  const handleDownloadReceipt = async () => {
    const targetId = invoice?._id || booking?.invoiceId;
    let downloadUrl = '';
    if (targetId) {
      downloadUrl = `${BASE_URL}/invoices/${targetId}/download`;
    } else if (bookingId) {
      downloadUrl = `${BASE_URL}/invoices/booking/${bookingId}/download`;
    }
    if (downloadUrl) {
      const invoiceNum = invoice?.invoiceNumber || booking?.invoiceNumber || bookingId || 'receipt';
      const safeName = `Receipt_${String(invoiceNum).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      await downloadReceiptFile({
        url: downloadUrl,
        fileName: safeName,
        title: `Receipt ${invoiceNum}`,
        mimeType: 'application/pdf',
      });
    }
  };

  const regText = invoice?.registrationNumber || booking?.registrationNumber || booking?.vrn || 'Vehicle';
  const makeModelText = invoice?.makeModel || booking?.makeModel || '';

  // Garage details fallback
  const garageData = invoice?.garageId || booking?.garage || booking?.garageId || {};
  const garageName = garageData?.name || garageData?.garageName || booking?.garageName || booking?.stationName || 'MOT SERVICE CENTRE';
  const garageAddress = [
    garageData?.address || booking?.garageAddress,
    garageData?.city || booking?.garageCity,
    garageData?.postcode || booking?.garagePostcode,
  ].filter(Boolean).join(', ');
  const garagePhone = garageData?.phone || booking?.garagePhone;
  const garageEmail = garageData?.email || booking?.garageEmail;
  const vtsNumber = garageData?.vtsNumber || garageData?.motStationNumber;

  // Customer details
  const customerName = invoice?.customerName || booking?.customerName || user?.name || 'Customer';
  const displayEmail = invoice?.customerEmail || booking?.customerEmail || user?.email || '';
  const displayMobile = invoice?.customerMobile || booking?.customerMobile || booking?.customerPhone || (user as any)?.phone || (user as any)?.mobile || '';

  // Dates
  const receiptDate = invoice?.createdAt
    ? new Date(invoice.createdAt).toLocaleDateString('en-GB')
    : (booking?.date ? new Date(booking.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'));
  const receiptTime = invoice?.createdAt
    ? new Date(invoice.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : (booking?.slotTime || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

  // Financials
  const subtotal = Number(invoice?.subtotal ?? (Number(booking?.price || 50)));
  const vatRate = Number(invoice?.vatRate ?? 20);
  const vatAmount = Number(invoice?.vatAmount ?? (subtotal * (vatRate / 100)));
  const discountAmount = Number(invoice?.discountAmount ?? 0);
  const discountLabel = invoice?.discountType === 'PERCENT' && invoice?.discountValue
    ? `Discount (${invoice.discountValue}% OFF):`
    : 'Discount:';
  const grandTotal = Number(invoice?.grandTotal ?? (subtotal + vatAmount - discountAmount));
  const paymentStatus = invoice?.paymentStatus || (booking?.status === 'Completed' ? 'Paid' : 'Pending');
  const invoiceNumber = invoice?.invoiceNumber || booking?.invoiceNumber || '';
  const notes = invoice?.notes || booking?.serviceNotes || booking?.notes || '';

  const items = invoice?.items && invoice.items.length > 0 ? invoice.items : [
    {
      description: booking?.serviceName || 'Vehicle MOT & Service',
      unitPrice: subtotal,
      quantity: 1,
      totalPrice: subtotal,
      partNumber: undefined,
    }
  ];

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheetContainer, { backgroundColor: theme.colors.card }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: theme.colors.border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="receipt" size={20} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Receipt & Tax Invoice</Text>
              </View>
              <Text style={[styles.subText, { color: theme.colors.placeholder }]}>
                {invoiceNumber ? `Official Receipt #${invoiceNumber}` : 'Official Receipt Slip Preview'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.colors.secondary} />
              <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>
                Loading official VAT receipt...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.receiptScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Receipt Paper Card */}
              <View style={styles.receiptPaper}>
                {/* Garage Header */}
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptGarageTitle}>
                    {garageName.toUpperCase()}
                  </Text>
                  {garageAddress ? (
                    <Text style={styles.receiptGarageSub}>{garageAddress}</Text>
                  ) : null}
                  {garagePhone ? (
                    <Text style={styles.receiptGarageSub}>Tel: {garagePhone}</Text>
                  ) : null}
                  {garageEmail ? (
                    <Text style={styles.receiptGarageSub}>Email: {garageEmail}</Text>
                  ) : null}
                  {vtsNumber ? (
                    <Text style={styles.receiptGarageSub}>MOT VTS Station: {vtsNumber}</Text>
                  ) : null}
                  <View style={styles.receiptBadgeWrap}>
                    <Text style={styles.receiptBadgeText}>RETAIL CASH RECEIPT & TAX INVOICE</Text>
                  </View>
                </View>

                <View style={styles.receiptDashedDivider} />

                {/* Meta Details */}
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMetaKey}>Receipt #:</Text>
                  <Text style={styles.receiptMetaVal} numberOfLines={1}>{invoiceNumber || 'INV-PENDING'}</Text>
                </View>
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMetaKey}>Date & Time:</Text>
                  <Text style={styles.receiptMetaVal}>
                    {receiptDate} {receiptTime}
                  </Text>
                </View>

                <View style={[styles.receiptMetaRow, { alignItems: 'center', marginTop: 4 }]}>
                  <Text style={styles.receiptMetaKey}>Vehicle VRN:</Text>
                  <View style={styles.receiptVrnBox}>
                    <Text style={styles.receiptVrnText}>{regText}</Text>
                  </View>
                </View>
                {makeModelText ? (
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Make / Model:</Text>
                    <Text style={styles.receiptMetaVal} numberOfLines={2}>{makeModelText}</Text>
                  </View>
                ) : null}
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMetaKey}>Customer:</Text>
                  <Text style={styles.receiptMetaVal} numberOfLines={2}>{customerName}</Text>
                </View>
                {displayMobile ? (
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Phone / Mobile:</Text>
                    <Text style={styles.receiptMetaVal} numberOfLines={1}>{displayMobile}</Text>
                  </View>
                ) : null}
                {displayEmail ? (
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Email:</Text>
                    <Text style={styles.receiptMetaVal} numberOfLines={2}>{displayEmail}</Text>
                  </View>
                ) : null}

                <View style={styles.receiptDashedDivider} />

                {/* Items Table */}
                <View style={styles.receiptItemHeaderRow}>
                  <Text style={[styles.receiptItemColHeader, { flex: 1 }]}>ITEM / SERVICE</Text>
                  <Text style={[styles.receiptItemColHeader, { width: 56, textAlign: 'right' }]}>PRICE</Text>
                  <Text style={[styles.receiptItemColHeader, { width: 32, textAlign: 'center' }]}>QTY</Text>
                  <Text style={[styles.receiptItemColHeader, { width: 62, textAlign: 'right' }]}>TOTAL</Text>
                </View>

                {items.map((it: any, idx: number) => (
                  <View key={idx} style={styles.receiptItemRow}>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <Text style={styles.receiptItemDesc}>{it.description}</Text>
                      {it.partNumber ? (
                        <Text style={styles.receiptItemPartNum}>Part: {it.partNumber}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.receiptItemPrice, { width: 56 }]}>£{Number(it.unitPrice || 0).toFixed(2)}</Text>
                    <Text style={[styles.receiptItemQty, { width: 32 }]}>{it.quantity}</Text>
                    <Text style={[styles.receiptItemTotal, { width: 62 }]}>£{Number(it.totalPrice || 0).toFixed(2)}</Text>
                  </View>
                ))}

                <View style={styles.receiptDashedDivider} />

                {/* Totals Breakdown */}
                <View style={styles.receiptTotalsRow}>
                  <Text style={styles.receiptTotalsKey}>Subtotal (Excl. VAT):</Text>
                  <Text style={styles.receiptTotalsVal}>£{subtotal.toFixed(2)}</Text>
                </View>
                {discountAmount > 0 ? (
                  <View style={styles.receiptTotalsRow}>
                    <Text style={[styles.receiptTotalsKey, { color: '#DC2626' }]}>{discountLabel}</Text>
                    <Text style={[styles.receiptTotalsVal, { color: '#DC2626' }]}>-£{discountAmount.toFixed(2)}</Text>
                  </View>
                ) : null}
                <View style={styles.receiptTotalsRow}>
                  <Text style={styles.receiptTotalsKey}>Standard UK VAT ({vatRate}%):</Text>
                  <Text style={styles.receiptTotalsVal}>£{vatAmount.toFixed(2)}</Text>
                </View>

                <View style={styles.receiptDoubleDivider} />

                <View style={[styles.receiptTotalsRow, { marginTop: 4 }]}>
                  <Text style={styles.receiptGrandTotalKey}>TOTAL AMOUNT:</Text>
                  <Text style={styles.receiptGrandTotalVal}>£{grandTotal.toFixed(2)}</Text>
                </View>

                <View style={[styles.receiptMetaRow, { marginTop: 8, alignItems: 'center' }]}>
                  <Text style={styles.receiptMetaKey}>Payment Method:</Text>
                  <View style={styles.receiptCashTag}>
                    <Text style={styles.receiptCashTagText}>💵 CASH ONLY</Text>
                  </View>
                </View>

                <View style={[styles.receiptMetaRow, { marginTop: 4, alignItems: 'center' }]}>
                  <Text style={styles.receiptMetaKey}>Payment Status:</Text>
                  <Text style={[
                    styles.receiptStatusText,
                    { color: paymentStatus === 'Paid' ? '#059669' : '#D97706' }
                  ]}>
                    {paymentStatus === 'Paid' ? 'PAID IN CASH' : 'CASH DUE ON COLLECTION'}
                  </Text>
                </View>

                {notes ? (
                  <View style={styles.receiptNotesBox}>
                    <Text style={styles.receiptNotesTitle}>Technician Notes:</Text>
                    <Text style={styles.receiptNotesContent}>{notes}</Text>
                  </View>
                ) : null}

                <View style={styles.receiptDashedDivider} />

                <Text style={styles.receiptFooterText}>
                  Thank you for choosing {garageName}!{'\n'}
                  Please retain this receipt bill for vehicle warranty & service records.
                </Text>
              </View>
            </ScrollView>
          )}

          {/* Footer actions: Download PDF & Close (Web View button completely removed) */}
          <View style={[styles.footerBar, { borderTopColor: theme.colors.border }]}>
            <TouchableOpacity
              onPress={handleDownloadReceipt}
              style={[styles.downloadBtn, { backgroundColor: '#10B981' }]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="download" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.downloadBtnText}>📥 Download Receipt (PDF)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeModalBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.closeModalBtnText, { color: theme.colors.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    height: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  subText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  receiptScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  receiptPaper: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FAFAF7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  receiptGarageTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  receiptGarageSub: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  receiptBadgeWrap: {
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    marginTop: 8,
    alignSelf: 'center',
  },
  receiptBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  receiptDashedDivider: {
    width: '100%',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
    marginVertical: 8,
  },
  receiptDoubleDivider: {
    width: '100%',
    height: 4,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#111827',
    marginVertical: 8,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 2.5,
    gap: 6,
  },
  receiptMetaKey: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: '#4B5563',
    flexShrink: 0,
  },
  receiptMetaVal: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#111827',
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  receiptVrnBox: {
    backgroundColor: '#FFD200',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#111827',
    alignSelf: 'flex-end',
  },
  receiptVrnText: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    color: '#111827',
    letterSpacing: 1,
  },
  receiptItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  receiptItemColHeader: {
    fontSize: 9.5,
    fontFamily: fonts.bold,
    color: '#374151',
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4.5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  receiptItemDesc: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: '#111827',
    flexWrap: 'wrap',
  },
  receiptItemPartNum: {
    fontSize: 9,
    fontFamily: fonts.regular,
    color: '#6B7280',
    marginTop: 1,
    flexWrap: 'wrap',
  },
  receiptItemPrice: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    color: '#4B5563',
    textAlign: 'right',
  },
  receiptItemQty: {
    fontSize: 10.5,
    fontFamily: fonts.medium,
    color: '#111827',
    textAlign: 'center',
  },
  receiptItemTotal: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#111827',
    textAlign: 'right',
  },
  receiptTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2.5,
    gap: 6,
  },
  receiptTotalsKey: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: '#4B5563',
    flex: 1,
  },
  receiptTotalsVal: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
    color: '#111827',
    textAlign: 'right',
    flexShrink: 0,
  },
  receiptGrandTotalKey: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: '#111827',
    flex: 1,
  },
  receiptGrandTotalVal: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#10B981',
    textAlign: 'right',
    flexShrink: 0,
  },
  receiptCashTag: {
    backgroundColor: '#10B98115',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  receiptCashTagText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#065F46',
  },
  receiptStatusText: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.bold,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  receiptNotesBox: {
    marginTop: 6,
    backgroundColor: '#F3F4F6',
    padding: 7,
    borderRadius: 4,
  },
  receiptNotesTitle: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#374151',
    marginBottom: 2,
  },
  receiptNotesContent: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    color: '#4B5563',
    lineHeight: 14,
  },
  receiptFooterText: {
    fontSize: 9.5,
    fontFamily: fonts.regular,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 13,
    paddingHorizontal: 6,
  },
  footerBar: {
    padding: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
  },
  downloadBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  closeModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
  },
});
