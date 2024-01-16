interface student {
  email: string;
  firstName: string;
  lastName: string;
  gradYear: number;
  netid: string;
  allergies?: string;
  misc?: object;
}

interface studentMutation {
  firstName?: string;
  lastName?: string;
  gradYear?: number;
  netid?: string;
  allergies?: string;
  misc?: object;
}

function isStudent(data: object): data is student {
  return (
    'firstName' in data &&
    'lastName' in data &&
    'gradYear' in data &&
    'netid' in data
  );
}

function isStudentMutation(data: object): data is studentMutation {
  return !('email' in data) && Object.keys(data).length != 0;
}
