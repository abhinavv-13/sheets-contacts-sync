const SHEET = 'Contacts';
const sh_ = () => SpreadsheetApp.getActive().getSheetByName(SHEET);

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAll').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('syncAll').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
}

function syncAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try { sheetToContacts(); contactsToSheet(); }
  finally { lock.releaseLock(); }
}

function sheetToContacts() {
  const sh = sh_(), last = sh.getLastRow();
  if (last < 2) return;
  sh.getRange(2, 2, last - 1, 1).setNumberFormat('@');
  sh.getRange(2, 1, last - 1, 3).getValues().forEach(([name, phone, id], i) => {
    if (name && phone && !id) {
      const c = People.People.createContact({
        names: [{ givenName: String(name) }],
        phoneNumbers: [{ value: String(phone) }]
      });
      sh.getRange(i + 2, 3).setValue(c.resourceName);
    }
  });
}

function contactsToSheet() {
  const sh = sh_(), last = sh.getLastRow();
  const known = new Set(last > 1
    ? sh.getRange(2, 3, last - 1, 1).getValues().flat().filter(String) : []);
  let all = [], token;
  do {
    const r = People.People.Connections.list('people/me', {
      personFields: 'names,phoneNumbers', pageSize: 1000, pageToken: token
    });
    all = all.concat(r.connections || []);
    token = r.nextPageToken;
  } while (token);

  const rows = all
    .filter(c => c.phoneNumbers && !known.has(c.resourceName))
    .map(c => [
      (c.names && c.names[0].displayName) || '',
      c.phoneNumbers[0].value,
      c.resourceName
    ]);
  if (rows.length) {
    sh.getRange(last + 1, 3 - 2, rows.length, 3).setValues(rows);
  }
}
