import express from 'express';
import { firebaseApp } from '../../index';

const students = express();
interface student {
  firstName: string;
  lastName: string;
  gradYear: number;
  email: string;
  netid: string;
  misc?: object;
}

function isStudent(data: object): data is student {
  return 'firstName' in data && 'lastName' in data && 'gradYear' in data;
}

/**
 * Creates a new student in the `registrants` collection using x-www-form-urlencoded data.
 *
 * Upon success returns the document ID with HTTP 202
 * Upon fail returns HTTP 400
 */
students.post('/createStudent', async (req, res) => {
  let studentData = req.body;

  if (!isStudent(studentData)) {
    res.status(400).send('Malformed student registration request.');
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
students.post('/updateStudent', async (req, res) => {
  let studentData = req.body;

  // Check that email field exists on req.body
  if (!('email' in studentData)) {
    res.status(400).send('Student email not specified.');
  }

  // TODO: handle food allergies with firestore arrayUnion()

  await firebaseApp
    .firestore()
    .collection('students')
    .doc(studentData.email)
    .update(studentData);

  res.sendStatus(200);
});

/**
 * Retrieves student data given a supplied email.
 */
students.get('/getStudent', async (req, res) => {
  let {email} = req.query;

  // TODO: add email regex
  if (email == undefined) {
    res.status(400).send('Student email undefined.');
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
 * Retrieves all students in the students collection.
 */
students.get('/getAllStudents', async (req, res) => {
  let docData = await firebaseApp.firestore().collection('students').get();

  let addedData: Map<string, student> = new Map();

  docData.forEach((doc) => {
    console.log(doc.id, '=>', doc.data());
    addedData.set(doc.id, doc.data() as student);
  });

  res.send(Object.fromEntries(addedData));
});

export default students;
