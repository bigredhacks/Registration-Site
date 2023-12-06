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
  firstName?: string;
  lastName?: string;
  gradYear?: number;
  netid?: string;
  misc?: object;
}

function isStudent(data: object): data is student {
  return (
    'firstName' in data &&
    'lastName' in data &&
    'gradYear' in data &&
    'netid' in data &&
    !('email' in data)
  );
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

  // Validate form data
  if (!isStudent(studentData)) {
    res.status(400).send({
      error: 'Malformed student registration request.',
    });
    return;
  }

  // Check email not in database already
  let docRef = await firebaseApp
    .firestore()
    .collection('students')
    .doc(studentData.email)
    .get();
  if (docRef.exists) {
    res
      .status(400)
      .send({
        error: `Student with email: ${studentData.email} already exists.`,
      });
    return;
  }

  try {
    await firebaseApp
      .firestore()
      .collection('students')
      .doc(studentData.email)
      .set(studentData);
  } catch (e) {
    res.status(400).send({ error: 'Could not create student.' });
    return;
  }

  res.sendStatus(200);
});

/**
 * Updates a student with new parameters. Does not support updating arrays yet.
 */
students.put('/:email', async (req, res) => {
  let email = req.params.email;
  let studentData = req.body;

  // Check that email field exists on req.body
  if (!isStudentMutation(studentData)) {
    res.status(404).send({
      error: 'Student email not specified.',
    });
    return;
  }

  // TODO: handle food allergies with firestore arrayUnion()
  try {
    await firebaseApp
      .firestore()
      .collection('students')
      .doc(email)
      // @ts-ignore
      .update(studentData);
  } catch (e) {
    res.status(404).send({
      error: `Student with email: ${email} could not be updated.`,
    });
    return;
  }

  res.sendStatus(200);
});

/**
 * Retrieves all students in the students collection. If there is an `email` URL param specified then it will query only one email.
 */
students.get('/:email', async (req, res) => {
  let email = req.params.email;
  let collectionRef = firebaseApp.firestore().collection('students');

  // Default case to get all students when email not specified
  if (email == '') {
    let snapshotRef = await collectionRef.get();

    let addedData: Map<string, student> = new Map();
    snapshotRef.forEach((doc) => {
      addedData.set(doc.id, doc.data() as student);
    });

    res.status(200).send(Object.fromEntries(addedData));
  } else {
    // Special case when email is specified
    let docRef = await collectionRef.doc(email).get();

    if (docRef.exists) {
      res.status(200).send(docRef.data());
    } else {
      res
        .status(404)
        .send({ error: `Could not get data from email: ${email}` });
    }
  }
});

/**
 * Deletes student from the students collection.
 */
students.delete('/:email', async (req, res) => {
  let email = req.params.email;
  let collectionRef = firebaseApp.firestore().collection('students');

  // Handle when email not specified
  if (email == '') {
    res.status(400).send({ error: 'Email must be specified.' });
    return;
  }

  try {
    await collectionRef.doc(email).delete();
  } catch (e) {
    res.status(404).send({ error: `Cannot find email: ${email}` });
    return;
  }

  res.status(200).send(`Successfully deleted: ${email}`);
});

export default students;
