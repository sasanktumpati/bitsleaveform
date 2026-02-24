import { useRef, useState, useCallback, useEffect } from 'react'
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

type CropRect = { x: number; y: number; w: number; h: number }

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

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const daysBetween = (from: string, to: string): number =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)

const STORAGE_KEY = 'bits-leave-form'

const SAVED_FIELDS: (keyof FormState)[] = [
  'bhawan', 'parentRelation', 'childName', 'idNumber',
  'signatureName', 'signatureImageDataUrl', 'signatureImageMimeType',
  'signatureImageWidth', 'signatureImageHeight',
  'fullName', 'place', 'mobileNumber',
]

const createInitialFormState = (): FormState => {
  const base: FormState = {
    bhawan: '',
    parentRelation: 'father',
    childName: '',
    idNumber: '',
    leaveFrom: new Date().toISOString().slice(0, 10),
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
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      for (const key of SAVED_FIELDS) {
        if (saved[key] !== undefined) {
          ;(base as Record<string, unknown>)[key] = saved[key]
        }
      }
    }
  } catch { /* ignore */ }
  return base
}

const saveFormData = (data: FormState) => {
  try {
    const toSave: Record<string, unknown> = {}
    for (const key of SAVED_FIELDS) toSave[key] = data[key]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch { /* ignore */ }
}

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

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read signature image.'))
    }
    reader.onerror = () => reject(new Error('Failed to read signature image.'))
    reader.readAsDataURL(file)
  })

const getImageDimensions = (dataUrl: string): Promise<FittedDimensions> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Invalid image file.'))
    image.src = dataUrl
  })

const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const [, encodedPart = ''] = dataUrl.split(',')
  const binary = atob(encodedPart)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const buildDocxDocument = async (
  formData: FormState,
  signatureImage: DocSignatureImage | null,
) => {
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
    return new TextRun({ text, underline: { type: UnderlineType.SINGLE } })
  }

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 380 },
            children: [new TextRun({ text: 'Parent Consent Form', bold: true, size: 30 })],
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
                children: [
                  underlinedFieldRun(formData.signatureName || formData.fullName, 24),
                ],
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
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const templateResponse = await fetch(consentTemplateUrl)
  if (!templateResponse.ok) throw new Error('Unable to load the consent template PDF.')

  const templateBytes = await templateResponse.arrayBuffer()
  const pdfDoc = await PDFDocument.load(templateBytes)
  const page = pdfDoc.getPage(0)
  const pageHeight = page.getHeight()
  const bodyFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)

  const maskField = (x: number, yMax: number, width: number, height = 14) => {
    page.drawRectangle({
      x,
      y: pageHeight - yMax - 1,
      width,
      height,
      color: rgb(1, 1, 1),
    })
  }

  const fitTextToWidth = (value: string, maxWidth: number, size: number) => {
    const text = normalizeText(value)
    if (!text) return ''
    if (bodyFont.widthOfTextAtSize(text, size) <= maxWidth) return text
    let clipped = text
    while (clipped.length > 0) {
      const next = `${clipped}...`
      if (bodyFont.widthOfTextAtSize(next, size) <= maxWidth) return next
      clipped = clipped.slice(0, -1)
    }
    return ''
  }

  const drawTextOnLine = (
    value: string,
    x: number,
    yMax: number,
    maxWidth: number,
    size = 12,
    mask = false,
    underline = false,
  ) => {
    if (mask) maskField(x, yMax, maxWidth)
    if (underline) {
      const baselineY = pageHeight - yMax + 1.2
      page.drawLine({
        start: { x, y: baselineY - 2 },
        end: { x: x + maxWidth, y: baselineY - 2 },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      })
    }
    const text = fitTextToWidth(value, maxWidth, size)
    if (!text) return
    page.drawText(text, {
      x,
      y: pageHeight - yMax + 1.2,
      size,
      font: bodyFont,
      color: rgb(0, 0, 0),
    })
  }

  drawTextOnLine(formData.bhawan, 56.8, 169.301, 77.5, 12, true, true)
  drawTextOnLine(formData.parentRelation, 66.796, 255.701, 64.95, 12, true)
  drawTextOnLine(formData.childName, 147.916, 255.701, 180, 12, true, true)
  drawTextOnLine(formData.idNumber, 427.576, 255.701, 111, 12, true, true)
  drawTextOnLine(formatDate(formData.leaveFrom), 289.216, 277.301, 108, 12, true, true)
  drawTextOnLine(formatDate(formData.leaveTo), 415.06, 277.301, 123, 12, true, true)
  drawTextOnLine(formData.fullName, 116.5, 471.701, 290, 12)
  drawTextOnLine(formData.place, 90, 493.301, 312, 12)
  drawTextOnLine(formatDate(formData.date), 441, 493.301, 95, 12)
  drawTextOnLine(formData.mobileNumber, 140, 514.901, 260, 12)

  if (formData.signatureImageDataUrl) {
    const area = { x: 56.8, yTop: 385.4, width: 138, height: 40 }
    const fit = fitWithin(
      formData.signatureImageWidth,
      formData.signatureImageHeight,
      area.width,
      area.height,
    )
    const data = dataUrlToUint8Array(formData.signatureImageDataUrl)
    const image = formData.signatureImageMimeType.includes('png')
      ? await pdfDoc.embedPng(data)
      : await pdfDoc.embedJpg(data)
    page.drawImage(image, {
      x: area.x + (area.width - fit.width) / 2,
      y: pageHeight - area.yTop - fit.height - (area.height - fit.height) / 2,
      width: fit.width,
      height: fit.height,
    })
  } else {
    drawTextOnLine(
      formData.signatureName || formData.fullName,
      56.8,
      428.501,
      138,
      11.5,
      true,
      true,
    )
  }

  const bytes = await pdfDoc.save()
  return new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
}

function App() {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [formData, setFormData] = useState<FormState>(createInitialFormState)
  const [duration, setDuration] = useState<number | ''>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Crop state
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const cropImgRef = useRef<HTMLImageElement | null>(null)
  const cropAreaRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => { saveFormData(formData) }, [formData])

  const set = (key: keyof FormState, value: string) =>
    setFormData((s) => ({ ...s, [key]: value }))

  // Leave date handlers
  const handleLeaveFrom = (value: string) => {
    setFormData((s) => {
      const next = { ...s, leaveFrom: value }
      if (duration !== '' && duration > 0 && value) {
        next.leaveTo = addDays(value, duration)
      }
      return next
    })
  }

  const handleDuration = (days: number | '') => {
    setDuration(days)
    if (days !== '' && days > 0 && formData.leaveFrom) {
      setFormData((s) => ({ ...s, leaveTo: addDays(s.leaveFrom, days) }))
    }
  }

  const handleLeaveTo = (value: string) => {
    setFormData((s) => ({ ...s, leaveTo: value }))
    if (value && formData.leaveFrom) {
      const diff = daysBetween(formData.leaveFrom, value)
      setDuration(diff > 0 ? diff : '')
    } else {
      setDuration('')
    }
  }

  const clearSignature = () => {
    setFormData((s) => ({
      ...s,
      signatureImageDataUrl: '',
      signatureImageMimeType: '',
      signatureImageWidth: 0,
      signatureImageHeight: 0,
    }))
    setCropSource(null)
    setCropRect(null)
  }

  const onSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Use a PNG or JPEG for the signature.')
      e.target.value = ''
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const dim = await getImageDimensions(dataUrl)
      setFormData((s) => ({
        ...s,
        signatureImageDataUrl: dataUrl,
        signatureImageMimeType: file.type,
        signatureImageWidth: dim.width,
        signatureImageHeight: dim.height,
      }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image.')
    } finally {
      e.target.value = ''
    }
  }

  // Crop handlers
  const openCrop = () => {
    if (formData.signatureImageDataUrl) {
      setCropSource(formData.signatureImageDataUrl)
      setCropRect(null)
    }
  }

  const cancelCrop = () => {
    setCropSource(null)
    setCropRect(null)
  }

  const applyCrop = () => {
    const img = cropImgRef.current
    if (!img || !cropRect || cropRect.w < 5 || cropRect.h < 5) return
    const scaleX = img.naturalWidth / img.clientWidth
    const scaleY = img.naturalHeight / img.clientHeight
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(cropRect.w * scaleX)
    canvas.height = Math.round(cropRect.h * scaleY)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(
      img,
      Math.round(cropRect.x * scaleX),
      Math.round(cropRect.y * scaleY),
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    const dataUrl = canvas.toDataURL('image/png')
    setFormData((s) => ({
      ...s,
      signatureImageDataUrl: dataUrl,
      signatureImageMimeType: 'image/png',
      signatureImageWidth: canvas.width,
      signatureImageHeight: canvas.height,
    }))
    setCropSource(null)
    setCropRect(null)
  }

  const onCropPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const area = cropAreaRef.current
    if (!area) return
    area.setPointerCapture(e.pointerId)
    const rect = area.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    dragStart.current = { x, y }
    dragging.current = true
    setCropRect({ x, y, w: 0, h: 0 })
  }, [])

  const onCropPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !dragStart.current) return
    const area = cropAreaRef.current
    if (!area) return
    const rect = area.getBoundingClientRect()
    const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    const x = Math.min(dragStart.current.x, curX)
    const y = Math.min(dragStart.current.y, curY)
    const w = Math.abs(curX - dragStart.current.x)
    const h = Math.abs(curY - dragStart.current.y)
    setCropRect({ x, y, w, h })
  }, [])

  const onCropPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const validate = (): FormState | null => {
    if (!formRef.current?.reportValidity()) return null
    const id = normalizeText(formData.idNumber)
    if (!id) {
      setError('Student ID is required.')
      return null
    }
    return { ...formData, idNumber: id }
  }

  const filename = (ext: string) =>
    `${normalizeText(formData.idNumber) || 'consent-form'}.${ext}`

  const buildSigImage = (d: FormState): DocSignatureImage | null => {
    if (!d.signatureImageDataUrl) return null
    const fit = fitWithin(d.signatureImageWidth, d.signatureImageHeight, 220, 70)
    return {
      data: dataUrlToUint8Array(d.signatureImageDataUrl),
      type: d.signatureImageMimeType.includes('png') ? 'png' : 'jpg',
      width: fit.width,
      height: fit.height,
    }
  }

  const exportDocx = async () => {
    const data = validate()
    if (!data) return
    setIsGenerating(true)
    setError(null)
    try {
      const { document, Packer } = await buildDocxDocument(data, buildSigImage(data))
      triggerDownload(await Packer.toBlob(document), filename('docx'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DOCX export failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  const exportPdf = async () => {
    const data = validate()
    if (!data) return
    setIsGenerating(true)
    setError(null)
    try {
      triggerDownload(await buildPdfBlob(data), filename('pdf'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    setFormData({
      ...createInitialFormState(),
      bhawan: '', parentRelation: 'father', childName: '', idNumber: '',
      signatureName: '', signatureImageDataUrl: '', signatureImageMimeType: '',
      signatureImageWidth: 0, signatureImageHeight: 0,
      fullName: '', place: '', mobileNumber: '',
    })
    setDuration('')
    setCropSource(null)
    setCropRect(null)
    setError(null)
  }

  return (
    <main className="shell">
      <div className="card">
        <header className="header">
          <span className="campus">BITS Pilani, Pilani Campus</span>
          <h1>Parent Consent Form</h1>
          <p>Fill out and export as PDF or DOCX.</p>
        </header>

        <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
          {/* ── Student ── */}
          <div className="form-section">
            <h2 className="section-title">Student</h2>
            <div className="fields">
              <label>
                Bhawan
                <input
                  type="text"
                  placeholder="e.g. SR"
                  value={formData.bhawan}
                  onChange={(e) => set('bhawan', e.target.value)}
                  required
                />
              </label>
              <label>
                ID Number
                <input
                  type="text"
                  placeholder="2024A7PS0000P"
                  value={formData.idNumber}
                  onChange={(e) => set('idNumber', e.target.value)}
                  required
                />
              </label>
              <label className="full">
                Full Name
                <input
                  type="text"
                  placeholder="As per institute records"
                  value={formData.childName}
                  onChange={(e) => set('childName', e.target.value)}
                  required
                />
              </label>
            </div>
          </div>

          {/* ── Leave Period ── */}
          <div className="form-section">
            <h2 className="section-title">Leave Period</h2>
            <div className="fields cols-3">
              <label>
                From
                <input
                  type="date"
                  value={formData.leaveFrom}
                  onChange={(e) => handleLeaveFrom(e.target.value)}
                  required
                />
              </label>
              <label>
                Duration (days)
                <input
                  type="number"
                  min="1"
                  placeholder="Optional"
                  value={duration}
                  onChange={(e) =>
                    handleDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={formData.leaveTo}
                  onChange={(e) => handleLeaveTo(e.target.value)}
                  required
                />
              </label>
            </div>
          </div>

          {/* ── Parent / Guardian ── */}
          <div className="form-section">
            <h2 className="section-title">Parent / Guardian</h2>
            <div className="fields">
              <label>
                Relation
                <select
                  value={formData.parentRelation}
                  onChange={(e) => set('parentRelation', e.target.value as ParentRelation)}
                >
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                </select>
              </label>
              <label>
                Full Name
                <input
                  type="text"
                  placeholder="Parent's full name"
                  value={formData.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  required
                />
              </label>
              <label>
                Place
                <input
                  type="text"
                  placeholder="City"
                  value={formData.place}
                  onChange={(e) => set('place', e.target.value)}
                  required
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => set('date', e.target.value)}
                  required
                />
              </label>
              <label className="full">
                Mobile Number
                <input
                  type="tel"
                  placeholder="10 digit mobile"
                  value={formData.mobileNumber}
                  onChange={(e) => set('mobileNumber', e.target.value)}
                  required
                />
              </label>
            </div>
          </div>

          {/* ── Signature ── */}
          <div className="form-section">
            <h2 className="section-title">Signature</h2>
            <div className="fields">
              <label>
                Text (fallback)
                <input
                  type="text"
                  placeholder="Used when no image is uploaded"
                  value={formData.signatureName}
                  onChange={(e) => set('signatureName', e.target.value)}
                />
              </label>
              <label>
                Upload Image
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={onSignatureUpload}
                />
              </label>
            </div>

            {cropSource && (
              <div className="crop-container">
                <p className="crop-hint">Click and drag to select the area to keep</p>
                <div
                  className="crop-workspace"
                  ref={cropAreaRef}
                  onPointerDown={onCropPointerDown}
                  onPointerMove={onCropPointerMove}
                  onPointerUp={onCropPointerUp}
                >
                  <img
                    ref={cropImgRef}
                    src={cropSource}
                    alt="Crop source"
                    draggable={false}
                  />
                  {cropRect && cropRect.w > 0 && cropRect.h > 0 && (
                    <div
                      className="crop-selection"
                      style={{
                        left: cropRect.x,
                        top: cropRect.y,
                        width: cropRect.w,
                        height: cropRect.h,
                      }}
                    />
                  )}
                </div>
                <div className="crop-actions">
                  <button type="button" className="ghost small" onClick={cancelCrop}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary small"
                    onClick={applyCrop}
                    disabled={!cropRect || cropRect.w < 5 || cropRect.h < 5}
                  >
                    Apply Crop
                  </button>
                </div>
              </div>
            )}

            {formData.signatureImageDataUrl && !cropSource && (
              <div className="sig-preview" onClick={openCrop} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openCrop()}>
                <img src={formData.signatureImageDataUrl} alt="Signature" />
                <div className="sig-info">
                  <span>
                    {formData.signatureImageWidth}&times;{formData.signatureImageHeight}
                  </span>
                  <span className="crop-label">Click to crop</span>
                  <button type="button" className="ghost small" onClick={(e) => { e.stopPropagation(); clearSignature(); }}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="actions">
            <button type="button" className="ghost" onClick={reset}>
              Reset
            </button>
            <div className="actions-end">
              <button
                type="button"
                className="primary"
                disabled={isGenerating}
                onClick={exportDocx}
              >
                {isGenerating ? 'Exporting...' : 'Export DOCX'}
              </button>
              <button
                type="button"
                className="primary"
                disabled={isGenerating}
                onClick={exportPdf}
              >
                {isGenerating ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}

export default App
