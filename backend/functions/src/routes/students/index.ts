import express from 'express';
import { firebaseApp } from '../../index';

const students = express.Router();
interface student {
  email: string;
  firstName: string;
  lastName: string;
  gradYear: number;
  netid: string;
  misc?: object;
}

interface studentMutation {
  email: string;
  firstName?: string;
  lastName?: string;
  gradYear?: number;
  netid?: string;
  misc?: object;
}

function isStudent(data: object): data is student {
  return 'firstName' in data && 'lastName' in data && 'gradYear' in data && 'netid' in data;
}

function isStudentMutation(data: object): data is studentMutation {
  return 'email' in data;
}

/**
 * Creates a new student in the `students` collection using x-www-form-urlencoded data.
 *
 * Upon success returns the document ID with HTTP 202
 * Upon fail returns HTTP 400
 */
students.post('/', async (req, res) => {
  let studentData = req.body;

  if (!isStudent(studentData)) {
    res.status(400).send({
      error: 'Malformed student registration request.'
    });
    return;
  }

  await firebaseApp
    .firestore()
    .collection('students')
    .doc(studentData.email)
    .set(studentData);

  res.sendStatus(200);
});

/**
 * Updates a student with new parameters. Does not support updating arrays yet.
 */
students.put('/', async (req, res) => {
  let studentData = req.body;

  // Check that email field exists on req.body
  if (!isStudentMutation(studentData)) {
    res.status(400).send({
      error: 'Student email not specified.'
    });
    return;
  }

  // TODO: handle food allergies with firestore arrayUnion()
  // TODO: error handing
  await firebaseApp
    .firestore()
    .collection('students')
    .doc(studentData.email)
    //@ts-ignore
    .update(studentData);

  res.sendStatus(200);
});

/**
 * Retrieves student data given a supplied email.
 */
students.get('/', async (req, res) => {
  let {email} = req.query;

  // TODO: add email regex
  if (email == undefined) {
    res.status(400).send({
      error: 'Student email not specified.'
    });
  }

  let docRef = await firebaseApp
    .firestore()
    .collection('students')
    .doc(email as string)
    .get();

  if (docRef.exists) res.send(docRef.data());
  else res.sendStatus(404);
});

/**
 * Retrieves all students in the students collection. If there is an `email` URL param specified then it will query only one email.
 */
students.get('/:email', async (req, res) => {
  let email = req.params.email;
  let collectionRef = firebaseApp.firestore().collection('students');
  
  // Default case to get all students when email not specified
  if (email == "") {
    let snapshotRef = await collectionRef.get();

    let addedData: Map<string, student> = new Map();
    snapshotRef.forEach((doc) => {
      addedData.set(doc.id, doc.data() as student);
    });

    res.send(Object.fromEntries(addedData));
  } else {
    // Special case when email is specified
    let docRef = await collectionRef.doc(email).get();

    if (docRef.exists) {
      res.send(docRef.data());
    } else {
      res.sendStatus(404);
    }
  }
});

export default students;
