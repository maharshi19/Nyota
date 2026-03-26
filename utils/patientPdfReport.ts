import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BoardItem } from '../types';

const toText = (value: unknown, fallback = 'N/A'): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const asCurrency = (value: number | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  return `$${value.toLocaleString()}`;
};

const addSectionTitle = (doc: jsPDF, title: string, y: number): number => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(28, 64, 56);
  doc.text(title, 40, y);
  return y + 10;
};

const sanitizeFileName = (text: string): string => text.replace(/[^a-zA-Z0-9-_]/g, '_');

export const downloadPatientPdfReport = (item: BoardItem): boolean => {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedAt = new Date().toLocaleString();

  doc.setFillColor(236, 247, 243);
  doc.rect(0, 0, pageWidth, 78, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(25, 53, 46);
  doc.text('Nyota Patient Intelligence Report', 40, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(70, 90, 82);
  doc.text(`Generated: ${generatedAt}`, 40, 62);

  const patientSummaryRows = [
    ['Patient Name', toText(item.name)],
    ['MRN', toText(item.mrn)],
    ['Status', toText(item.status)],
    ['Triage', toText(item.triage)],
    ['Risk Rank', toText(item.riskRank)],
    ['Last Updated', toText(item.lastUpdated)],
    ['Chief Complaint', toText(item.caseData?.chiefComplaint)],
    ['Age', toText(item.caseData?.age)],
    ['Gestation', toText(item.caseData?.gestation)],
    ['Parity', toText(item.caseData?.parity)],
    ['Vitals', toText(item.caseData?.vitals)],
    ['ZIP', toText(item.caseData?.environmental?.zipCode)],
    ['Air Quality', toText(item.caseData?.environmental?.airQuality)],
    ['Heat Index', toText(item.caseData?.environmental?.heatIndex)],
    ['Social History', toText(item.caseData?.socialHistory)],
    ['Clinical Narrative', toText(item.caseData?.narrative)],
    ['Estimated Savings', asCurrency(item.estimatedSavings)],
  ];

  let y = addSectionTitle(doc, 'Patient Snapshot', 102);
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: patientSummaryRows,
    styles: { fontSize: 9, cellPadding: 5, textColor: [33, 44, 40] },
    headStyles: { fillColor: [47, 138, 116], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 251, 249] },
    margin: { left: 40, right: 40 },
  });

  const lastSummaryY = (doc as any).lastAutoTable?.finalY || 140;
  const analysis = item.analysis;

    if (!analysis) {
      y = addSectionTitle(doc, 'ML Intelligence', lastSummaryY + 24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 110, 104);
      doc.text('No AI/ML analysis available yet. Run clinical diagnostics to generate ML findings.', 40, y + 8);
      const fileName = sanitizeFileName(`${item.name}_${item.mrn}_patient_report.pdf`);
      doc.save(fileName);
      return true;
    }

  y = addSectionTitle(doc, 'ML Model Identification and Outputs', lastSummaryY + 24);
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Risk Score', `${toText(analysis.riskScore?.value)} (${toText(analysis.riskScore?.level)})`],
      ['Risk Window', toText(analysis.riskScore?.window)],
      ['C-Section Probability', `${toText(analysis.tmahMetrics?.cSectionProbability)}%`],
      ['NICU Probability', `${toText(analysis.tmahMetrics?.nicuProbability)}%`],
      ['Sentiment Score', `${toText(analysis.tmahMetrics?.sentimentScore)}%`],
      ['Resource Strain Index', toText(analysis.tmahMetrics?.resourceStrainIndex)],
      ['Admin Burden Saved', `${toText(analysis.tmahMetrics?.adminBurdenSaved)} hrs`],
      ['Primary SMM Condition', toText(item.smmCondition)],
      ['NICU Category', toText(item.nicuCategory)],
    ],
    styles: { fontSize: 9, cellPadding: 5, textColor: [33, 44, 40] },
    headStyles: { fillColor: [191, 138, 71], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 236] },
    margin: { left: 40, right: 40 },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 18;
  y = addSectionTitle(doc, 'What The Model Used (Evidence Basis)', y);
  autoTable(doc, {
    startY: y,
    head: [['Evidence Source', 'Extracted Value']],
    body: [
      ['Chief Complaint', toText(item.caseData?.chiefComplaint)],
      ['Vitals', toText(item.caseData?.vitals)],
      ['Labs (Raw)', toText(item.caseData?.labs)],
      ['Social History', toText(item.caseData?.socialHistory)],
      ['Environmental Vital Sign', toText(item.caseData?.environmentalVitalSign)],
      ['Zip + AQI + Heat', `${toText(item.caseData?.environmental?.zipCode)} | AQI ${toText(item.caseData?.environmental?.airQuality)} | Heat ${toText(item.caseData?.environmental?.heatIndex)}`],
      ['Cognitive Risk Factors', analysis.cognitiveContext?.riskFactors?.map((f) => `${f.factor} (${f.category}, ${f.significance})`).join('; ') || 'N/A'],
      ['Bias Correction Note', toText(analysis.biasCorrectionNote)],
    ],
    styles: { fontSize: 9, cellPadding: 5, textColor: [33, 44, 40] },
    headStyles: { fillColor: [47, 138, 116], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 250, 248] },
    margin: { left: 40, right: 40 },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 18;
  y = addSectionTitle(doc, 'Safety Checklist and Differential Diagnosis', y);

  const safetyRows = (analysis.safetyChecklist || []).map((s) => [s.category, s.status, s.finding]);
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Status', 'Finding']],
    body: safetyRows.length ? safetyRows : [['N/A', 'N/A', 'No checklist generated']],
    styles: { fontSize: 9, cellPadding: 5, textColor: [33, 44, 40] },
    headStyles: { fillColor: [195, 95, 82], textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: 40, right: 40 },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 12;
  const dxRows = (analysis.differentialDiagnosis || []).map((d) => [d.condition, d.likelihood, d.reasoning]);
  autoTable(doc, {
    startY: y,
    head: [['Condition', 'Likelihood', 'Reasoning']],
    body: dxRows.length ? dxRows : [['N/A', 'N/A', 'No differential diagnosis generated']],
    styles: { fontSize: 9, cellPadding: 5, textColor: [33, 44, 40] },
    headStyles: { fillColor: [191, 138, 71], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 245, 236] },
    margin: { left: 40, right: 40 },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 18;
  y = addSectionTitle(doc, 'Management Plan and Prescriptive Actions', y);
  const mgmtRows = (analysis.managementPlan || []).map((m) => [m.timing, m.action, m.rationale]);
  autoTable(doc, {
    startY: y,
    head: [['Timing', 'Action', 'Rationale']],
    body: mgmtRows.length ? mgmtRows : [['N/A', 'N/A', 'No management plan generated']],
    styles: { fontSize: 9, cellPadding: 5, textColor: [33, 44, 40] },
    headStyles: { fillColor: [47, 138, 116], textColor: [255, 255, 255], fontStyle: 'bold' },
    margin: { left: 40, right: 40 },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 12;
  const prescriptiveRows = (analysis.prescriptiveIntelligence || []).map((p) => [
    p.interventionType,
    p.action,
    asCurrency(p.cost),
    asCurrency(p.potentialSavings),
  ]);
  autoTable(doc, {
    startY: y,
    head: [['Intervention Type', 'Action', 'Estimated Cost', 'Potential Savings']],
    body: prescriptiveRows.length ? prescriptiveRows : [['N/A', 'N/A', 'N/A', 'N/A']],
    styles: { fontSize: 9, cellPadding: 5, textColor: [33, 44, 40] },
    headStyles: { fillColor: [31, 116, 97], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 250, 247] },
    margin: { left: 40, right: 40 },
  });

  if (analysis.keyLabs?.length) {
    y = ((doc as any).lastAutoTable?.finalY || y) + 18;
    y = addSectionTitle(doc, 'Key Lab Indicators', y);
    const labRows = analysis.keyLabs.map((l) => [l.name, l.value, l.unit, l.flag, l.trend || 'N/A']);
    autoTable(doc, {
      startY: y,
      head: [['Lab', 'Value', 'Unit', 'Flag', 'Trend']],
      body: labRows,
      styles: { fontSize: 9, cellPadding: 5, textColor: [33, 44, 40] },
      headStyles: { fillColor: [47, 138, 116], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: 40, right: 40 },
    });
  }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(113, 130, 123);
      doc.text(`Nyota Clinical Support | Patient Report | Page ${i} of ${pageCount}`, 40, 820);
    }

    const fileName = sanitizeFileName(`${item.name}_${item.mrn}_patient_report.pdf`);
    doc.save(fileName);
    return true;
  } catch (error) {
    // Keep this visible for debugging in browser devtools.
    console.error('Failed to generate/download patient PDF report:', error);
    return false;
  }
};
