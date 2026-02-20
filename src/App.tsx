import { useEffect, useMemo, useRef, useState } from 'react'
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
  signatureImageDataUrl: string
  signatureImageMimeType: string
  signatureImageWidth: number
  signatureImageHeight: number
  fullName: string
  place: string
  date: string
  mobileNumber: string
}

type StoredProfiles = Record<string, FormState>

type FittedDimensions = {
  width: number
  height: number
}

type DocSignatureImage = {
  data: Uint8Array
  type: 'png' | 'jpg'
  width: number
  height: number
}

const STORAGE_KEY = 'bits-consent-profiles-v1'

const createInitialFormState = (): FormState => ({
  bhawan: '',
  parentRelation: 'father',
  childName: '',
  idNumber: '',
  leaveFrom: '',
  leaveTo: '',
  signatureName: '',
  signatureImageDataUrl: '',
  signatureImageMimeType: '',
  signatureImageWidth: 0,
  signatureImageHeight: 0,
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

const fitWithin = (
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
): FittedDimensions => {
  if (!sourceWidth || !sourceHeight) {
    return { width: maxWidth, height: maxHeight }
  }

  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1)

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

const normalizeProfile = (input: Partial<FormState>): FormState => {
  const base = createInitialFormState()

  return {
    ...base,
    ...input,
    parentRelation: input.parentRelation === 'mother' ? 'mother' : 'father',
    signatureImageDataUrl:
      typeof input.signatureImageDataUrl === 'string' ? input.signatureImageDataUrl : '',
    signatureImageMimeType:
      typeof input.signatureImageMimeType === 'string' ? input.signatureImageMimeType : '',
    signatureImageWidth:
      typeof input.signatureImageWidth === 'number' ? input.signatureImageWidth : 0,
    signatureImageHeight:
      typeof input.signatureImageHeight === 'number' ? input.signatureImageHeight : 0,
  }
}

const loadProfilesFromLocalStorage = (): StoredProfiles => {
  if (typeof window === 'undefined') return {}

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<FormState>>
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([id, profile]) => [id, normalizeProfile(profile)]),
    )
  } catch {
    return {}
  }
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read signature image.'))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read signature image.'))
    reader.readAsDataURL(file)
  })

const getImageDimensions = (dataUrl: string): Promise<FittedDimensions> =>
  new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }

    image.onerror = () => reject(new Error('Invalid image file.'))
    image.src = dataUrl
  })

const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const [, encodedPart = ''] = dataUrl.split(',')
  const binary = atob(encodedPart)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

const buildDocxDocument = async (formData: FormState, signatureImage: DocSignatureImage | null) => {
  const {
    AlignmentType,
    Document,
    ImageRun,
    Packer,
    Paragraph,
    TabStopType,
    TextRun,
    UnderlineType,
  } = await import('docx')

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

  const document = new Document({
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
          signatureImage
            ? new Paragraph({
                spacing: { after: 100 },
                children: [
                  new ImageRun({
                    type: signatureImage.type,
                    data: signatureImage.data,
                    transformation: {
                      width: signatureImage.width,
                      height: signatureImage.height,
                    },
                  }),
                ],
              })
            : new Paragraph({
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

  return { document, Packer }
}

const buildPdfBlob = async (formData: FormState): Promise<Blob> => {
  const { jsPDF } = await import('jspdf')
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
  addWrapped(
    'the academic assignments of the respective courses that s/he is currently enrolled in.',
    12,
  )
  addWrapped('Thanking You,', 16)

  const signatureBoxWidth = 170
  const signatureBoxHeight = 52

  if (formData.signatureImageDataUrl) {
    const fit = fitWithin(
      formData.signatureImageWidth,
      formData.signatureImageHeight,
      signatureBoxWidth,
      signatureBoxHeight,
    )

    const imageY = y
    const imageType = formData.signatureImageMimeType.includes('png') ? 'PNG' : 'JPEG'

    pdf.addImage(
      formData.signatureImageDataUrl,
      imageType,
      left,
      imageY,
      fit.width,
      fit.height,
      undefined,
      'FAST',
    )

    y += signatureBoxHeight + 4
  } else {
    addWrapped(formData.signatureName || formData.fullName || '___________________________', 2)
  }

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
      formData.signatureName || formData.signatureImageDataUrl,
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

  const clearSignatureImage = () => {
    setFormData((current) => ({
      ...current,
      signatureImageDataUrl: '',
      signatureImageMimeType: '',
      signatureImageWidth: 0,
      signatureImageHeight: 0,
    }))
  }

  const onSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Use PNG or JPEG image for signature.')
      event.target.value = ''
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      const dimensions = await getImageDimensions(dataUrl)

      setFormData((current) => ({
        ...current,
        signatureImageDataUrl: dataUrl,
        signatureImageMimeType: file.type,
        signatureImageWidth: dimensions.width,
        signatureImageHeight: dimensions.height,
      }))
      setError(null)
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Failed to process signature image.',
      )
    } finally {
      event.target.value = ''
    }
  }

  const buildValidatedData = (): FormState | null => {
    if (!formRef.current?.reportValidity()) {
      return null
    }

    const normalizedId = normalizeText(formData.idNumber)

    if (!normalizedId) {
      setError('Enter a Student ID Number to save this person.')
      return null
    }

    return {
      ...formData,
      idNumber: normalizedId,
    }
  }

  const persistProfile = (data: FormState) => {
    setFormData(data)
    setProfiles((current) => ({
      ...current,
      [data.idNumber]: data,
    }))
    setSelectedPersonId(data.idNumber)
  }

  const saveCurrentPerson = () => {
    const data = buildValidatedData()
    if (!data) return

    persistProfile(data)
    setError(null)
  }

  const loadSelectedPerson = () => {
    if (!selectedPersonId || !profiles[selectedPersonId]) {
      setError('Select a saved person ID to load details.')
      return
    }

    setFormData(normalizeProfile(profiles[selectedPersonId]))
    setError(null)
  }

  const buildDocSignatureImage = (data: FormState): DocSignatureImage | null => {
    if (!data.signatureImageDataUrl) {
      return null
    }

    const fit = fitWithin(
      data.signatureImageWidth,
      data.signatureImageHeight,
      220,
      70,
    )

    return {
      data: dataUrlToUint8Array(data.signatureImageDataUrl),
      type: data.signatureImageMimeType.includes('png') ? 'png' : 'jpg',
      width: fit.width,
      height: fit.height,
    }
  }

  const generateDocx = async () => {
    const data = buildValidatedData()
    if (!data) return

    setIsGenerating(true)
    setError(null)

    try {
      persistProfile(data)
      const { document, Packer } = await buildDocxDocument(
        data,
        buildDocSignatureImage(data),
      )
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
    const data = buildValidatedData()
    if (!data) return

    setIsGenerating(true)
    setError(null)

    try {
      persistProfile(data)
      const blob = await buildPdfBlob(data)
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
            Fill once, save person details in this browser, upload a signature image,
            and export as DOCX or PDF.
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
            Profiles (including signature image) are saved in browser localStorage.
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
              placeholder="Used if no image is uploaded"
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

          <label className="span-2">
            Signature Image (PNG/JPEG)
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={onSignatureUpload}
            />
          </label>

          {formData.signatureImageDataUrl ? (
            <div className="signature-preview span-2">
              <img src={formData.signatureImageDataUrl} alt="Uploaded signature" />
              <div className="signature-meta">
                <span>
                  {formData.signatureImageWidth} x {formData.signatureImageHeight}px
                </span>
                <button
                  type="button"
                  className="ghost"
                  onClick={clearSignatureImage}
                >
                  Remove Image
                </button>
              </div>
            </div>
          ) : null}

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
            <button
              type="button"
              className="primary"
              disabled={isGenerating}
              onClick={generateDocx}
            >
              {isGenerating ? 'Working...' : 'Generate DOCX'}
            </button>
            <button
              type="button"
              className="primary"
              disabled={isGenerating}
              onClick={generatePdf}
            >
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
