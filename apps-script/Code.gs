const CONFIG = Object.freeze({
  owner: 'tpemartin',
  repo: 'econ115B',
  branch: 'main',
  tokenProperty: 'GITHUB_TOKEN',
  spreadsheetId: '1B8DXuYoBqRSns9YKyZcbPRr8AfPXa2x8C7pFZEkNgMA',
  responseSheetName: 'self introduction',
  identityHeader: '學號後3碼＋姓名',
  introductionHeader: '自我介紹',
  jsonPaths: [
    'public/data/students.json',
  ],
})

/**
 * Run once from the Apps Script editor while this project is bound to the
 * Google Form response spreadsheet. It installs submission and edit triggers.
 */
function installTriggers() {
  const spreadsheet = getResponseSpreadsheet_()
  const handlers = new Set(['handleFormSubmit', 'handleResponseEdit'])

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (handlers.has(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger)
  })

  ScriptApp.newTrigger('handleFormSubmit')
    .forSpreadsheet(spreadsheet)
    .onFormSubmit()
    .create()

  ScriptApp.newTrigger('handleResponseEdit')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create()
}

/** Handles new submissions and Google Form response revisions. */
function handleFormSubmit(event) {
  if (!event || !event.namedValues) throw new Error('This function must run from a spreadsheet form-submit trigger.')

  updateStudentIntroduction_(
    firstValue_(event.namedValues[CONFIG.identityHeader]),
    firstValue_(event.namedValues[CONFIG.introductionHeader]),
  )
}

/** Handles a teacher manually revising the identity or introduction cell. */
function handleResponseEdit(event) {
  if (!event || !event.range || event.range.getRow() < 2) return

  const sheet = event.range.getSheet()
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
  const identityColumn = headers.indexOf(CONFIG.identityHeader) + 1
  const introductionColumn = headers.indexOf(CONFIG.introductionHeader) + 1
  if (!identityColumn || !introductionColumn) throw new Error('Required form response headers were not found.')

  const firstEditedColumn = event.range.getColumn()
  const lastEditedColumn = event.range.getLastColumn()
  const relevantEdit = [identityColumn, introductionColumn]
    .some((column) => column >= firstEditedColumn && column <= lastEditedColumn)
  if (!relevantEdit) return

  const row = event.range.getRow()
  updateStudentIntroduction_(
    sheet.getRange(row, identityColumn).getDisplayValue(),
    sheet.getRange(row, introductionColumn).getDisplayValue(),
  )
}

/** Run manually to test the currently selected response row. */
function syncSelectedRow() {
  const range = SpreadsheetApp.getActiveRange()
  if (!range || range.getRow() < 2) throw new Error('Select a form response row first.')
  handleResponseEdit({ range: range.getSheet().getRange(range.getRow(), 1, 1, range.getSheet().getLastColumn()) })
}

/**
 * Run manually after setup to publish every response that already exists.
 * When a student appears more than once, the last response row wins.
 */
function syncAllResponses() {
  const sheet = findResponseSheet_()
  const values = sheet.getDataRange().getDisplayValues()
  if (values.length < 2) throw new Error('The response sheet does not contain any submissions.')

  const identityColumn = values[0].indexOf(CONFIG.identityHeader)
  const introductionColumn = values[0].indexOf(CONFIG.introductionHeader)
  const introductions = {}

  values.slice(1).forEach((row) => {
    const identity = normalizeIdentity_(row[identityColumn])
    if (identity) introductions[identity] = String(row[introductionColumn] || '')
  })

  if (Object.keys(introductions).length === 0) throw new Error('No valid student identities were found in the response sheet.')

  const result = runGithubUpdate_((token) => commitIntroductions_(
    token,
    introductions,
    `Sync ${Object.keys(introductions).length} existing student introductions`,
  ))

  Logger.log(`Updated ${result.updatedCount} students.`)
  if (result.unmatched.length) Logger.log(`Unmatched responses: ${result.unmatched.join(', ')}`)
  return result
}

function updateStudentIntroduction_(submittedIdentity, introduction) {
  const identity = normalizeIdentity_(submittedIdentity)
  if (!identity) throw new Error(`Missing value for “${CONFIG.identityHeader}”.`)

  const introductions = {}
  introductions[identity] = String(introduction || '')
  return runGithubUpdate_((token) => commitIntroductions_(token, introductions, `Update introduction for ${identity}`))
}

function runGithubUpdate_(updateFunction) {
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const token = PropertiesService.getScriptProperties().getProperty(CONFIG.tokenProperty)
    if (!token) throw new Error(`Set ${CONFIG.tokenProperty} in Apps Script → Project Settings → Script Properties.`)

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return updateFunction(token)
      } catch (error) {
        if (error.status !== 409 || attempt === 3) throw error
        Utilities.sleep(250 * attempt)
      }
    }
  } finally {
    lock.releaseLock()
  }
}

function commitIntroductions_(token, introductions, commitMessage) {
  const ref = github_(token, 'get', `/git/ref/heads/${encodeURIComponent(CONFIG.branch)}`)
  const parentSha = ref.object.sha
  const parentCommit = github_(token, 'get', `/git/commits/${parentSha}`)
  const currentFile = github_(token, 'get', `/contents/${CONFIG.jsonPaths[0]}?ref=${parentSha}`)
  const jsonText = Utilities.newBlob(Utilities.base64Decode(currentFile.content.replace(/\s/g, ''))).getDataAsString('UTF-8')
  const students = JSON.parse(jsonText)

  const matched = {}
  const matchedNames = []
  students.forEach((student) => {
    const identity = normalizeIdentity_(student.name)
    if (Object.prototype.hasOwnProperty.call(introductions, identity)) {
      student.introduction = introductions[identity]
      matched[identity] = true
      matchedNames.push(student.name)
    }
  })

  const unmatched = Object.keys(introductions).filter((identity) => !matched[identity])
  if (matchedNames.length === 0) throw new Error(`No matching students were found. Submitted identities: ${unmatched.join(', ')}`)

  const updatedJson = `${JSON.stringify(students, null, 2)}\n`
  const blob = github_(token, 'post', '/git/blobs', {
    content: Utilities.base64Encode(updatedJson, Utilities.Charset.UTF_8),
    encoding: 'base64',
  })
  const tree = github_(token, 'post', '/git/trees', {
    base_tree: parentCommit.tree.sha,
    tree: CONFIG.jsonPaths.map((path) => ({ path, mode: '100644', type: 'blob', sha: blob.sha })),
  })
  const commit = github_(token, 'post', '/git/commits', {
    message: commitMessage,
    tree: tree.sha,
    parents: [parentSha],
  })

  github_(token, 'patch', `/git/refs/heads/${encodeURIComponent(CONFIG.branch)}`, {
    sha: commit.sha,
    force: false,
  })

  return { updatedCount: matchedNames.length, unmatched }
}

function findResponseSheet_() {
  const spreadsheet = getResponseSpreadsheet_()
  const namedSheet = spreadsheet.getSheetByName(CONFIG.responseSheetName)
  const sheetsToCheck = namedSheet ? [namedSheet] : spreadsheet.getSheets()
  const sheet = sheetsToCheck.find((candidate) => {
    if (candidate.getLastColumn() === 0) return false
    const headers = candidate.getRange(1, 1, 1, candidate.getLastColumn()).getDisplayValues()[0]
    return headers.includes(CONFIG.identityHeader) && headers.includes(CONFIG.introductionHeader)
  })
  if (!sheet) throw new Error('Could not find a sheet with the required form response headers.')
  return sheet
}

function getResponseSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.spreadsheetId)
}

function github_(token, method, path, payload) {
  const options = {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    muteHttpExceptions: true,
  }
  if (payload !== undefined) {
    options.contentType = 'application/json'
    options.payload = JSON.stringify(payload)
  }

  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}${path}`, options)
  const status = response.getResponseCode()
  const text = response.getContentText()
  if (status < 200 || status >= 300) {
    const error = new Error(`GitHub API ${status}: ${text}`)
    error.status = status
    throw error
  }
  return text ? JSON.parse(text) : null
}

function normalizeIdentity_(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[()（）\s]/g, '')
}

function firstValue_(value) {
  return Array.isArray(value) ? value[0] : value
}
