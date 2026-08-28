import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Card, CardContent, CircularProgress, Container, IconButton, LinearProgress, Stack, TextField, Typography } from '@mui/material'

const SWIPE_THRESHOLD = 80
const STUDENTS_URL = 'https://raw.githubusercontent.com/tpemartin/econ115B/refs/heads/main/public/data/students.json'
const hasIntroduction = (student) => Boolean(student?.introduction?.trim())
const getCardId = (index) => `card_${String(index + 1).padStart(3, '0')}`

const pushAnalyticsEvent = (event) => {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(event)
}

function App() {
  const [students, setStudents] = useState([])
  const [loadError, setLoadError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const pointerStart = useRef(null)
  const navigationMethod = useRef('initial_load')
  const currentStudent = students[currentIndex] ?? null

  useEffect(() => {
    const controller = new AbortController()

    async function loadStudents() {
      try {
        const response = await fetch(STUDENTS_URL, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('Invalid student data')
        setStudents(data)
        const firstIntroducedIndex = data.findIndex(hasIntroduction)
        setCurrentIndex(firstIntroducedIndex >= 0 ? firstIntroducedIndex : 0)
        setLoadError('')
      } catch (error) {
        if (error.name !== 'AbortError') setLoadError('目前無法載入導生名單，請稍後重新整理頁面。')
      }
    }

    loadStudents()
    return () => controller.abort()
  }, [])

  const goTo = useCallback((index, method = 'direct') => {
    if (students.length === 0) return
    navigationMethod.current = method
    setCurrentIndex((index + students.length) % students.length)
    setDragX(0)
  }, [students.length])

  const goToIntroducedStudent = useCallback((direction, method) => {
    for (let offset = 1; offset <= students.length; offset += 1) {
      const candidateIndex = (currentIndex + direction * offset + students.length) % students.length
      if (hasIntroduction(students[candidateIndex])) {
        goTo(candidateIndex, method)
        return
      }
    }
  }, [currentIndex, goTo, students])

  const goPrevious = useCallback((method = 'previous_button') => goToIntroducedStudent(-1, method), [goToIntroducedStudent])
  const goNext = useCallback((method = 'next_button') => goToIntroducedStudent(1, method), [goToIntroducedStudent])
  const firstIntroducedIndex = students.findIndex(hasIntroduction)
  const hasIntroducedStudents = firstIntroducedIndex >= 0

  useEffect(() => {
    if (!currentStudent || !hasIntroduction(currentStudent)) return undefined

    const cardId = getCardId(currentIndex)
    let visibleSince = document.visibilityState === 'visible' ? performance.now() : null
    let visibleDuration = 0
    let sent = false

    pushAnalyticsEvent({
      event: 'student_card_view',
      card_id: cardId,
      navigation_method: navigationMethod.current,
    })

    const accumulateVisibleTime = () => {
      if (visibleSince !== null) {
        visibleDuration += performance.now() - visibleSince
        visibleSince = null
      }
    }

    const sendDuration = () => {
      if (sent) return
      accumulateVisibleTime()
      sent = true
      pushAnalyticsEvent({
        event: 'student_card_view_end',
        card_id: cardId,
        view_duration_ms: Math.round(visibleDuration),
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') accumulateVisibleTime()
      else if (!sent && visibleSince === null) visibleSince = performance.now()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', sendDuration)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', sendDuration)
      sendDuration()
    }
  }, [currentIndex, currentStudent])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowLeft') goPrevious('keyboard')
      if (event.key === 'ArrowRight') goNext('keyboard')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrevious])

  const finishSwipe = () => {
    if (dragX <= -SWIPE_THRESHOLD) goNext('swipe')
    else if (dragX >= SWIPE_THRESHOLD) goPrevious('swipe')
    else setDragX(0)
    pointerStart.current = null
    setIsDragging(false)
  }

  return (
    <Box component="main" className="page-shell">
      <Container maxWidth="sm" className="app-container">
        <Stack spacing={{ xs: 2.5, sm: 3 }}>
          <Autocomplete
            fullWidth options={students} value={currentStudent} disabled={!currentStudent}
            getOptionLabel={(option) => option.name}
            getOptionDisabled={(option) => !hasIntroduction(option)}
            isOptionEqualToValue={(option, value) => option.name === value.name}
            onChange={(_, value) => value && goTo(students.indexOf(value), 'search')}
            renderInput={(params) => <TextField {...params} label="快速搜尋" placeholder="輸入座號或姓名" />}
            noOptionsText="找不到符合的同學"
          />

          <Box className="card-stage" aria-live="polite">
            {!currentStudent && (
              <Stack alignItems="center" spacing={2}>
                {loadError ? <Alert severity="error">{loadError}</Alert> : <CircularProgress aria-label="正在載入導生名單" />}
              </Stack>
            )}
            {currentStudent && <Card
              className="student-card" elevation={0}
              onPointerDown={(event) => {
                pointerStart.current = event.clientX
                setIsDragging(true)
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                if (pointerStart.current !== null) setDragX(event.clientX - pointerStart.current)
              }}
              onPointerUp={finishSwipe} onPointerCancel={finishSwipe}
              sx={{ transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`, transition: isDragging ? 'none' : 'transform 220ms ease' }}
            >
              <CardContent className="card-content">
                <Box className="avatar" aria-hidden="true">{currentStudent.name.slice(-1)}</Box>
                <Typography component="h2" variant="h3" fontWeight={800}>{currentStudent.name}</Typography>
                <Box component="footer" className="introduction-scroll" tabIndex={0}>
                  <Typography color="text.secondary" className="introduction-text">
                    {currentStudent.introduction || '尚未填寫自我介紹'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>}
          </Box>

          <LinearProgress variant="determinate" value={currentStudent ? ((currentIndex + 1) / students.length) * 100 : 0} aria-label={currentStudent ? `目前為第 ${currentIndex + 1} 位，共 ${students.length} 位` : '正在載入導生名單'} />
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={2}>
            <IconButton className="nav-button" onClick={() => goPrevious('previous_button')} disabled={!hasIntroducedStudents} aria-label="上一位有自我介紹的同學">←</IconButton>
            <Button variant="text" onClick={() => goTo(firstIntroducedIndex, 'first_button')} disabled={!hasIntroducedStudents}>回到第一位</Button>
            <IconButton className="nav-button" onClick={() => goNext('next_button')} disabled={!hasIntroducedStudents} aria-label="下一位有自我介紹的同學">→</IconButton>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}

export default App
