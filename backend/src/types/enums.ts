export enum EventStatus {
  OPEN = "OPEN", // actively shown to hackers
  CLOSED = "CLOSED", // event that isn't shown to users (eg. future event, or temporarily closed event)
  ARCHIVED = "ARCHIVED", // past event (only maintian general statistics)
}

export enum FormStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export enum QuestionType {
  SHORT_TEXT = "SHORT_TEXT",
  LONG_TEXT = "LONG_TEXT",
  EMAIL = "EMAIL",
  DROP_DOWN = "DROP_DOWN",
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  CHECKBOX = "CHECKBOX",
  FILE_UPLOAD = "FILE_UPLOAD",
  DATE = "DATE",
}