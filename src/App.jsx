import { useCallback, useEffect, useRef, useState } from 'react'
import { Autocomplete, Box, Button, Card, CardContent, Container, IconButton, LinearProgress, Stack, TextField, Typography } from '@mui/material'
import students from './students.json'

const SWIPE_THRESHOLD = 80

function App() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const pointerStart = useRef(null)
  const currentStudent = students[currentIndex]

  const goTo = useCallback((index) => {
    setCurrentIndex((index + students.length) % students.length)
    setDragX(0)
  }, [])
  const goPrevious = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo])
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowLeft') goPrevious()
      if (event.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrevious])

  const finishSwipe = () => {
    if (dragX <= -SWIPE_THRESHOLD) goNext()
    else if (dragX >= SWIPE_THRESHOLD) goPrevious()
    else setDragX(0)
    pointerStart.current = null
    setIsDragging(false)
  }

  return (
    <Box component="main" className="page-shell">
      <Container maxWidth="sm" className="app-container">
        <Stack spacing={{ xs: 2.5, sm: 3 }}>
          <Autocomplete
            fullWidth options={students} value={currentStudent}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.name === value.name}
            onChange={(_, value) => value && goTo(students.indexOf(value))}
            renderInput={(params) => <TextField {...params} label="快速搜尋" placeholder="輸入座號或姓名" />}
            noOptionsText="找不到符合的同學"
          />

          <Box className="card-stage" aria-live="polite">
            <Card
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
            </Card>
          </Box>

          <LinearProgress variant="determinate" value={((currentIndex + 1) / students.length) * 100} aria-label={`目前為第 ${currentIndex + 1} 位，共 ${students.length} 位`} />
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={2}>
            <IconButton className="nav-button" onClick={goPrevious} aria-label="上一位">←</IconButton>
            <Button variant="text" onClick={() => goTo(0)}>回到第一位</Button>
            <IconButton className="nav-button" onClick={goNext} aria-label="下一位">→</IconButton>
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}

export default App
