// Identificativo anonimo del browser: serve solo a mostrare a ciascuno il proprio storico.
// Non contiene dati personali. Se localStorage non è disponibile (es. navigazione privata
// con storage bloccato) vale solo per la sessione corrente.
const KEY = 'lookbook.clientId';
let memoryId = null;

export function getClientId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}
