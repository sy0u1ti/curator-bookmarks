import {
  applyPopupPrebootKeyboardEdit,
  getPopupPrebootKeyboardEdit,
  getPopupPrebootSearchAdoptionQuery,
  type PopupPrebootSearchSnapshot,
  type PopupPrebootWritableInput
} from './popup-preboot-input.js'

function run(): void {
  testPlainCharactersAreBufferedWhenFocusIsLate()
  testEditingBufferedInputPreservesCaret()
  testActivePrebootValueWinsDuringAdoption()
  testStalePrebootValueDoesNotOverwriteCurrentQuery()
}

function testPlainCharactersAreBufferedWhenFocusIsLate(): void {
  const input = createInput()

  for (const key of ['t', 'e', 's', 't']) {
    const edit = getPopupPrebootKeyboardEdit({ key })
    assert(edit, `expected ${key} to create an input edit`)
    applyPopupPrebootKeyboardEdit(input, edit)
  }

  assert(input.value === 'test', `expected preboot input to buffer test, got ${input.value}`)
  assert(input.selectionStart === 4 && input.selectionEnd === 4, 'expected caret to follow buffered text')
}

function testEditingBufferedInputPreservesCaret(): void {
  const input = createInput('tes', 3)
  applyPopupPrebootKeyboardEdit(input, { text: 't', type: 'insertText' })
  applyPopupPrebootKeyboardEdit(input, { type: 'deleteContentBackward' })
  applyPopupPrebootKeyboardEdit(input, { text: 't', type: 'insertText' })

  assert(input.value === 'test', `expected edited preboot input to end at test, got ${input.value}`)
  assert(input.selectionStart === 4 && input.selectionEnd === 4, 'expected caret to remain at the end')
}

function testActivePrebootValueWinsDuringAdoption(): void {
  const adopted = getPopupPrebootSearchAdoptionQuery(
    createSnapshot({ active: true, value: 'test' }),
    'st'
  )

  assert(adopted === 'test', `expected active preboot input to win adoption, got ${adopted}`)
}

function testStalePrebootValueDoesNotOverwriteCurrentQuery(): void {
  const adopted = getPopupPrebootSearchAdoptionQuery(
    createSnapshot({ active: false, value: 'te' }),
    'test'
  )

  assert(adopted === 'test', `expected current query to win over stale preboot value, got ${adopted}`)
}

function createInput(value = '', caret = 0): PopupPrebootWritableInput {
  return {
    value,
    selectionStart: caret,
    selectionEnd: caret,
    selectionDirection: 'none',
    setSelectionRange(selectionStart, selectionEnd, selectionDirection = 'none') {
      this.selectionStart = selectionStart
      this.selectionEnd = selectionEnd
      this.selectionDirection = selectionDirection
    }
  }
}

function createSnapshot(
  override: Partial<PopupPrebootSearchSnapshot>
): PopupPrebootSearchSnapshot {
  return {
    active: false,
    selectionDirection: null,
    selectionEnd: null,
    selectionStart: null,
    value: '',
    ...override
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup preboot input tests passed.')
