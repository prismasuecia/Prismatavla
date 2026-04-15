import { useState } from 'react'
import { useBoardStore } from '../store/useBoardStore'
import { parseStudents } from '../utils/students'

export function ClassListPrompt() {
  const [name, setName] = useState('Ny klass')
  const [studentsText, setStudentsText] = useState('')
  const createClassList = useBoardStore((state) => state.actions.createClassList)

  const handleCreate = () => {
    const students = parseStudents(studentsText)
    if (!students.length) {
      window.alert('Lägg till minst ett namn')
      return
    }
    createClassList(name || 'Ny klass', students)
    setStudentsText('')
  }

  return (
    <div className="classlist-prompt">
      <p>Skapa en klasslista för att använda verktyget.</p>
      <label>
        Klassnamn
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Elever (en per rad eller kommaseparerat)
        <textarea
          rows={4}
          value={studentsText}
          onChange={(event) => setStudentsText(event.target.value)}
          placeholder="Alva\nBilal\nCarla"
        />
      </label>
      <button type="button" onClick={handleCreate}>
        Spara klasslista
      </button>
    </div>
  )
}
