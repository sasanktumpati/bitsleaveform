import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  UnderlineType,
} from 'docx'
import { jsPDF } from 'jspdf'
import './App.css'
import consentTemplateUrl from '../consentform.pdf?url'

type ParentRelation = 'mother' | 'father'

type FormState = {
  bhawan: string
  parentRelation: ParentRelation
  childName: string
  idNumber: string
  leaveFrom: string
  leaveTo: string
  signatureName: string
  fullName: string
  place: string
  date: string
  mobileNumber: string
}

type StoredProfiles = Record<string, FormState>

const STORAGE_KEY = 'bits-consent-profiles-v1'

const createInitialFormState = (): FormState => ({
  bhawan: '',
  parentRelation: 'father',
  childName: '',
  idNumber: '',
  leaveFrom: '',
  leaveTo: '',
  signatureName: '',
  fullName: '',
  place: '',
  date: new Date().toISOString().slice(0, 10),
  mobileNumber: '',
})

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim()

const formatDate = (isoDate: string): string => {
  if (!isoDate) return ''

  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate

  return `${day}/${month}/${year}`
}

const underlinedFieldRun = (value: string, minLength: number) => {
  const normalized = normalizeText(value)
  const text = normalized.padEnd(Math.max(minLength, normalized.length + 2), ' ')

  return new TextRun({
    text,
    underline: {
      type: UnderlineType.SINGLE,
    },
  })
}

const loadProfilesFromLocalStorage = (): StoredProfiles => {
  if (typeof window === 'undefined') return {}

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as StoredProfiles
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch {
    return {}
  }

  return {}
}

const buildDocxDocument = (formData: FormState) =>
  new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 380 },
            children: [
              new TextRun({
                text: 'Parent Consent Form',
                bold: true,
                size: 30,
              }),
            ],
          }),
          new Paragraph({ text: 'To', spacing: { after: 120 } }),
          new Paragraph({ text: 'The Warden', spacing: { after: 120 } }),
          new Paragraph({
            spacing: { after: 120 },
            children: [underlinedFieldRun(formData.bhawan, 16), new TextRun(' Bhawan')],
          }),
          new Paragraph({ text: 'BITS Pilani, Pilani Campus', spacing: { after: 120 } }),
          new Paragraph({ text: 'Dear Madam/Sir,', spacing: { after: 240 } }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun('I, '),
              new TextRun(formData.parentRelation),
              new TextRun(' of '),
              underlinedFieldRun(formData.childName, 34),
              new TextRun(' bearing ID Number '),
              underlinedFieldRun(formData.idNumber, 20),
              new TextRun(','),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun('am aware of my child applying for leave from '),
              underlinedFieldRun(formatDate(formData.leaveFrom), 16),
              new TextRun(' to '),
              underlinedFieldRun(formatDate(formData.leaveTo), 16),
              new TextRun('.'),
            ],
          }),
          new Paragraph({
            text: 'Kindly grant her/him leave for the above-mentioned time period.',
            spacing: { after: 160 },
          }),
          new Paragraph({
            text: 'I understand that this leave is granted with the assumption that my child is solely responsible for all',
            spacing: { after: 120 },
          }),
          new Paragraph({
            text: 'the academic assignments of the respective courses that s/he is currently enrolled in.',
            spacing: { after: 160 },
          }),
          new Paragraph({ text: 'Thanking You,', spacing: { after: 560 } }),
          new Paragraph({
            spacing: { after: 100 },
            children: [underlinedFieldRun(formData.signatureName || formData.fullName, 24)],
          }),
          new Paragraph({ text: '(Signature)', spacing: { after: 220 } }),
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun('Full Name: '), underlinedFieldRun(formData.fullName, 36)],
          }),
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: 8800 }],
            spacing: { after: 140 },
            children: [
              new TextRun('Place: '),
              underlinedFieldRun(formData.place, 18),
              new TextRun('\t'),
              new TextRun('Date: '),
              underlinedFieldRun(formatDate(formData.date), 16),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun('Mobile Number: '),
              underlinedFieldRun(formData.mobileNumber, 24),
            ],
          }),
        ],
      },
    ],
  })

const buildPdfBlob = (formData: FormState): Blob => {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const left = 56
  const width = 483
  let y = 70

  const addWrapped = (text: string, after = 18) => {
    const lines = pdf.splitTextToSize(text, width) as string[]
    lines.forEach((line) => {
      pdf.text(line, left, y)
      y += 18
    })
    y += after
  }

  pdf.setFont('times', 'bold')
  pdf.setFontSize(16)
  pdf.text('Parent Consent Form', 297.5, y, { align: 'center' })

  y += 40
  pdf.setFont('times', 'normal')
  pdf.setFontSize(12)

  addWrapped('To', 2)
  addWrapped('The Warden', 2)
  addWrapped(`${formData.bhawan || '________________'} Bhawan`, 2)
  addWrapped('BITS Pilani, Pilani Campus', 2)
  addWrapped('Dear Madam/Sir,', 16)

  addWrapped(
    `I, ${formData.parentRelation} of ${formData.childName || '____________________'} bearing ID Number ${formData.idNumber || '____________________'},`,
    0,
  )

  addWrapped(
    `am aware of my child applying for leave from ${formatDate(formData.leaveFrom) || '____________'} to ${formatDate(formData.leaveTo) || '____________'}.`,
    0,
  )

  addWrapped('Kindly grant her/him leave for the above-mentioned time period.', 0)
  addWrapped(
    'I understand that this leave is granted with the assumption that my child is solely responsible for all',
    0,
  )
  addWrapped('the academic assignments of the respective courses that s/he is currently enrolled in.', 12)
  addWrapped('Thanking You,', 42)

  addWrapped(formData.signatureName || formData.fullName || '___________________________', 2)
  addWrapped('(Signature)', 12)
  addWrapped(`Full Name: ${formData.fullName || '___________________________'}`, 0)
  addWrapped(
    `Place: ${formData.place || '________________'}                                  Date: ${formatDate(formData.date) || '____________'}`,
    0,
  )
  addWrapped(`Mobile Number: ${formData.mobileNumber || '________________________'}`, 0)

  return pdf.output('blob')
}

function App() {
  const formRef = useRef<HTMLFormElement | null>(null)

  const [formData, setFormData] = useState<FormState>(createInitialFormState)
  const [profiles, setProfiles] = useState<StoredProfiles>(() => loadProfilesFromLocalStorage())
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [generatedDocxUrl, setGeneratedDocxUrl] = useState<string | null>(null)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  }, [profiles])

  useEffect(() => {
    return () => {
      if (generatedDocxUrl) URL.revokeObjectURL(generatedDocxUrl)
      if (generatedPdfUrl) URL.revokeObjectURL(generatedPdfUrl)
    }
  }, [generatedDocxUrl, generatedPdfUrl])

  const savedPersonIds = useMemo(
    () => Object.keys(profiles).sort((first, second) => first.localeCompare(second)),
    [profiles],
  )

  const filledFieldsCount = useMemo(() => {
    const fieldValues = [
      formData.bhawan,
      formData.childName,
      formData.idNumber,
      formData.leaveFrom,
      formData.leaveTo,
      formData.signatureName,
      formData.fullName,
      formData.place,
      formData.date,
      formData.mobileNumber,
    ]

    return fieldValues.filter((value) => value.trim() !== '').length
  }, [formData])

  const onValueChange = (key: keyof FormState, value: string) => {
    setFormData((current) => ({ ...current, [key]: value }))
  }

  const saveCurrentPerson = (): boolean => {
    const personId = normalizeText(formData.idNumber)

    if (!personId) {
      setError('Enter a Student ID Number to save this person.')
      return false
    }

    const normalizedForm = {
      ...formData,
      idNumber: personId,
    }

    setFormData(normalizedForm)
    setProfiles((current) => ({
      ...current,
      [personId]: normalizedForm,
    }))
    setSelectedPersonId(personId)
    setError(null)

    return true
  }

  const loadSelectedPerson = () => {
    if (!selectedPersonId || !profiles[selectedPersonId]) {
      setError('Select a saved person ID to load details.')
      return
    }

    setFormData(profiles[selectedPersonId])
    setError(null)
  }

  const ensureValidAndSaved = (): boolean => {
    if (!formRef.current?.reportValidity()) return false
    return saveCurrentPerson()
  }

  const generateDocx = async () => {
    if (!ensureValidAndSaved()) return

    setIsGenerating(true)
    setError(null)

    try {
      const document = buildDocxDocument(formData)
      const blob = await Packer.toBlob(document)
      const nextUrl = URL.createObjectURL(blob)

      setGeneratedDocxUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl)
        return nextUrl
      })
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'DOCX generation failed. Please try again.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const generatePdf = async () => {
    if (!ensureValidAndSaved()) return

    setIsGenerating(true)
    setError(null)

    try {
      const blob = buildPdfBlob(formData)
      const nextUrl = URL.createObjectURL(blob)

      setGeneratedPdfUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl)
        return nextUrl
      })
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'PDF generation failed. Please try again.',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const resetForm = () => {
    setFormData(createInitialFormState())
    setError(null)
  }

  return (
    <main className="portal-shell">
      <div className="ambient-glow" aria-hidden="true" />

      <section className="portal-card">
        <header className="portal-header">
          <p className="badge">BITS Pilani</p>
          <h1>Parent Consent Form Assistant</h1>
          <p>
            Fill once, save person details in this browser, and export as DOCX or PDF.
          </p>
        </header>

        <div className="meta-strip">
          <span>Original reference: consentform.pdf</span>
          <span>{filledFieldsCount}/10 fields filled</span>
          <span>{savedPersonIds.length} saved profiles</span>
        </div>

        <section className="profile-tools">
          <label>
            Saved Person (by Student ID)
            <div className="profile-row">
              <select
                value={selectedPersonId}
                onChange={(event) => setSelectedPersonId(event.target.value)}
              >
                <option value="">Select saved ID</option>
                {savedPersonIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <button type="button" className="ghost" onClick={loadSelectedPerson}>
                Load
              </button>
              <button type="button" className="ghost" onClick={saveCurrentPerson}>
                Save Current
              </button>
            </div>
          </label>
          <p className="helper-note">
            Profiles are saved to your browser localStorage on this device.
          </p>
        </section>

        <form ref={formRef} className="field-grid">
          <label>
            Bhawan
            <input
              type="text"
              placeholder="e.g. SR Bhawan"
              value={formData.bhawan}
              onChange={(event) => onValueChange('bhawan', event.target.value)}
              required
            />
          </label>

          <label>
            Parent Relation
            <select
              value={formData.parentRelation}
              onChange={(event) =>
                onValueChange('parentRelation', event.target.value as ParentRelation)
              }
            >
              <option value="mother">Mother</option>
              <option value="father">Father</option>
            </select>
          </label>

          <label className="span-2">
            Student Name
            <input
              type="text"
              placeholder="Child name as per records"
              value={formData.childName}
              onChange={(event) => onValueChange('childName', event.target.value)}
              required
            />
          </label>

          <label>
            Student ID Number
            <input
              type="text"
              placeholder="2024A7PS0000P"
              value={formData.idNumber}
              onChange={(event) => onValueChange('idNumber', event.target.value)}
              required
            />
          </label>

          <label>
            Leave From
            <input
              type="date"
              value={formData.leaveFrom}
              onChange={(event) => onValueChange('leaveFrom', event.target.value)}
              required
            />
          </label>

          <label>
            Leave To
            <input
              type="date"
              value={formData.leaveTo}
              onChange={(event) => onValueChange('leaveTo', event.target.value)}
              required
            />
          </label>

          <label>
            Signature Text
            <input
              type="text"
              placeholder="Name or initials"
              value={formData.signatureName}
              onChange={(event) => onValueChange('signatureName', event.target.value)}
            />
          </label>

          <label>
            Full Name
            <input
              type="text"
              placeholder="Parent full name"
              value={formData.fullName}
              onChange={(event) => onValueChange('fullName', event.target.value)}
              required
            />
          </label>

          <label>
            Place
            <input
              type="text"
              placeholder="City"
              value={formData.place}
              onChange={(event) => onValueChange('place', event.target.value)}
              required
            />
          </label>

          <label>
            Date
            <input
              type="date"
              value={formData.date}
              onChange={(event) => onValueChange('date', event.target.value)}
              required
            />
          </label>

          <label className="span-2">
            Mobile Number
            <input
              type="tel"
              placeholder="10 digit mobile"
              value={formData.mobileNumber}
              onChange={(event) => onValueChange('mobileNumber', event.target.value)}
              required
            />
          </label>

          <div className="actions span-2">
            <button type="button" className="ghost" onClick={resetForm}>
              Reset
            </button>
            <button type="button" className="primary" disabled={isGenerating} onClick={generateDocx}>
              {isGenerating ? 'Working...' : 'Generate DOCX'}
            </button>
            <button type="button" className="primary" disabled={isGenerating} onClick={generatePdf}>
              {isGenerating ? 'Working...' : 'Export PDF'}
            </button>
          </div>
        </form>

        {error ? <p className="error-note">{error}</p> : null}

        <section className="preview">
          <div className="preview-head">
            <h2>Output</h2>
            <a href={consentTemplateUrl} target="_blank" rel="noreferrer">
              Open original PDF
            </a>
          </div>

          {generatedDocxUrl || generatedPdfUrl ? (
            <div className="downloads">
              {generatedDocxUrl ? (
                <a className="download-link" href={generatedDocxUrl} download="filled-consent-form.docx">
                  Download filled-consent-form.docx
                </a>
              ) : null}
              {generatedPdfUrl ? (
                <a className="download-link" href={generatedPdfUrl} download="filled-consent-form.pdf">
                  Download filled-consent-form.pdf
                </a>
              ) : null}
            </div>
          ) : (
            <p className="placeholder">Generate DOCX or PDF to download it here.</p>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
