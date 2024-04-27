export interface student {
  firstName?: string;
  lastName?: string;
  gradYear?: number;
  netid?: string;
  allergies?: string;
}

export type emailed_student = student & {email : string};

export function isStudent(data: object): data is emailed_student {
  return (
    'firstName' in data &&
    'lastName' in data &&
    'gradYear' in data &&
    'netid' in data
  );
}

export function isStudentMutation(data: object): data is student {
  return !('email' in data) && Object.keys(data).length != 0;
}
